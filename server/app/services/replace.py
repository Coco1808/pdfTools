from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError

from app.config import MAX_FILE_SIZE, TEMP_DIR


class ReplaceError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


async def _read_pdf_upload(upload: UploadFile, label: str) -> tuple[bytes, str, Path]:
    filename = upload.filename or f"{label}.pdf"
    if not filename.lower().endswith(".pdf"):
        raise ReplaceError(f"「{filename}」不是 PDF 文件")

    data = await upload.read()
    if len(data) == 0:
        raise ReplaceError(f"「{filename}」是空文件")
    if len(data) > MAX_FILE_SIZE:
        raise ReplaceError(f"「{filename}」超过 50MB 限制")
    if not _validate_pdf_magic(data):
        raise ReplaceError(f"「{filename}」不是有效的 PDF")

    path = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
    path.write_bytes(data)
    return data, filename, path


def _open_reader(path: Path, filename: str) -> PdfReader:
    try:
        reader = PdfReader(str(path))
    except PdfReadError as e:
        raise ReplaceError(f"「{filename}」无法读取，文件可能已损坏") from e

    if reader.is_encrypted:
        try:
            if reader.decrypt("") == 0:
                raise ReplaceError(f"「{filename}」已加密，请先解密后再上传")
        except ReplaceError:
            raise
        except Exception as e:
            raise ReplaceError(f"「{filename}」已加密，请先解密后再上传") from e

    if len(reader.pages) == 0:
        raise ReplaceError(f"「{filename}」没有可处理的页面")

    return reader


async def get_pdf_info(upload: UploadFile) -> dict:
    path: Path | None = None
    try:
        _, filename, path = await _read_pdf_upload(upload, "source")
        reader = _open_reader(path, filename)
        return {
            "fileName": filename,
            "pageCount": len(reader.pages),
        }
    finally:
        if path is not None:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass


async def replace_page(
    source: UploadFile,
    replacement: UploadFile,
    page_number: int,
    replacement_page_number: int = 1,
) -> tuple[Path, str]:
    """Replace 1-based page_number in source with 1-based page from replacement."""
    if page_number < 1:
        raise ReplaceError("要替换的页码必须从 1 开始")
    if replacement_page_number < 1:
        raise ReplaceError("替换页的页码必须从 1 开始")

    saved: list[Path] = []
    try:
        _, source_name, source_path = await _read_pdf_upload(source, "source")
        saved.append(source_path)
        _, repl_name, repl_path = await _read_pdf_upload(replacement, "replacement")
        saved.append(repl_path)

        source_reader = _open_reader(source_path, source_name)
        repl_reader = _open_reader(repl_path, repl_name)

        source_count = len(source_reader.pages)
        repl_count = len(repl_reader.pages)

        if page_number > source_count:
            raise ReplaceError(f"原文档共 {source_count} 页，无法替换第 {page_number} 页")
        if replacement_page_number > repl_count:
            raise ReplaceError(
                f"替换文件共 {repl_count} 页，无法使用第 {replacement_page_number} 页"
            )

        writer = PdfWriter()
        target_index = page_number - 1
        repl_index = replacement_page_number - 1

        for i, page in enumerate(source_reader.pages):
            if i == target_index:
                writer.add_page(repl_reader.pages[repl_index])
            else:
                writer.add_page(page)

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_name = f"replaced-{stamp}.pdf"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
        with out_path.open("wb") as f:
            writer.write(f)

        return out_path, out_name
    finally:
        for p in saved:
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
