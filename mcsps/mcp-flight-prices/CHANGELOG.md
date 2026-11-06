# CHANGELOG

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [1.0.0] - 2026-11-06

### Adicionado
- Servidor MCP via stdio em Python
- Ferramenta `search_flights` para pesquisa de voos
- Ferramenta `list_sources` para listar fontes disponíveis
- Scrapers para 5 fontes:
  - Skyscanner
  - Google Flights
  - LATAM
  - GOL
  - Azul
- Sistema de fallback para dados mockados
- Teste completo (`test_mcp.py`)
- Exemplo de uso (`example_usage.py`)
- Documentação completa (`README.md`)
- Arquivo `.gitignore`

### Características
- Sem cache, busca em tempo real
- Sem Docker, Python puro
- Arquitetura simples e direta
- Fallback automático para dados mockados caso scraping falhe

### Dependências
- `mcp>=1.0.0` - SDK para servidor MCP
- `requests>=2.31.0` - Requisições HTTP
- `beautifulsoup4>=4.12.0` - Parse de HTML
- `lxml>=4.9.0` - Parser XML/HTML
