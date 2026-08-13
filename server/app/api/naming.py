from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.naming import NamingError, translate_to_english

router = APIRouter(prefix="/api", tags=["naming"])


class TranslateBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=80)


@router.post("/naming/translate")
async def translate_endpoint(body: TranslateBody):
    try:
        return await translate_to_english(body.text)
    except NamingError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"翻译失败：{e}") from e
