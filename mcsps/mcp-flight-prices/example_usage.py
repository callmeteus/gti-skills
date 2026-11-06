#!/usr/bin/env python3
"""Exemplo de uso do servidor MCP Flight Prices."""

import asyncio
import json
import sys


async def search_flights_example():
    """Exemplo de busca de voos."""
    # Iniciar o servidor
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "server.py",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    try:
        # 1. Enviar initialize
        print("=== Ferramentas Disponíveis ===")
        init_msg = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "example-client",
                    "version": "1.0.0"
                }
            }
        }
        proc.stdin.write((json.dumps(init_msg) + "\n").encode())
        await proc.stdin.drain()
        
        response = await proc.stdout.readline()
        result = json.loads(response.decode())
        print(f"Servidor: {result['result']['serverInfo']['name']} v{result['result']['serverInfo']['version']}")
        
        # 2. Enviar notifications/initialized
        notif_msg = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        proc.stdin.write((json.dumps(notif_msg) + "\n").encode())
        await proc.stdin.drain()
        
        # 3. Listar ferramentas
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
            print(f"- {tool['name']}: {tool['description'][:60]}...")
        print()
        
        # 4. Listar fontes
        print("=== Fontes de Busca ===")
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
                print(item['text'])
        print()
        
        # 5. Buscar voos
        print("=== Busca de Voos ===")
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
                print(item['text'])
        
    except Exception as e:
        print(f"\nErro: {e}")
        import traceback
        traceback.print_exc()
    finally:
        proc.terminate()
        # Fechar pipes para evitar warnings
        try:
            proc.stdin.close()
            proc.stdout.close()
            proc.stderr.close()
        except:
            pass


async def main():
    """Ponto de entrada."""
    print("Exemplo de uso do MCP Flight Prices")
    print("=" * 50)
    print()
    
    await search_flights_example()
    print("\n" + "=" * 50)
    print("Exemplo concluído!")


if __name__ == "__main__":
    asyncio.run(main())
