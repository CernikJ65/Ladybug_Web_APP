"""Endpoint pro čtení stavu dlouho běžících simulací (polling)."""
from fastapi import APIRouter, HTTPException

from ..services.progress import registry

router = APIRouter()


@router.get("/{job_id}")
def get_progress(job_id: str):
    """Vrátí aktuální stav úlohy nebo 404, pokud neexistuje / vypršela."""
    state = registry.get(job_id)
    if not state:
        raise HTTPException(404, "Úloha nenalezena (neexistuje nebo vypršela).")
    return state.to_dict()
