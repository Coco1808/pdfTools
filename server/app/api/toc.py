from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.toc import TocError, generate_toc, resolve_download
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["toc"])


def _remove_files(*paths: Path) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/toc/generate")
async def toc_generate(file: UploadFile = File(...)):
    cleanup_temp_files()
    try:
        return await generate_toc(file)
    except TocError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成目录失败：{e}") from e


@router.get("/toc/download/{token}")
async def toc_download(token: str):
    try:
        out_path, out_name = resolve_download(token)
    except TocError as e:
        raise HTTPException(status_code=404, detail=e.message) from e

    meta_path = out_path.parent / f"{token}.meta"
    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=out_name,
        background=BackgroundTask(_remove_files, out_path, meta_path),
    )
