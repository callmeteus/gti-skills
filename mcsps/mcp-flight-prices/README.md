# MCP Flight Prices - Servidor Simples em Python

Servidor MCP para pesquisa de preços de voos via scraping.

## Instalação

```bash
pip install -r requirements.txt
```

## Execução

```bash
python server.py
```

## Ferramentas Disponíveis

- **`search_flights`** - Pesquisa voos entre duas cidades
  - Parâmetros:
    - `origin` (required): Código do aeroporto de origem (ex: GRU, GIG, CGH)
    - `destination` (required): Código do aeroporto de destino
    - `departure_date` (required): Data de ida no formato YYYY-MM-DD
    - `return_date` (optional): Data de volta no formato YYYY-MM-DD
    - `passengers` (optional, default: 1): Número de passageiros
    - `class` (optional, default: economy): Classe da viagem (economy, business, first)

- **`list_sources`** - Lista fontes de busca disponíveis

## Exemplo de Uso

```python
import asyncio
from mcp.client.stdio import stdio_client, StdioServerParameters

async def main():
    server_params = StdioServerParameters(
        command="python",
        args=["server.py"]
    )
    
    async with stdio_client(server_params) as (read, write):
        # Inicializar cliente
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Listar ferramentas
            tools = await session.list_tools()
            print(tools)
            
            # Chamar ferramenta
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
            print(result)

asyncio.run(main())
```

## Executar Testes

```bash
python test_mcp.py
```

## Arquitetura

- **Servidor MCP via stdio** (sem HTTP, sem Docker)
- **Scrapers individuais** para cada companhia aérea
- **Sem cache**, busca em tempo real
- **Python puro**, sem dependências complexas
- **Fallback para dados mockados** caso o scraping falhe

## Estrutura do Projeto

```
mcp-flight-prices/
├── server.py              # Servidor MCP principal
├── test_mcp.py           # Cliente de teste
├── requirements.txt       # Dependências
├── README.md             # Documentação
└── scrapers/             # Scrapers individuais
    ├── __init__.py
    ├── skyscanner.py
    ├── google_flights.py
    ├── latam.py
    ├── gol.py
    └── azul.py
```

## Scrapers Implementados

| Fonte | Status | Preço Base |
|-------|--------|------------|
| Skyscanner | ✅ Implementado | R$ 450 |
| Google Flights | ✅ Implementado | R$ 480 |
| LATAM | ✅ Implementado | R$ 520 |
| GOL | ✅ Implementado | R$ 495 |
| Azul | ✅ Implementado | R$ 510 |

### Status dos Scrapers

- **Skyscanner**: Retorna dados mockados (site exige JavaScript/captcha)
- **Google Flights**: Retorna dados mockados (site exige JavaScript)
- **LATAM/GOL/Azul**: Retornam dados mockados (sites não suportam scraping direto)

Os scrapers estão estruturados para facilitar a implementação de scraping real no futuro. Atualmente, todos retornam dados mockados como fallback.

## Dependências

- `mcp` (v1.30.0) - SDK para servidor MCP
- `requests` - Requisições HTTP
- `beautifulsoup4` - Parse de HTML
- `lxml` - Parser XML/HTML

## Testando o Servidor

O servidor pode ser testado de duas formas:

1. **Via script de teste**:
   ```bash
   python test_mcp.py
   ```

2. **Via cliente MCP** (ex: Cursor, Windsurf, ou outro editor):
   - Adicionar configuração do servidor MCP
   - Executar comandos `search_flights` ou `list_sources`

## Limitações

- Os sites de voos frequentemente exigem JavaScript ou apresentam captcha
- Para produção, considere usar APIs oficiais (Skyscanner API, Amadeus, etc.)
- Dados mockados são retornados caso o scraping falhe

## Licença

MIT License
