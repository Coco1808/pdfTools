from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.textable import TextableError, process_textable, resolve_download
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["textable"])


def _remove_files(*paths: Path) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/textable/process")
async def textable_process(
    file: UploadFile = File(...),
    force_ocr: bool = Form(False),
):
    cleanup_temp_files()
    try:
        return await process_textable(file, force_ocr=force_ocr)
    except TextableError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败：{e}") from e


@router.get("/textable/download/{token}")
async def textable_download(token: str):
    try:
        out_path, out_name = resolve_download(token)
    except TextableError as e:
        raise HTTPException(status_code=404, detail=e.message) from e

    meta_path = out_path.parent / f"{token}.meta"
    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=out_name,
        background=BackgroundTask(_remove_files, out_path, meta_path),
    )
