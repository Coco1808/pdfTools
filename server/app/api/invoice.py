from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.invoice import InvoiceError, analyze_invoices
from app.utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/api", tags=["invoice"])


@router.post("/invoice/analyze")
async def analyze_endpoint(files: list[UploadFile] = File(...)):
    cleanup_temp_files()
    try:
        result = await analyze_invoices(files)
    except InvoiceError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别失败：{e}") from e
    return result
