from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

import fitz
from fastapi import UploadFile

from app.config import MAX_FILE_SIZE, TEMP_DIR

# high/medium keep text; low rasterizes for stronger size cut
QUALITY_PRESETS = {
    "high": {"mode": "optimize", "jpeg_quality": 85},
    "medium": {"mode": "optimize", "jpeg_quality": 65},
    "low": {"mode": "raster", "dpi": 110, "jpeg_quality": 55},
}


class CompressError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


def _optimize_images(doc: fitz.Document, jpeg_quality: int) -> None:
    for page in doc:
        for img in page.get_images(full=True):
            xref = img[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.n - pix.alpha >= 4:  # CMYK
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                if pix.alpha:
                    pix = fitz.Pixmap(pix, 0)  # drop alpha for jpeg
                if pix.width < 48 or pix.height < 48:
                    continue
                # Downsample very large bitmaps
                max_dim = 1800
                if max(pix.width, pix.height) > max_dim:
                    scale = max_dim / max(pix.width, pix.height)
                    new_w = max(1, int(pix.width * scale))
                    new_h = max(1, int(pix.height * scale))
                    pix = fitz.Pixmap(pix, new_w, new_h, None)
                stream = pix.tobytes("jpeg", jpg_quality=jpeg_quality)
                # Replace image content when possible
                doc.update_stream(xref, stream)
            except Exception:
                continue


def _rasterize_doc(src: fitz.Document, dpi: int, jpeg_quality: int) -> fitz.Document:
    out = fitz.open()
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for page in src:
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = pix.tobytes("jpeg", jpg_quality=jpeg_quality)
        new_page = out.new_page(width=page.rect.width, height=page.rect.height)
        new_page.insert_image(new_page.rect, stream=img)
    return out


async def compress_pdf(upload: UploadFile, quality: str = "medium") -> dict:
    filename = upload.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise CompressError(f"「{filename}」不是 PDF 文件")

    data = await upload.read()
    if not data:
        raise CompressError(f"「{filename}」是空文件")
    if len(data) > MAX_FILE_SIZE:
        raise CompressError(f"「{filename}」超过 500MB 限制")
    if not _validate_pdf_magic(data):
        raise CompressError(f"「{filename}」不是有效的 PDF")

    quality_key = quality if quality in QUALITY_PRESETS else "medium"
    preset = QUALITY_PRESETS[quality_key]
    src_path = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
    src_path.write_bytes(data)
    original_size = len(data)

    try:
        doc = fitz.open(str(src_path))
        if doc.is_encrypted:
            try:
                if not doc.authenticate(""):
                    raise CompressError(f"「{filename}」已加密，请先解密后再上传")
            except CompressError:
                raise
            except Exception as e:
                raise CompressError(f"「{filename}」已加密，请先解密后再上传") from e
        if doc.page_count == 0:
            raise CompressError("PDF 没有可处理的页面")

        page_count = doc.page_count
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_name = f"compressed-{stamp}.pdf"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"

        if preset["mode"] == "raster":
            out_doc = _rasterize_doc(doc, preset["dpi"], preset["jpeg_quality"])
            doc.close()
            out_doc.save(str(out_path), garbage=4, deflate=True)
            out_doc.close()
        else:
            _optimize_images(doc, preset["jpeg_quality"])
            doc.save(str(out_path), garbage=4, deflate=True, clean=True)
            doc.close()

        compressed_size = out_path.stat().st_size
        if compressed_size >= original_size * 0.98:
            out_path.write_bytes(data)
            compressed_size = original_size
            ratio = 0.0
            note = "文件已较优，体积无明显下降（可尝试「强力压缩」）"
        else:
            ratio = round((1 - compressed_size / original_size) * 100, 1)
            note = f"体积减少约 {ratio}%"
            if preset["mode"] == "raster":
                note += "（强力模式会转为图片页，文字不可再选）"

        token = uuid.uuid4().hex
        (TEMP_DIR / f"{token}.meta").write_text(str(out_path), encoding="utf-8")

        return {
            "token": token,
            "fileName": out_name,
            "sourceFileName": filename,
            "pageCount": page_count,
            "quality": quality_key,
            "originalSize": original_size,
            "compressedSize": compressed_size,
            "savedRatio": ratio,
            "note": note,
        }
    finally:
        try:
            src_path.unlink(missing_ok=True)
        except OSError:
            pass


def resolve_download(token: str) -> tuple[Path, str]:
    meta_path = TEMP_DIR / f"{token}.meta"
    if not meta_path.exists():
        raise CompressError("下载链接无效或已过期，请重新处理")
    out_path = Path(meta_path.read_text(encoding="utf-8").strip())
    if not out_path.exists():
        raise CompressError("文件已清理，请重新处理")
    name = out_path.name
    if "-" in name:
        parts = name.split("-", 1)
        if len(parts[0]) == 32:
            name = parts[1]
    return out_path, name
