from __future__ import annotations

import uuid
import zipfile
from datetime import datetime
from pathlib import Path

import fitz
from fastapi import UploadFile

from app.config import MAX_FILE_SIZE, MAX_FILES, MAX_TOTAL_SIZE, TEMP_DIR

MAX_PDF_PAGES = 80
ALLOWED_DPI = {72, 150, 300}
JPEG_QUALITY = 85
MAX_RENDER_SIDE = 4000

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tif", ".tiff"}
EXT_TO_KIND = {
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".png": "png",
    ".webp": "webp",
    ".bmp": "bmp",
    ".gif": "gif",
    ".tif": "tiff",
    ".tiff": "tiff",
}


class ImagesToPdfError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _sniff_image(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:2] == b"BM":
        return "bmp"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    return None


def _fit_rect(img_w: float, img_h: float, page: fitz.Rect, margin: float = 36) -> fitz.Rect:
    box = fitz.Rect(page.x0 + margin, page.y0 + margin, page.x1 - margin, page.y1 - margin)
    if img_w <= 0 or img_h <= 0:
        return box
    scale = min(box.width / img_w, box.height / img_h)
    width = img_w * scale
    height = img_h * scale
    x0 = box.x0 + (box.width - width) / 2
    y0 = box.y0 + (box.height - height) / 2
    return fitz.Rect(x0, y0, x0 + width, y0 + height)


async def images_to_pdf(files: list[UploadFile], page_mode: str = "a4") -> tuple[Path, str]:
    if not files:
        raise ImagesToPdfError("请至少上传一张图片")
    if len(files) > MAX_FILES:
        raise ImagesToPdfError(f"单次最多上传 {MAX_FILES} 个文件")

    mode = (page_mode or "a4").strip().lower()
    if mode not in {"a4", "original"}:
        raise ImagesToPdfError("纸张模式无效")

    doc = fitz.open()
    total_size = 0

    try:
        for upload in files:
            filename = upload.filename or "image"
            suffix = Path(filename).suffix.lower()
            if suffix not in ALLOWED_EXTS:
                raise ImagesToPdfError(f"「{filename}」不是支持的图片格式")

            data = await upload.read()
            size = len(data)
            if size == 0:
                raise ImagesToPdfError(f"「{filename}」是空文件")
            if size > MAX_FILE_SIZE:
                raise ImagesToPdfError(f"「{filename}」超过 50MB 限制")
            total_size += size
            if total_size > MAX_TOTAL_SIZE:
                raise ImagesToPdfError("全部文件合计超过 100MB 限制")

            kind = _sniff_image(data) or EXT_TO_KIND.get(suffix)
            if not kind:
                raise ImagesToPdfError(f"「{filename}」不是有效的图片")

            try:
                src = fitz.open(stream=data, filetype=kind)
            except Exception as e:
                raise ImagesToPdfError(f"「{filename}」无法读取") from e

            try:
                rect = src[0].rect
            finally:
                src.close()

            if mode == "original":
                width = max(rect.width, 72)
                height = max(rect.height, 72)
                page = doc.new_page(width=width, height=height)
                page.insert_image(page.rect, stream=data)
            else:
                paper = fitz.paper_rect("a4-l") if rect.width > rect.height else fitz.paper_rect("a4")
                page = doc.new_page(width=paper.width, height=paper.height)
                page.insert_image(_fit_rect(rect.width, rect.height, page.rect), stream=data)

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_name = f"images-{stamp}.pdf"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
        doc.save(str(out_path))
        return out_path, out_name
    finally:
        doc.close()


class PdfToImagesError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


def _safe_stem(name: str) -> str:
    stem = Path(name).stem.strip() or "page"
    cleaned = "".join(c if c.isalnum() or c in "-_." else "-" for c in stem)
    return (cleaned[:80] or "page").strip("-_.") or "page"


def _open_pdf(data: bytes, filename: str) -> fitz.Document:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise PdfToImagesError(f"「{filename}」无法读取，文件可能已损坏") from e
    if doc.is_encrypted:
        try:
            if not doc.authenticate(""):
                raise PdfToImagesError(f"「{filename}」已加密，请先解密后再上传")
        except PdfToImagesError:
            raise
        except Exception as e:
            raise PdfToImagesError(f"「{filename}」已加密，请先解密后再上传") from e
    if doc.page_count == 0:
        raise PdfToImagesError("PDF 没有可处理的页面")
    if doc.page_count > MAX_PDF_PAGES:
        raise PdfToImagesError(f"单次最多转换 {MAX_PDF_PAGES} 页，请先拆分后再试")
    return doc


def _render_page(page: fitz.Page, dpi: int, image_format: str) -> bytes:
    zoom = dpi / 72.0
    width = page.rect.width * zoom
    height = page.rect.height * zoom
    longest = max(width, height)
    if longest > MAX_RENDER_SIDE:
        zoom *= MAX_RENDER_SIDE / longest
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    try:
        if image_format == "jpeg":
            return pix.tobytes("jpeg", jpg_quality=JPEG_QUALITY)
        return pix.tobytes("png")
    finally:
        pix = None


async def pdf_to_images(
    upload: UploadFile,
    image_format: str = "png",
    dpi: int = 150,
) -> tuple[Path, str, str]:
    filename = upload.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise PdfToImagesError(f"「{filename}」不是 PDF 文件")

    fmt = (image_format or "png").strip().lower()
    if fmt == "jpg":
        fmt = "jpeg"
    if fmt not in {"png", "jpeg"}:
        raise PdfToImagesError("图片格式无效")

    try:
        dpi_value = int(dpi)
    except (TypeError, ValueError) as e:
        raise PdfToImagesError("清晰度无效") from e
    if dpi_value not in ALLOWED_DPI:
        raise PdfToImagesError("清晰度无效")

    data = await upload.read()
    if not data:
        raise PdfToImagesError(f"「{filename}」是空文件")
    if len(data) > MAX_FILE_SIZE:
        raise PdfToImagesError(f"「{filename}」超过 50MB 限制")
    if not _validate_pdf_magic(data):
        raise PdfToImagesError(f"「{filename}」不是有效的 PDF")

    ext = "jpg" if fmt == "jpeg" else "png"
    media_image = "image/jpeg" if fmt == "jpeg" else "image/png"
    stem = _safe_stem(filename)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    doc = _open_pdf(data, filename)

    try:
        if doc.page_count == 1:
            out_name = f"{stem}-{stamp}.{ext}"
            out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
            out_path.write_bytes(_render_page(doc[0], dpi_value, fmt))
            return out_path, out_name, media_image

        out_name = f"{stem}-images-{stamp}.zip"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
        digits = max(3, len(str(doc.page_count)))
        with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for index, page in enumerate(doc, start=1):
                name = f"{stem}-{index:0{digits}d}.{ext}"
                zf.writestr(name, _render_page(page, dpi_value, fmt))
        return out_path, out_name, "application/zip"
    finally:
        doc.close()
