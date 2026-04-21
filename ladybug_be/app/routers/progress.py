"""Endpoint pro čtení stavu dlouho běžících simulací (polling)."""
import time

from fastapi import APIRouter

from ..services.progress import registry

router = APIRouter()


@router.get("/{job_id}")
def get_progress(job_id: str):
    """
    Vrátí aktuální stav úlohy. Pokud job ještě není zaregistrován
    (race mezi prvním pollem z FE a dispatchnutím POST handleru v BE),
    vrátíme syntetický "pending" stav místo 404 — FE overlay tak plynule
    čeká na start.
    """
    state = registry.get(job_id)
    if state:
        return state.to_dict()
    return {
        "job_id": job_id,
        "stage": "pending",
        "percent": 0.0,
        "message": "",
        "status": "running",
        "updated_at": time.time(),
        "error": None,
    }
