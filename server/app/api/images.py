from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.images import ImagesToPdfError, PdfToImagesError, images_to_pdf, pdf_to_images
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["images"])


def _remove_file(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


@router.post("/images-to-pdf")
async def images_to_pdf_endpoint(
    files: list[UploadFile] = File(...),
    page_mode: str = Form("a4"),
):
    cleanup_temp_files()
    try:
        out_path, out_name = await images_to_pdf(files, page_mode=page_mode)
    except ImagesToPdfError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片转 PDF 失败：{e}") from e

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=out_name,
        background=BackgroundTask(_remove_file, out_path),
    )


@router.post("/pdf-to-images")
async def pdf_to_images_endpoint(
    file: UploadFile = File(...),
    image_format: str = Form("png"),
    dpi: int = Form(150),
):
    cleanup_temp_files()
    try:
        out_path, out_name, media_type = await pdf_to_images(
            file,
            image_format=image_format,
            dpi=dpi,
        )
    except PdfToImagesError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 转图片失败：{e}") from e

    return FileResponse(
        path=str(out_path),
        media_type=media_type,
        filename=out_name,
        background=BackgroundTask(_remove_file, out_path),
    )
