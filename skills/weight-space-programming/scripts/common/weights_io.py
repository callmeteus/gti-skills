"""Load and save named weight tensors as numpy arrays.

Supported formats: .npz, .npy, .safetensors (pure Python, no extra package),
and .pt/.pth (requires PyTorch). Every loader returns an ordered dict of
name -> numpy.ndarray.
"""

import json
import struct
from collections import OrderedDict
from pathlib import Path

import numpy as np

SAFETENSORS_DTYPES = {
    "F64": np.float64,
    "F32": np.float32,
    "F16": np.float16,
    "I64": np.int64,
    "I32": np.int32,
    "I16": np.int16,
    "I8": np.int8,
    "U8": np.uint8,
    "BOOL": np.bool_,
}
NUMPY_TO_SAFETENSORS = {np.dtype(v): k for k, v in SAFETENSORS_DTYPES.items()}


def load(path):
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".npz":
        with np.load(path, allow_pickle=False) as data:
            return OrderedDict((name, data[name]) for name in data.files)
    if suffix == ".npy":
        return OrderedDict([(path.stem, np.load(path, allow_pickle=False))])
    if suffix == ".safetensors":
        return _load_safetensors(path)
    if suffix in (".pt", ".pth", ".bin"):
        return _load_torch(path)
    raise SystemExit(f"unsupported weight format: {path.suffix}")


def save(path, tensors):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    suffix = path.suffix.lower()
    if suffix == ".npz":
        np.savez(path, **tensors)
    elif suffix == ".safetensors":
        _save_safetensors(path, tensors)
    else:
        raise SystemExit(f"can only save .npz or .safetensors, got {path.suffix}")


def _load_safetensors(path):
    raw = path.read_bytes()
    (header_size,) = struct.unpack("<Q", raw[:8])
    header = json.loads(raw[8 : 8 + header_size])
    body = memoryview(raw)[8 + header_size :]
    tensors = OrderedDict()
    for name, info in header.items():
        if name == "__metadata__":
            continue
        start, end = info["data_offsets"]
        chunk = body[start:end]
        dtype = info["dtype"]
        if dtype == "BF16":
            bits = np.frombuffer(chunk, dtype="<u2").astype(np.uint32) << 16
            array = bits.view(np.float32)
        elif dtype in SAFETENSORS_DTYPES:
            array = np.frombuffer(chunk, dtype=np.dtype(SAFETENSORS_DTYPES[dtype]).newbyteorder("<"))
        else:
            raise SystemExit(f"unsupported safetensors dtype {dtype} in {name}")
        tensors[name] = array.reshape(info["shape"]).copy()
    return tensors


def _save_safetensors(path, tensors):
    header = OrderedDict()
    chunks = []
    offset = 0
    for name, array in tensors.items():
        array = np.ascontiguousarray(array)
        if array.dtype not in NUMPY_TO_SAFETENSORS:
            array = array.astype(np.float32)
        data = array.astype(array.dtype.newbyteorder("<")).tobytes()
        header[name] = {
            "dtype": NUMPY_TO_SAFETENSORS[array.dtype],
            "shape": list(array.shape),
            "data_offsets": [offset, offset + len(data)],
        }
        chunks.append(data)
        offset += len(data)
    encoded = json.dumps(header, separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 8)
    with open(path, "wb") as handle:
        handle.write(struct.pack("<Q", len(encoded)))
        handle.write(encoded)
        for data in chunks:
            handle.write(data)


def _load_torch(path):
    try:
        import torch
    except ImportError:
        raise SystemExit("PyTorch is required for .pt/.pth files; convert to .safetensors or install torch")
    state = torch.load(path, map_location="cpu", weights_only=True)
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    tensors = OrderedDict()
    for name, value in state.items():
        if hasattr(value, "detach"):
            tensors[name] = value.detach().float().numpy() if value.is_floating_point() else value.numpy()
    return tensors
