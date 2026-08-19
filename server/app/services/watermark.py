from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

import fitz
from fastapi import UploadFile

from app.config import MAX_FILE_SIZE, TEMP_DIR


class WatermarkError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


async def watermark_pdf(
    upload: UploadFile,
    text: str = "机密",
    opacity: float = 0.25,
    angle: float = 45,
    font_size: float = 48,
    tile: bool = True,
) -> dict:
    text = (text or "").strip()
    if not text:
        raise WatermarkError("请填写水印文字")
    if len(text) > 40:
        raise WatermarkError("水印文字请控制在 40 字以内")

    opacity = max(0.05, min(0.8, float(opacity)))
    angle = float(angle)
    font_size = max(12, min(120, float(font_size)))

    filename = upload.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise WatermarkError(f"「{filename}」不是 PDF 文件")

    data = await upload.read()
    if not data:
        raise WatermarkError(f"「{filename}」是空文件")
    if len(data) > MAX_FILE_SIZE:
        raise WatermarkError(f"「{filename}」超过 500MB 限制")
    if not _validate_pdf_magic(data):
        raise WatermarkError(f"「{filename}」不是有效的 PDF")

    src_path = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
    src_path.write_bytes(data)

    try:
        doc = fitz.open(str(src_path))
        if doc.is_encrypted:
            try:
                if not doc.authenticate(""):
                    raise WatermarkError(f"「{filename}」已加密，请先解密后再上传")
            except WatermarkError:
                raise
            except Exception as e:
                raise WatermarkError(f"「{filename}」已加密，请先解密后再上传") from e
        if doc.page_count == 0:
            raise WatermarkError("PDF 没有可处理的页面")

        fontname = "china-s"
        color = (0.5, 0.5, 0.5)

        for page in doc:
            rect = page.rect
            positions: list[tuple[float, float]] = []
            if tile:
                step_x = max(180, font_size * 4.2)
                step_y = max(140, font_size * 3.2)
                y = rect.y0 + step_y * 0.45
                row = 0
                while y < rect.y1:
                    x = rect.x0 + step_x * (0.15 if row % 2 == 0 else 0.45)
                    while x < rect.x1:
                        positions.append((x, y))
                        x += step_x
                    y += step_y
                    row += 1
            else:
                positions.append((rect.width * 0.35, rect.height * 0.55))

            for x, y in positions:
                pivot = fitz.Point(x, y)
                try:
                    page.insert_text(
                        pivot,
                        text,
                        fontsize=font_size,
                        fontname=fontname,
                        color=color,
                        fill_opacity=opacity,
                        morph=(pivot, fitz.Matrix(angle)),
                        overlay=True,
                    )
                except Exception:
                    try:
                        page.insert_text(
                            (x, y),
                            text,
                            fontsize=font_size,
                            fontname="helv",
                            color=color,
                            fill_opacity=opacity,
                            overlay=True,
                        )
                    except Exception:
                        continue

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_name = f"watermarked-{stamp}.pdf"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
        page_count = doc.page_count
        doc.save(str(out_path), garbage=3, deflate=True)
        doc.close()

        token = uuid.uuid4().hex
        (TEMP_DIR / f"{token}.meta").write_text(str(out_path), encoding="utf-8")

        return {
            "token": token,
            "fileName": out_name,
            "sourceFileName": filename,
            "pageCount": page_count,
            "text": text,
            "opacity": opacity,
            "angle": angle,
            "fontSize": font_size,
            "tile": tile,
        }
    finally:
        try:
            src_path.unlink(missing_ok=True)
        except OSError:
            pass


def resolve_download(token: str) -> tuple[Path, str]:
    meta_path = TEMP_DIR / f"{token}.meta"
    if not meta_path.exists():
        raise WatermarkError("下载链接无效或已过期，请重新处理")
    out_path = Path(meta_path.read_text(encoding="utf-8").strip())
    if not out_path.exists():
        raise WatermarkError("文件已清理，请重新处理")
    name = out_path.name
    if "-" in name:
        parts = name.split("-", 1)
        if len(parts[0]) == 32:
            name = parts[1]
    return out_path, name
