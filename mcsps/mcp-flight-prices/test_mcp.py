#!/usr/bin/env python3
"""Teste completo do servidor MCP."""

import asyncio
import json
import sys

async def test_mcp_server():
    """Testa o servidor MCP."""
    print("Testando servidor MCP Flight Prices...")
    print("=" * 60)
    
    # Iniciar o servidor
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "server.py",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    try:
        # 1. Enviar initialize
        print("\n1. Enviando initialize...")
        init_msg = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }
        proc.stdin.write((json.dumps(init_msg) + "\n").encode())
        await proc.stdin.drain()
        
        # Ler resposta
        response = await proc.stdout.readline()
        result = json.loads(response.decode())
        print(f"   Resposta: {result['result']['serverInfo']['name']} v{result['result']['serverInfo']['version']}")
        
        # 2. Enviar notifications/initialized
        print("\n2. Enviando notifications/initialized...")
        notif_msg = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        proc.stdin.write((json.dumps(notif_msg) + "\n").encode())
        await proc.stdin.drain()
        
        # 3. Listar ferramentas
        print("\n3. Listando ferramentas...")
        list_msg = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        proc.stdin.write((json.dumps(list_msg) + "\n").encode())
        await proc.stdin.drain()
        
        response = await proc.stdout.readline()
        result = json.loads(response.decode())
        tools = result['result']['tools']
        for tool in tools:
            print(f"   - {tool['name']}: {tool['description'][:60]}...")
        
        # 4. Chamar list_sources
        print("\n4. Chamando list_sources...")
        call_msg = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "list_sources",
                "arguments": {}
            }
        }
        proc.stdin.write((json.dumps(call_msg) + "\n").encode())
        await proc.stdin.drain()
        
        response = await proc.stdout.readline()
        result = json.loads(response.decode())
        content = result['result']['content']
        for item in content:
            if item['type'] == 'text':
                print(f"   {item['text']}")
        
        # 5. Chamar search_flights
        print("\n5. Chamando search_flights...")
        search_msg = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "search_flights",
                "arguments": {
                    "origin": "GRU",
                    "destination": "GIG",
                    "departure_date": "2026-12-15",
                    "return_date": "2026-12-22",
                    "passengers": 2,
                    "class": "economy"
                }
            }
        }
        proc.stdin.write((json.dumps(search_msg) + "\n").encode())
        await proc.stdin.drain()
        
        response = await proc.stdout.readline()
        result = json.loads(response.decode())
        content = result['result']['content']
        for item in content:
            if item['type'] == 'text':
                print(f"   {item['text']}")
        
        print("\n" + "=" * 60)
        print("Teste concluído com sucesso!")
        
    except Exception as e:
        print(f"\nErro: {e}")
        import traceback
        traceback.print_exc()
    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(test_mcp_server())
