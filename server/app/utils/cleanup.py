from __future__ import annotations

import time
from pathlib import Path

from app.config import TEMP_DIR, TEMP_RETENTION_SECONDS


def cleanup_temp_files() -> int:
    """Remove temp files older than retention window. Returns count deleted."""
    now = time.time()
    deleted = 0
    if not TEMP_DIR.exists():
        return 0
    for path in TEMP_DIR.iterdir():
        if not path.is_file():
            continue
        try:
            age = now - path.stat().st_mtime
            if age > TEMP_RETENTION_SECONDS:
                path.unlink(missing_ok=True)
                deleted += 1
        except OSError:
            pass
    return deleted
