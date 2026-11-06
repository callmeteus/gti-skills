#!/usr/bin/env python3
"""Teste simples do servidor MCP."""

import asyncio
import sys
import subprocess

async def main():
    print("Iniciando servidor MCP...")
    
    try:
        # Iniciar o servidor como subprocesso
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "server.py",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd="."
        )
        
        print("Servidor iniciado!")
        
        # Ler saída do servidor
        output, error = await asyncio.wait_for(proc.communicate(), timeout=5.0)
        
        if error:
            print(f"Erro do servidor: {error.decode()}")
        
        print(f"Output: {output.decode()}")
        
    except Exception as e:
        print(f"Erro: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
