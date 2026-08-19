from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError

from app.config import MAX_FILE_SIZE, MAX_FILES, MAX_TOTAL_SIZE, TEMP_DIR


class MergeError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


async def merge_pdfs(files: list[UploadFile]) -> tuple[Path, str]:
    if not files:
        raise MergeError("请至少上传一个 PDF 文件")
    if len(files) > MAX_FILES:
        raise MergeError(f"单次最多上传 {MAX_FILES} 个文件")

    writer = PdfWriter()
    total_size = 0
    saved_paths: list[Path] = []

    try:
        for upload in files:
            filename = upload.filename or "unknown.pdf"
            if not filename.lower().endswith(".pdf"):
                raise MergeError(f"「{filename}」不是 PDF 文件，请重新选择")

            data = await upload.read()
            size = len(data)
            if size == 0:
                raise MergeError(f"「{filename}」是空文件")
            if size > MAX_FILE_SIZE:
                raise MergeError(f"「{filename}」超过 500MB 限制")
            total_size += size
            if total_size > MAX_TOTAL_SIZE:
                raise MergeError("全部文件合计超过 500MB 限制")
            if not _validate_pdf_magic(data):
                raise MergeError(f"「{filename}」不是有效的 PDF（文件头校验失败）")

            temp_in = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
            temp_in.write_bytes(data)
            saved_paths.append(temp_in)

            try:
                reader = PdfReader(str(temp_in))
            except PdfReadError as e:
                raise MergeError(f"「{filename}」无法读取，文件可能已损坏") from e

            if reader.is_encrypted:
                try:
                    if reader.decrypt("") == 0:
                        raise MergeError(f"「{filename}」已加密，请先解密后再上传")
                except MergeError:
                    raise
                except Exception as e:
                    raise MergeError(f"「{filename}」已加密，请先解密后再上传") from e

            for page in reader.pages:
                writer.add_page(page)

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_name = f"merged-{stamp}.pdf"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
        with out_path.open("wb") as f:
            writer.write(f)

        return out_path, out_name
    finally:
        for p in saved_paths:
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
