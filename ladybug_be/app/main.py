"""
FastAPI hlavní aplikace — registrace všech routerů.

ZMĚNA: přidán router 'combined' pro kombinovanou analýzu TČ + FVE.

Soubor: ladybug_be/app/main.py
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analysis, solar, heatpump, combined

app = FastAPI(title="Ladybug Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Registrace routerů
app.include_router(
    analysis.router, prefix="/api/analysis", tags=["analysis"],
)
app.include_router(
    solar.router, prefix="/api/solar", tags=["solar"],
)
app.include_router(
    heatpump.router, prefix="/api/heatpump", tags=["heatpump"],
)
app.include_router(
    combined.router, prefix="/api/combined", tags=["combined"],
)