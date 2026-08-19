from __future__ import annotations

import re
import uuid
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path

import fitz
from fastapi import UploadFile

from app.config import MAX_FILE_SIZE, TEMP_DIR


class SplitError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


async def _save_upload(upload: UploadFile) -> tuple[str, Path, bytes]:
    filename = upload.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise SplitError(f"「{filename}」不是 PDF 文件")
    data = await upload.read()
    if not data:
        raise SplitError(f"「{filename}」是空文件")
    if len(data) > MAX_FILE_SIZE:
        raise SplitError(f"「{filename}」超过 500MB 限制")
    if not _validate_pdf_magic(data):
        raise SplitError(f"「{filename}」不是有效的 PDF")
    path = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
    path.write_bytes(data)
    return filename, path, data


def _open_doc(path: Path, filename: str) -> fitz.Document:
    try:
        doc = fitz.open(str(path))
    except Exception as e:
        raise SplitError(f"「{filename}」无法读取，文件可能已损坏") from e
    if doc.is_encrypted:
        try:
            if not doc.authenticate(""):
                raise SplitError(f"「{filename}」已加密，请先解密后再上传")
        except SplitError:
            raise
        except Exception as e:
            raise SplitError(f"「{filename}」已加密，请先解密后再上传") from e
    if doc.page_count == 0:
        raise SplitError("PDF 没有可处理的页面")
    return doc


def parse_ranges(spec: str, page_count: int) -> list[tuple[int, int]]:
    """Parse '1-3,5,7-9' into 1-based inclusive ranges."""
    spec = (spec or "").strip()
    if not spec:
        raise SplitError("请填写页码范围，例如 1-3,5,8-10")
    ranges: list[tuple[int, int]] = []
    for part in re.split(r"[,，;\s]+", spec):
        part = part.strip()
        if not part:
            continue
        if "-" in part or "–" in part or "—" in part:
            part = part.replace("–", "-").replace("—", "-")
            a, b = part.split("-", 1)
            try:
                start, end = int(a.strip()), int(b.strip())
            except ValueError as e:
                raise SplitError(f"无效页码范围：{part}") from e
        else:
            try:
                start = end = int(part)
            except ValueError as e:
                raise SplitError(f"无效页码：{part}") from e
        if start > end:
            start, end = end, start
        if start < 1 or end > page_count:
            raise SplitError(f"页码超出范围（1-{page_count}）：{part}")
        ranges.append((start, end))
    if not ranges:
        raise SplitError("请填写有效的页码范围")
    return ranges


def _ranges_every_n(page_count: int, every_n: int) -> list[tuple[int, int]]:
    if every_n < 1:
        raise SplitError("每份页数至少为 1")
    ranges: list[tuple[int, int]] = []
    start = 1
    while start <= page_count:
        end = min(page_count, start + every_n - 1)
        ranges.append((start, end))
        start = end + 1
    return ranges


async def split_pdf(
    upload: UploadFile,
    mode: str = "range",
    ranges: str = "",
    every_n: int = 1,
) -> dict:
    src_path: Path | None = None
    try:
        filename, src_path, _ = await _save_upload(upload)
        doc = _open_doc(src_path, filename)
        page_count = doc.page_count

        if mode == "every":
            parts = _ranges_every_n(page_count, every_n)
        else:
            parts = parse_ranges(ranges, page_count)

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        zip_name = f"split-{stamp}.zip"
        zip_path = TEMP_DIR / f"{uuid.uuid4().hex}-{zip_name}"

        stem = Path(filename).stem or "document"
        files_meta: list[dict] = []

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for i, (start, end) in enumerate(parts, start=1):
                out = fitz.open()
                out.insert_pdf(doc, from_page=start - 1, to_page=end - 1)
                buf = BytesIO()
                out.save(buf, garbage=3, deflate=True)
                out.close()
                part_name = f"{stem}_p{start}-{end}.pdf" if start != end else f"{stem}_p{start}.pdf"
                zf.writestr(part_name, buf.getvalue())
                files_meta.append(
                    {
                        "fileName": part_name,
                        "fromPage": start,
                        "toPage": end,
                        "pageCount": end - start + 1,
                    }
                )

        doc.close()

        token = uuid.uuid4().hex
        (TEMP_DIR / f"{token}.meta").write_text(str(zip_path), encoding="utf-8")

        return {
            "token": token,
            "fileName": zip_name,
            "sourceFileName": filename,
            "pageCount": page_count,
            "partCount": len(parts),
            "mode": mode,
            "parts": files_meta,
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
        raise SplitError("下载链接无效或已过期，请重新处理")
    out_path = Path(meta_path.read_text(encoding="utf-8").strip())
    if not out_path.exists():
        raise SplitError("文件已清理，请重新处理")
    name = out_path.name
    if "-" in name:
        parts = name.split("-", 1)
        if len(parts[0]) == 32:
            name = parts[1]
    return out_path, name
