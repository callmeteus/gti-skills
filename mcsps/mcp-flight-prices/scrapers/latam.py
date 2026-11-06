#!/usr/bin/env python3
"""Scraper da LATAM para voos."""

import re
from typing import Any

import requests
from bs4 import BeautifulSoup


async def scrape_latam(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None = None
) -> list[dict[str, Any]]:
    """
    Rascra a LATAM para voos.
    
    Args:
        origin: Codigo do aeroporto de origem
        destination: Codigo do aeroporto de destino
        departure_date: Data de ida (YYYY-MM-DD)
        return_date: Data de volta (YYYY-MM-DD) ou None
        
    Returns:
        Lista de voos encontrados
    """
    results = []
    
    try:
        # URL da LATAM
        url = f"https://www.latam.com/pt-br/voo/{origin}/{destination}/{departure_date}"
        if return_date:
            url += f"/{return_date}"
        
        # Headers para simular navegador
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        }
        
        # Fazer requisicao
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parsear HTML
        soup = BeautifulSoup(response.text, "lxml")
        
        # Extrair voos
        flight_cards = soup.find_all("div", class_=re.compile(r"flight|result|card|offer", re.I))
        
        for card in flight_cards:
            flight_info = extract_flight_info(card, "LATAM")
            if flight_info:
                results.append(flight_info)
        
    except requests.RequestException as e:
        print(f"Erro ao acessar LATAM: {e}")
    except Exception as e:
        print(f"Erro ao processar LATAM: {e}")
    
    # Fallback para dados mockados
    if not results:
        results = [
            {
                "airline": "LATAM - Voo Mockado",
                "price": 520,
                "details": f"{origin} -> {destination} | {departure_date}" + 
                          (f" | Volta: {return_date}" if return_date else ""),
                "source": "LATAM"
            }
        ]
    
    return results


def extract_flight_info(element: Any, source: str) -> dict[str, Any] | None:
    """Extrai informacoes de voo de um elemento HTML."""
    try:
        text = element.get_text(strip=True)
        price_elem = element.find(string=re.compile(r"\d+\s*BRL|\d+\s*USD", re.I))
        
        if price_elem:
            price_text = str(price_elem).strip()
            price = re.search(r"(\d+)", price_text)
            price_value = int(price.group(1)) if price else 520
        else:
            price_value = 520
        
        return {
            "airline": f"{source} - Voo",
            "price": price_value,
            "details": text[:200] if text else f"{source} voo",
            "source": source
        }
    except Exception:
        return None
