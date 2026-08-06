from __future__ import annotations

import re
import shutil
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import UploadFile

from app.config import MAX_FILE_SIZE, TEMP_DIR

TEXT_CHAR_THRESHOLD = 20
MAX_OCR_PAGES = 30
OCR_SCALE = 2.0

CJK_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\msyhbd.ttc",
]


class TextableError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class PageText:
    page: int
    text: str
    char_count: int
    source: str  # embedded | ocr


_ocr_engine = None


def _get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _ocr_engine = RapidOCR()
    return _ocr_engine


def _find_cjk_font() -> str | None:
    return next((p for p in CJK_FONT_CANDIDATES if Path(p).exists()), None)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


def _normalize_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def _save_upload(upload: UploadFile) -> tuple[str, Path]:
    filename = upload.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise TextableError(f"「{filename}」不是 PDF 文件")

    data = await upload.read()
    if len(data) == 0:
        raise TextableError(f"「{filename}」是空文件")
    if len(data) > MAX_FILE_SIZE:
        raise TextableError(f"「{filename}」超过 50MB 限制")
    if not _validate_pdf_magic(data):
        raise TextableError(f"「{filename}」不是有效的 PDF")

    path = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
    path.write_bytes(data)
    return filename, path


def _extract_embedded_text(page: fitz.Page) -> str:
    return _normalize_text(page.get_text("text") or "")


def _ocr_page(page: fitz.Page) -> str:
    mat = fitz.Matrix(OCR_SCALE, OCR_SCALE)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img_bytes = pix.tobytes("png")

    ocr = _get_ocr()
    result, _ = ocr(img_bytes)
    if not result:
        return ""

    lines: list[str] = []
    for entry in result:
        if not entry or len(entry) < 2:
            continue
        txt = entry[1]
        conf = float(entry[2]) if len(entry) > 2 else 1.0
        if not txt or not str(txt).strip() or conf < 0.35:
            continue
        lines.append(str(txt).strip())

    return _normalize_text("\n".join(lines))


def _build_plain_text_pdf(pages: list[PageText]) -> Path:
    """Create a compact selectable text PDF via fpdf2 (subsets CJK better)."""
    try:
        from fpdf import FPDF
    except ImportError as e:
        raise TextableError("缺少 fpdf2，无法生成文本 PDF") from e

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    fontfile = _find_cjk_font()
    if fontfile:
        pdf.add_font("cn", "", fontfile)
        font_name = "cn"
    else:
        font_name = "Helvetica"

    for pt in pages:
        pdf.add_page()
        pdf.set_font(font_name, size=11)
        content = pt.text or "（本页未识别到文字）"
        pdf.multi_cell(0, 8, f"【第 {pt.page} 页】\n{content}")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_name = f"copyable-{stamp}.pdf"
    out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
    pdf.output(str(out_path))
    return out_path


async def process_textable(upload: UploadFile, force_ocr: bool = False) -> dict:
    src_path: Path | None = None
    try:
        filename, src_path = await _save_upload(upload)
        doc = fitz.open(str(src_path))
        if doc.is_encrypted:
            try:
                if not doc.authenticate(""):
                    raise TextableError(f"「{filename}」已加密，请先解密后再上传")
            except TextableError:
                raise
            except Exception as e:
                raise TextableError(f"「{filename}」已加密，请先解密后再上传") from e

        page_count = doc.page_count
        if page_count == 0:
            raise TextableError("PDF 没有可处理的页面")
        if page_count > MAX_OCR_PAGES:
            raise TextableError(f"单次最多处理 {MAX_OCR_PAGES} 页，请拆分后再试")

        page_results: list[PageText] = []
        ocr_pages = 0
        embedded_pages = 0

        for i in range(page_count):
            page = doc[i]
            embedded = _extract_embedded_text(page)
            if not force_ocr and len(embedded) >= TEXT_CHAR_THRESHOLD:
                embedded_pages += 1
                page_results.append(
                    PageText(page=i + 1, text=embedded, char_count=len(embedded), source="embedded")
                )
                continue

            ocr_text = _ocr_page(page)
            ocr_pages += 1
            final_text = ocr_text if ocr_text else embedded
            page_results.append(
                PageText(
                    page=i + 1,
                    text=final_text,
                    char_count=len(final_text),
                    source="ocr" if ocr_text else ("embedded" if embedded else "ocr"),
                )
            )

        total_chars = sum(p.char_count for p in page_results)
        if total_chars == 0:
            doc.close()
            raise TextableError("未能识别到任何文字。请确认文件清晰，或尝试勾选「强制 OCR」")

        if ocr_pages and embedded_pages:
            method = "mixed"
        elif ocr_pages:
            method = "ocr"
        else:
            method = "embedded"
        already_selectable = ocr_pages == 0

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_name = f"copyable-{stamp}.pdf"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"

        if method == "embedded":
            # Keep original visuals & existing text layer
            doc.close()
            shutil.copy2(src_path, out_path)
        else:
            # OCR / mixed: prefer compact selectable text PDF (guaranteed copyable CJK)
            # Invisible overlay on image pages often embeds huge fonts; plaintext is reliable.
            doc.close()
            out_path = _build_plain_text_pdf(page_results)
            method = f"{method}+plaintext"
            out_name = f"copyable-{stamp}.pdf"

        token = uuid.uuid4().hex
        meta_path = TEMP_DIR / f"{token}.meta"
        meta_path.write_text(str(out_path), encoding="utf-8")

        return {
            "token": token,
            "fileName": out_name,
            "sourceFileName": filename,
            "pageCount": page_count,
            "totalChars": total_chars,
            "method": method,
            "alreadySelectable": already_selectable,
            "ocrPageCount": ocr_pages,
            "embeddedPageCount": embedded_pages,
            "pages": [
                {
                    "page": p.page,
                    "text": p.text,
                    "charCount": p.char_count,
                    "source": p.source,
                }
                for p in page_results
            ],
        }
    finally:
        if src_path is not None:
            try:
                src_path.unlink(missing_ok=True)
            except OSError:
                pass


def resolve_download(token: str) -> tuple[Path, str]:
    meta_path = TEMP_DIR / f"{token}.meta"
    if not meta_path.exists():
        raise TextableError("下载链接无效或已过期，请重新处理")
    out_path = Path(meta_path.read_text(encoding="utf-8").strip())
    if not out_path.exists():
        raise TextableError("文件已清理，请重新处理")
    name = out_path.name
    if "-" in name:
        parts = name.split("-", 1)
        if len(parts[0]) == 32:
            name = parts[1]
    return out_path, name
