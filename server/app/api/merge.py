from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.merge import MergeError, merge_pdfs
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["merge"])


def _remove_file(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


@router.post("/merge")
async def merge_endpoint(files: list[UploadFile] = File(...)):
    cleanup_temp_files()
    try:
        out_path, out_name = await merge_pdfs(files)
    except MergeError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"合并失败：{e}") from e

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=out_name,
        background=BackgroundTask(_remove_file, out_path),
    )
