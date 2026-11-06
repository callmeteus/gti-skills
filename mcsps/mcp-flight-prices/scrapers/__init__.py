#!/usr/bin/env python3
"""Pacote de scrapers para busca de voos."""

from .skyscanner import scrape_skyscanner
from .google_flights import scrape_google_flights
from .latam import scrape_latam
from .gol import scrape_gol
from .azul import scrape_azul

__all__ = [
    "scrape_skyscanner",
    "scrape_google_flights",
    "scrape_latam",
    "scrape_gol",
    "scrape_azul",
]
