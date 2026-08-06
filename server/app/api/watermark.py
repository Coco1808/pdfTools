from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.watermark import WatermarkError, resolve_download, watermark_pdf
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["watermark"])


def _remove_files(*paths: Path) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/watermark")
async def watermark_endpoint(
    file: UploadFile = File(...),
    text: str = Form("机密"),
    opacity: float = Form(0.25),
    angle: float = Form(45),
    font_size: float = Form(48),
    tile: str = Form("true"),
):
    cleanup_temp_files()
    tile_bool = str(tile).strip().lower() in ("1", "true", "yes", "on")
    try:
        return await watermark_pdf(
            file,
            text=text,
            opacity=opacity,
            angle=angle,
            font_size=font_size,
            tile=tile_bool,
        )
    except WatermarkError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加水印失败：{e}") from e


@router.get("/watermark/download/{token}")
async def watermark_download(token: str):
    try:
        out_path, out_name = resolve_download(token)
    except WatermarkError as e:
        raise HTTPException(status_code=404, detail=e.message) from e
    meta_path = out_path.parent / f"{token}.meta"
    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=out_name,
        background=BackgroundTask(_remove_files, out_path, meta_path),
    )
