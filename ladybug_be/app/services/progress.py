"""
Sdílený progress reporter pro dlouho běžící simulace.

Pilot: použit v routeru solar.optimize_panels. Cíl je mít jednu centrální
komponentu, kterou lze později zapojit do dalších endpointů (heatpump,
ped-optimizer, converter…) bez zásahu do stávajících tříd ve /services.

Použití v routeru:

    from ..services.progress import progress_scope, report_progress

    with progress_scope(job_id):
        report_progress("loading", 10, "Načítám EPW…")
        ...

Uvnitř servisních tříd stačí zavolat `report_progress(...)` — mimo
`progress_scope` je to no-op, takže volání z jiných pipeline nic nerozbije.

FE si stav vyčítá pollingem přes GET /api/progress/{job_id}.
"""
from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import asdict, dataclass
from typing import Dict, Optional


@dataclass
class ProgressState:
    job_id: str
    stage: str = "pending"
    percent: float = 0.0
    message: str = ""
    status: str = "running"  # running | done | error
    updated_at: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class ProgressRegistry:
    """In-memory thread-safe registr stavů běžících úloh."""

    def __init__(self, ttl_seconds: int = 600):
        self._store: Dict[str, ProgressState] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def create(self, job_id: str) -> ProgressState:
        with self._lock:
            self._cleanup_locked()
            state = ProgressState(job_id=job_id, updated_at=time.time())
            self._store[job_id] = state
            return state

    def update(self, job_id: str, **fields) -> None:
        with self._lock:
            state = self._store.get(job_id)
            if not state:
                return
            for key, value in fields.items():
                if hasattr(state, key):
                    setattr(state, key, value)
            state.updated_at = time.time()

    def get(self, job_id: str) -> Optional[ProgressState]:
        with self._lock:
            return self._store.get(job_id)

    def _cleanup_locked(self) -> None:
        now = time.time()
        stale = [
            jid for jid, state in self._store.items()
            if now - state.updated_at > self._ttl
        ]
        for jid in stale:
            self._store.pop(jid, None)


registry = ProgressRegistry()

_current_job: ContextVar[Optional[str]] = ContextVar(
    "ladybug_progress_job", default=None
)


def report_progress(stage: str, percent: float, message: str = "") -> None:
    """
    Zapíše aktuální stav simulace. Pokud není aktivní `progress_scope`,
    funkce nic nedělá (bezpečné volat i mimo pipeline se sledováním).
    """
    job_id = _current_job.get()
    if not job_id:
        return
    registry.update(
        job_id,
        stage=stage,
        percent=max(0.0, min(100.0, float(percent))),
        message=message,
    )


@contextmanager
def progress_tween(start: float, end: float, duration_seconds: float = 20.0):
    """
    Během bloku plynule zvyšuje percent od `start` k `end` (ease-out).
    Určeno pro dlouhé black-box kroky (EnergyPlus, Radiance…), kde nemáme
    callback s reálným progressem.

    Pokud blok skončí dřív, tween se okamžitě zastaví. Pokud trvá déle
    než `duration_seconds`, tween asymptoticky dojede k `end - 1` a tam
    čeká na dokončení.
    """
    job_id = _current_job.get()
    if not job_id:
        yield
        return

    registry.update(job_id, percent=start)
    stop_event = threading.Event()
    t0 = time.time()
    span = max(0.0, end - start)
    duration = max(0.5, float(duration_seconds))

    def _tick():
        while not stop_event.wait(0.3):
            elapsed = time.time() - t0
            frac = min(1.0, elapsed / duration)
            eased = 1.0 - (1.0 - frac) ** 2  # ease-out kvadratický
            current = start + span * min(eased, 0.98)
            registry.update(job_id, percent=current)

    worker = threading.Thread(target=_tick, daemon=True)
    worker.start()
    try:
        yield
    finally:
        stop_event.set()
        worker.join(timeout=0.5)


@contextmanager
def progress_scope(job_id: Optional[str]):
    """
    Aktivuje progress sledování pro daný `job_id`.

    Pokud je `job_id` None nebo prázdné, scope je no-op a pipeline
    se chová jako dřív.
    """
    if not job_id:
        yield None
        return

    state = registry.create(job_id)
    token = _current_job.set(job_id)
    try:
        yield state
    except Exception as exc:
        registry.update(
            job_id,
            status="error",
            error=str(exc),
            message=f"Chyba: {exc}",
        )
        raise
    else:
        registry.update(
            job_id,
            status="done",
            percent=100.0,
            stage="completed",
            message="Hotovo",
        )
    finally:
        _current_job.reset(token)
