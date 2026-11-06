#!/usr/bin/env python3
"""Cliente de teste para o servidor MCP Flight Prices."""

import asyncio
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession


async def test_server():
    """Testa o servidor MCP."""
    print("Iniciando teste do servidor MCP Flight Prices...\n")
    
    server_params = StdioServerParameters(
        command="python",
        args=["server.py"],
        cwd="."
    )
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Inicializar
            print("Inicializando cliente...")
            init_result = await session.initialize()
            print(f"✅ Servidor: {init_result.server_info.name} v{init_result.server_info.version}\n")
            
            # Listar ferramentas
            print("Listando ferramentas...")
            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description[:50]}...")
            print()
            
            # Testar list_sources
            print("Testando list_sources...")
            result = await session.call_tool("list_sources", {})
            print(f"Resultado:\n{result.content[0].text}\n")
            
            # Testar search_flights
            print("Testando search_flights...")
            result = await session.call_tool(
                "search_flights",
                {
                    "origin": "GRU",
                    "destination": "GIG",
                    "departure_date": "2026-12-15",
                    "return_date": "2026-12-22",
                    "passengers": 2,
                    "class": "economy"
                }
            )
            print(f"Resultado:\n{result.content[0].text}")


if __name__ == "__main__":
    asyncio.run(test_server())
