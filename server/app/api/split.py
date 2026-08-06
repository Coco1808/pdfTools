from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.split import SplitError, resolve_download, split_pdf
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["split"])


def _remove_files(*paths: Path) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/split")
async def split_endpoint(
    file: UploadFile = File(...),
    mode: str = Form("range"),
    ranges: str = Form(""),
    every_n: int = Form(1),
):
    cleanup_temp_files()
    try:
        return await split_pdf(file, mode=mode, ranges=ranges, every_n=every_n)
    except SplitError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"拆分失败：{e}") from e


@router.get("/split/download/{token}")
async def split_download(token: str):
    try:
        out_path, out_name = resolve_download(token)
    except SplitError as e:
        raise HTTPException(status_code=404, detail=e.message) from e
    meta_path = out_path.parent / f"{token}.meta"
    return FileResponse(
        path=str(out_path),
        media_type="application/zip",
        filename=out_name,
        background=BackgroundTask(_remove_files, out_path, meta_path),
    )
