from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.replace import ReplaceError, get_pdf_info, replace_page
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["replace"])


def _remove_file(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


@router.post("/pdf/info")
async def pdf_info_endpoint(file: UploadFile = File(...)):
    cleanup_temp_files()
    try:
        return await get_pdf_info(file)
    except ReplaceError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取失败：{e}") from e


@router.post("/replace")
async def replace_endpoint(
    source: UploadFile = File(...),
    replacement: UploadFile = File(...),
    page_number: int = Form(...),
    replacement_page_number: int = Form(1),
):
    cleanup_temp_files()
    try:
        out_path, out_name = await replace_page(
            source=source,
            replacement=replacement,
            page_number=page_number,
            replacement_page_number=replacement_page_number,
        )
    except ReplaceError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"替换失败：{e}") from e

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=out_name,
        background=BackgroundTask(_remove_file, out_path),
    )
