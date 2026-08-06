from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.compress import CompressError, compress_pdf, resolve_download
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["compress"])


def _remove_files(*paths: Path) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/compress")
async def compress_endpoint(
    file: UploadFile = File(...),
    quality: str = Form("medium"),
):
    cleanup_temp_files()
    try:
        return await compress_pdf(file, quality=quality)
    except CompressError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"压缩失败：{e}") from e


@router.get("/compress/download/{token}")
async def compress_download(token: str):
    try:
        out_path, out_name = resolve_download(token)
    except CompressError as e:
        raise HTTPException(status_code=404, detail=e.message) from e
    meta_path = out_path.parent / f"{token}.meta"
    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=out_name,
        background=BackgroundTask(_remove_files, out_path, meta_path),
    )
