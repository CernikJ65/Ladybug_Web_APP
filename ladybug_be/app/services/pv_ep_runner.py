"""
Spouštění EnergyPlus simulace pro PV engine.

Dvě cesty: `run_ep_with_progress` streamuje EP stdout a volá `on_progress`
callback na každém "Continuing Simulation at MM/DD" (13 eventů/rok), nebo
`run_ep_simple` jednorázově přes `honeybee_energy.run.run_idf`.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from typing import Callable, Dict, Any, Optional, Tuple

from honeybee_energy.run import (
    run_idf, prepare_idf_for_simulation, output_energyplus_files, folders,
)



_EP_PROGRESS_RE = re.compile(
    r"(Starting|Continuing)\s+Simulation\s+at", re.IGNORECASE
)
_EP_EXPECTED_EVENTS = 13


def run_ep_simple(idf_path: str, epw_path: str) -> Tuple[Optional[str], Optional[str]]:
    """Jednoduché spuštění EP přes honeybee-energy. Vrací (sql_path, err_path)."""
    result = run_idf(idf_path, epw_path)
    if isinstance(result, tuple):
        sql_path = result[0] if len(result) > 0 else None
        err_path = result[4] if len(result) > 4 else None
        return sql_path, err_path
    return None, None


def run_ep_with_progress(
    idf_path: str,
    epw_path: str,
    on_progress: Callable[[float], None],
) -> Tuple[Optional[str], Optional[str]]:
    """
    Spustí EP přímo přes subprocess, streamuje stdout, volá `on_progress`
    při každém ukončeném měsíci. Vrací (sql_path, err_path).
    """
    directory = prepare_idf_for_simulation(idf_path, epw_path)
    stat_file, renamed_stat = _hide_stat_file(epw_path)

    try:
        _run_ep_subprocess(directory, epw_path, on_progress)
    finally:
        _restore_stat_file(stat_file, renamed_stat)

    sql_path, _zsz, _rdd, _html, err_path = output_energyplus_files(directory)
    return sql_path, err_path


# ---------------------------------------------------------------------------
# Interní
# ---------------------------------------------------------------------------

def _run_ep_subprocess(
    directory: str,
    epw_path: str,
    on_progress: Callable[[float], None],
) -> None:
    cmds = [folders.energyplus_exe, "-i", folders.energyplus_idd_path]
    if epw_path is not None:
        cmds.extend(["-w", os.path.abspath(epw_path)])
    cmds.append("-x")

    popen_kwargs: Dict[str, Any] = {
        "cwd": directory,
        "stdout": subprocess.PIPE,
        "stderr": subprocess.STDOUT,
        "text": True,
        "bufsize": 1,
    }
    if os.name == "nt":
        popen_kwargs["creationflags"] = 0x08000000  # CREATE_NO_WINDOW

    process = subprocess.Popen(cmds, **popen_kwargs)
    counter = 0
    try:
        assert process.stdout is not None
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            if _EP_PROGRESS_RE.search(line):
                counter += 1
                frac = min(counter / _EP_EXPECTED_EVENTS, 0.97)
                try:
                    on_progress(frac)
                except Exception:
                    pass
    finally:
        process.wait()

    try:
        on_progress(1.0)
    except Exception:
        pass


def _hide_stat_file(epw_path: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Přejmenuje .stat vedle EPW, aby ho EP nenašel (stejný trick jako run_idf)."""
    if epw_path is None:
        return None, None
    epw_folder = os.path.dirname(epw_path)
    try:
        for wf in os.listdir(epw_folder):
            if wf.endswith(".stat"):
                stat_file = os.path.join(epw_folder, wf)
                renamed = os.path.join(epw_folder, wf.replace(".stat", ".hide"))
                try:
                    os.rename(stat_file, renamed)
                    return stat_file, renamed
                except Exception:
                    return None, None
    except Exception:
        pass
    return None, None


def _restore_stat_file(stat_file: Optional[str], renamed: Optional[str]) -> None:
    if stat_file and renamed:
        try:
            os.rename(renamed, stat_file)
        except Exception:
            pass


def read_err_file(path: Optional[str]) -> str:
    """Načte eplusout.err a vrátí nejzajímavější řádky (Fatal/Severe)."""
    if not path or not os.path.exists(path):
        return "(soubor nenalezen)"
    with open(path, "r", errors="replace") as f:
        lines = f.readlines()
    important = [l.rstrip() for l in lines if "Fatal" in l or "Severe" in l]
    return "\n".join(important[:30]) if important else "".join(lines[-20:])
