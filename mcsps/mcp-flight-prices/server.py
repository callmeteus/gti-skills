#!/usr/bin/env python3
"""Servidor MCP para pesquisa de preços de voos."""

import asyncio
import json
from datetime import datetime
from typing import Any
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Importar scrapers
from scrapers.skyscanner import scrape_skyscanner as scrape_skyscanner_real
from scrapers.google_flights import scrape_google_flights as scrape_google_flights_real
from scrapers.latam import scrape_latam as scrape_latam_real
from scrapers.gol import scrape_gol as scrape_gol_real
from scrapers.azul import scrape_azul as scrape_azul_real

app = Server("mcp-flight-prices")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """Lista as ferramentas disponíveis."""
    return [
        Tool(
            name="search_flights",
            description="Pesquisar preços de voos entre duas cidades. Suporta ida/ida e ida e volta.",
            inputSchema={
                "type": "object",
                "properties": {
                    "origin": {
                        "type": "string",
                        "description": "Código do aeroporto de origem (ex: GRU, GIG, CGH)"
                    },
                    "destination": {
                        "type": "string",
                        "description": "Código do aeroporto de destino"
                    },
                    "departure_date": {
                        "type": "string",
                        "description": "Data de ida no formato YYYY-MM-DD"
                    },
                    "return_date": {
                        "type": "string",
                        "description": "Data de volta no formato YYYY-MM-DD (opcional)"
                    },
                    "passengers": {
                        "type": "integer",
                        "description": "Número de passageiros",
                        "default": 1
                    },
                    "class": {
                        "type": "string",
                        "description": "Classe da viagem",
                        "enum": ["economy", "business", "first"],
                        "default": "economy"
                    }
                },
                "required": ["origin", "destination", "departure_date"]
            }
        ),
        Tool(
            name="list_sources",
            description="Listar fontes de busca de voos disponíveis",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Chama uma ferramenta."""
    if name == "search_flights":
        return await handle_search_flights(arguments)
    elif name == "list_sources":
        return await handle_list_sources()
    else:
        return [TextContent(type="text", text=f"Tool '{name}' not found")]


async def handle_search_flights(args: dict) -> list[TextContent]:
    """Processa busca de voos."""
    origin = args.get("origin", "")
    destination = args.get("destination", "")
    departure_date = args.get("departure_date", "")
    return_date = args.get("return_date", "")
    passengers = args.get("passengers", 1)
    class_type = args.get("class", "economy")
    
    results = []
    
    # Scrapers individuais
    results.extend(await scrape_skyscanner_real(origin, destination, departure_date, return_date))
    results.extend(await scrape_google_flights_real(origin, destination, departure_date, return_date))
    results.extend(await scrape_latam_real(origin, destination, departure_date, return_date))
    results.extend(await scrape_gol_real(origin, destination, departure_date, return_date))
    results.extend(await scrape_azul_real(origin, destination, departure_date, return_date))
    
    if not results:
        return [TextContent(type="text", text="Nenhum voo encontrado")]
    
    # Formatar resultados
    output = f"Encontrados {len(results)} voos:\n\n"
    for i, flight in enumerate(results, 1):
        output += f"{i}. {flight['airline']} - {flight['price']} BRL\n"
        output += f"   {flight['details']}\n\n"
    
    return [TextContent(type="text", text=output)]


async def handle_list_sources() -> list[TextContent]:
    """Lista fontes disponíveis."""
    sources = [
        "Skyscanner",
        "Google Flights",
        "LATAM",
        "GOL",
        "Azul"
    ]
    return [TextContent(type="text", text=f"Fontes disponíveis:\n" + "\n".join(sources))]





async def main():
    """Ponto de entrada."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
