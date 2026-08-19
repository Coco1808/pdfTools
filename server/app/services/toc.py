from __future__ import annotations

import re
import statistics
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import fitz
from fastapi import UploadFile

from app.config import MAX_FILE_SIZE, TEMP_DIR

MAX_PAGES = 200
MAX_TOC_ENTRIES = 200
MIN_HEADING_LEN = 2
MAX_HEADING_LEN = 80

CJK_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]


class TocError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class TocEntry:
    title: str
    page: int  # 1-based original page
    level: int  # 1..3
    source: str  # outline | heading | page


def _find_cjk_font() -> str | None:
    return next((p for p in CJK_FONT_CANDIDATES if Path(p).exists()), None)


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


async def _save_upload(upload: UploadFile) -> tuple[str, Path]:
    filename = upload.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise TocError(f"「{filename}」不是 PDF 文件")
    data = await upload.read()
    if not data:
        raise TocError(f"「{filename}」是空文件")
    if len(data) > MAX_FILE_SIZE:
        raise TocError(f"「{filename}」超过 500MB 限制")
    if not _validate_pdf_magic(data):
        raise TocError(f"「{filename}」不是有效的 PDF")
    path = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
    path.write_bytes(data)
    return filename, path


def _clean_title(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = text.strip(".-—_|·•●○▪▫◆◇\u00a0")
    text = text.strip()
    return text[:MAX_HEADING_LEN]


def _looks_like_heading(text: str) -> bool:
    if len(text) < MIN_HEADING_LEN or len(text) > MAX_HEADING_LEN:
        return False
    # Skip pure numbers / page footers
    if re.fullmatch(r"[\d\s./\-]+", text):
        return False
    patterns = [
        r"^第[一二三四五六七八九十百零〇\d]+[章节篇部回]",
        r"^Chapter\s+\d+",
        r"^CHAPTER\s+\d+",
        r"^附录",
        r"^目录",
        r"^\d+(\.\d+){0,3}\s+\S+",
        r"^[一二三四五六七八九十]+[、.．]\s*\S+",
        r"^[（(][一二三四五六七八九十\d]+[）)]\s*\S+",
    ]
    return any(re.search(p, text, re.I) for p in patterns)


def _entries_from_outline(doc: fitz.Document) -> list[TocEntry]:
    try:
        outline = doc.get_toc(simple=True)  # [level, title, page]
    except Exception:
        return []
    entries: list[TocEntry] = []
    for item in outline:
        if not item or len(item) < 3:
            continue
        level, title, page = int(item[0]), str(item[1]).strip(), int(item[2])
        title = _clean_title(title)
        if not title or page < 1:
            continue
        entries.append(
            TocEntry(title=title, page=min(page, doc.page_count), level=max(1, min(level, 3)), source="outline")
        )
    return entries[:MAX_TOC_ENTRIES]


def _collect_line_stats(doc: fitz.Document) -> list[tuple[int, str, float, float]]:
    """Return list of (page_1based, text, fontsize, y0)."""
    rows: list[tuple[int, str, float, float]] = []
    for i in range(doc.page_count):
        page = doc[i]
        data = page.get_text("dict")
        for block in data.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                text = _clean_title("".join(s.get("text", "") for s in spans))
                if not text:
                    continue
                size = max(float(s.get("size", 0)) for s in spans)
                y0 = float(line.get("bbox", [0, 0, 0, 0])[1])
                rows.append((i + 1, text, size, y0))
    return rows


def _entries_from_headings(doc: fitz.Document) -> list[TocEntry]:
    rows = _collect_line_stats(doc)
    if not rows:
        return []

    sizes = [r[2] for r in rows]
    try:
        body = statistics.median(sizes)
    except statistics.StatisticsError:
        body = 11.0
    body = max(body, 8.0)

    # Candidate thresholds for H1/H2/H3
    h1 = body * 1.45
    h2 = body * 1.25
    h3 = body * 1.12

    seen: set[tuple[str, int]] = set()
    entries: list[TocEntry] = []

    for page, text, size, _y0 in rows:
        level = 0
        if size >= h1 or (size >= body * 1.2 and _looks_like_heading(text)):
            level = 1 if size >= h1 else 2
        elif size >= h2 and (_looks_like_heading(text) or size >= body * 1.3):
            level = 2
        elif _looks_like_heading(text) and size >= h3:
            level = 3
        elif _looks_like_heading(text) and size >= body:
            level = 2
        else:
            continue

        key = (text, page)
        if key in seen:
            continue
        # Avoid dumping almost every line on title-heavy pages
        if len(text) > 60 and not _looks_like_heading(text):
            continue
        seen.add(key)
        if not text:
            continue
        entries.append(TocEntry(title=text, page=page, level=level, source="heading"))
        if len(entries) >= MAX_TOC_ENTRIES:
            break

    return entries


def _entries_from_pages(doc: fitz.Document) -> list[TocEntry]:
    """Fallback: first meaningful line of each page."""
    entries: list[TocEntry] = []
    for i in range(doc.page_count):
        page = doc[i]
        text = (page.get_text("text") or "").strip()
        if not text:
            title = f"第 {i + 1} 页"
        else:
            first = _clean_title(text.splitlines()[0])
            title = first if first else f"第 {i + 1} 页"
        entries.append(TocEntry(title=title, page=i + 1, level=1, source="page"))
        if len(entries) >= MAX_TOC_ENTRIES:
            break
    return entries


def detect_toc_entries(doc: fitz.Document) -> tuple[list[TocEntry], str]:
    outline = _entries_from_outline(doc)
    if len(outline) >= 2:
        return outline, "outline"

    headings = _entries_from_headings(doc)
    if len(headings) >= 2:
        return headings, "heading"

    if outline:
        return outline, "outline"
    if headings:
        return headings, "heading"

    return _entries_from_pages(doc), "page"


def _estimate_toc_pages(entry_count: int) -> int:
    # Roughly 28 entries per A4-ish page with title
    per_page = 26
    return max(1, (entry_count + per_page - 1) // per_page)


def _insert_toc_pages(doc: fitz.Document, entries: list[TocEntry]) -> int:
    """Insert TOC pages at start with goto links. Returns toc page count."""
    if not entries:
        raise TocError("没有可用的目录条目")

    toc_pages = _estimate_toc_pages(len(entries))
    ref = doc[0].rect
    width, height = ref.width, ref.height

    for _ in range(toc_pages):
        doc.new_page(pno=0, width=width, height=height)

    # Built-in CJK font name — not embedded, keeps file small
    fontname = "china-s"
    margin_x = width * 0.08
    top = height * 0.08
    bottom = height * 0.08
    line_h = min(22, (height - top - bottom - 40) / 28)
    title_size = min(22, width * 0.04)
    body_size = min(12, line_h * 0.7)

    idx = 0
    for toc_i in range(toc_pages):
        page = doc[toc_i]
        heading = "目录" if toc_i == 0 else f"目录（续 {toc_i + 1}）"
        try:
            page.insert_text(
                (margin_x, top + title_size),
                heading,
                fontsize=title_size,
                fontname=fontname,
                color=(0.08, 0.25, 0.2),
            )
        except Exception:
            # Fallback if built-in CJK unavailable
            page.insert_text(
                (margin_x, top + title_size),
                "Table of Contents" if toc_i == 0 else f"TOC ({toc_i + 1})",
                fontsize=title_size,
                fontname="helv",
                color=(0.08, 0.25, 0.2),
            )
            fontname = "helv"

        y = top + title_size + line_h * 1.4
        while idx < len(entries) and y < height - bottom - line_h:
            entry = entries[idx]
            indent = (entry.level - 1) * 16
            target_page_0 = entry.page - 1 + toc_pages
            label = entry.title[:48]
            page_label = str(entry.page)
            text_x = margin_x + indent

            page.insert_text(
                (text_x, y),
                label,
                fontsize=body_size,
                fontname=fontname,
                color=(0.1, 0.12, 0.11),
            )
            page.insert_text(
                (width - margin_x - 28, y),
                page_label,
                fontsize=body_size,
                fontname="helv",
                color=(0.25, 0.35, 0.3),
            )
            dots_x = text_x + body_size * min(len(label), 40) * 0.55 + 8
            right = width - margin_x - 36
            if dots_x < right:
                page.insert_text(
                    (dots_x, y),
                    "." * max(3, int((right - dots_x) / 3)),
                    fontsize=body_size * 0.85,
                    fontname="helv",
                    color=(0.65, 0.7, 0.68),
                )

            link_rect = fitz.Rect(margin_x, y - body_size, width - margin_x, y + 4)
            page.insert_link(
                {
                    "kind": fitz.LINK_GOTO,
                    "from": link_rect,
                    "page": target_page_0,
                    "to": fitz.Point(0, 0),
                }
            )
            y += line_h
            idx += 1

    return toc_pages


def _set_bookmarks(doc: fitz.Document, entries: list[TocEntry], toc_pages: int) -> None:
    toc = [[1, "目录", 1]]
    for e in entries:
        toc.append([e.level, e.title, e.page + toc_pages])
    try:
        doc.set_toc(toc)
    except Exception:
        pass


async def generate_toc(upload: UploadFile) -> dict:
    src_path: Path | None = None
    try:
        filename, src_path = await _save_upload(upload)
        doc = fitz.open(str(src_path))
        if doc.is_encrypted:
            try:
                if not doc.authenticate(""):
                    raise TocError(f"「{filename}」已加密，请先解密后再上传")
            except TocError:
                raise
            except Exception as e:
                raise TocError(f"「{filename}」已加密，请先解密后再上传") from e

        original_pages = doc.page_count
        if original_pages == 0:
            raise TocError("PDF 没有可处理的页面")
        if original_pages > MAX_PAGES:
            raise TocError(f"单次最多处理 {MAX_PAGES} 页")

        entries, method = detect_toc_entries(doc)
        entries = [e for e in entries if e.title and e.title.strip()]
        if not entries:
            raise TocError("未能生成目录条目，请确认 PDF 含有文字内容")

        toc_pages = _insert_toc_pages(doc, entries)
        _set_bookmarks(doc, entries, toc_pages)

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_name = f"toc-{stamp}.pdf"
        out_path = TEMP_DIR / f"{uuid.uuid4().hex}-{out_name}"
        final_pages = doc.page_count
        doc.save(str(out_path), garbage=3, deflate=True)
        doc.close()

        token = uuid.uuid4().hex
        (TEMP_DIR / f"{token}.meta").write_text(str(out_path), encoding="utf-8")

        return {
            "token": token,
            "fileName": out_name,
            "sourceFileName": filename,
            "originalPageCount": original_pages,
            "finalPageCount": final_pages,
            "tocPageCount": toc_pages,
            "entryCount": len(entries),
            "method": method,
            "entries": [
                {"title": e.title, "page": e.page, "level": e.level, "source": e.source}
                for e in entries
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
        raise TocError("下载链接无效或已过期，请重新处理")
    out_path = Path(meta_path.read_text(encoding="utf-8").strip())
    if not out_path.exists():
        raise TocError("文件已清理，请重新处理")
    name = out_path.name
    if "-" in name:
        parts = name.split("-", 1)
        if len(parts[0]) == 32:
            name = parts[1]
    return out_path, name
