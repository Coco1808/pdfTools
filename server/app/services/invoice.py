from __future__ import annotations

import re
import uuid
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import pdfplumber
from fastapi import UploadFile
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.config import MAX_FILE_SIZE, MAX_FILES, MAX_TOTAL_SIZE, TEMP_DIR

INVOICE_TYPES = [
    "增值税专用发票",
    "增值税普通发票",
    "电子发票（专用）",
    "电子发票（普通）",
    "火车票",
    "行程单",
    "其他",
]


class InvoiceError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class InvoiceItem:
    id: str
    file_name: str
    invoice_type: str
    amount: float | None
    invoice_number: str | None
    invoice_date: str | None
    seller_name: str | None
    confidence: float
    status: str  # success | failed | review
    message: str | None = None


def _validate_pdf_magic(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


def _extract_text(path: Path) -> str:
    texts: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            texts.append(t)
    return "\n".join(texts)


def _parse_amount(text: str) -> tuple[float | None, float]:
    """Return (amount, confidence_boost). Prefer 价税合计."""
    patterns = [
        (r"价税合计[（(]?小写[）)]?[：:\s]*[￥¥]?\s*([0-9,]+\.?[0-9]*)", 0.35),
        (r"价税合计[：:\s]*[￥¥]?\s*([0-9,]+\.?[0-9]*)", 0.3),
        (r"[（(]小写[）)][：:\s]*[￥¥]?\s*([0-9,]+\.?[0-9]*)", 0.25),
        (r"合计[：:\s]*[￥¥]?\s*([0-9,]+\.?[0-9]*)", 0.15),
        (r"[￥¥]\s*([0-9,]+\.\d{2})", 0.1),
    ]
    for pattern, boost in patterns:
        m = re.search(pattern, text)
        if m:
            raw = m.group(1).replace(",", "")
            try:
                return float(raw), boost
            except ValueError:
                continue

    # amount + tax
    amount_m = re.search(r"(?<![价税合])金额[：:\s]*[￥¥]?\s*([0-9,]+\.?[0-9]*)", text)
    tax_m = re.search(r"税额[：:\s]*[￥¥]?\s*([0-9,]+\.?[0-9]*)", text)
    if amount_m and tax_m:
        try:
            a = float(amount_m.group(1).replace(",", ""))
            t = float(tax_m.group(1).replace(",", ""))
            return round(a + t, 2), 0.2
        except ValueError:
            pass

    return None, 0.0


def _parse_type(text: str) -> tuple[str, float]:
    rules = [
        (r"电子发票[（(]专用发票?[）)]|电子专用发票", "电子发票（专用）", 0.35),
        (r"电子发票[（(]普通发票?[）)]|电子普通发票", "电子发票（普通）", 0.35),
        (r"增值税电子专用发票", "电子发票（专用）", 0.35),
        (r"增值税电子普通发票", "电子发票（普通）", 0.35),
        (r"电子发票", "电子发票（普通）", 0.2),
        (r"增值税专用发票", "增值税专用发票", 0.3),
        (r"增值税普通发票", "增值税普通发票", 0.3),
        (r"专用发票", "增值税专用发票", 0.2),
        (r"普通发票", "增值税普通发票", 0.15),
        (r"火车票|铁路客票", "火车票", 0.35),
        (r"行程单|航空运输电子客票", "行程单", 0.35),
    ]
    for pattern, itype, boost in rules:
        if re.search(pattern, text):
            return itype, boost
    return "其他", 0.0


def _parse_number(text: str) -> str | None:
    patterns = [
        r"发票号码[：:\s]*([0-9]{8,20})",
        r"号码[：:\s]*([0-9]{8,20})",
        r"No\.?\s*([0-9]{8,20})",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1)
    return None


def _parse_date(text: str) -> str | None:
    patterns = [
        r"开票日期[：:\s]*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
        r"开票日期[：:\s]*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})",
        r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            y, mo, d = m.group(1), int(m.group(2)), int(m.group(3))
            return f"{y}-{mo:02d}-{d:02d}"
    return None


def _parse_seller(text: str) -> str | None:
    patterns = [
        r"销售方[信息]*[：:\s\n]*名称[：:\s]*([^\n\r]{2,40})",
        r"销\s*售\s*方[：:\s]*([^\n\r]{2,40})",
        r"卖方[：:\s]*([^\n\r]{2,40})",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            name = m.group(1).strip()
            name = re.sub(r"\s+", "", name)
            name = re.split(r"[纳税人识别号|地址|电话|开户]", name)[0]
            if 2 <= len(name) <= 40:
                return name
    return None


def parse_invoice_text(text: str, file_name: str) -> InvoiceItem:
    item_id = str(uuid.uuid4())
    if not text or not text.strip():
        return InvoiceItem(
            id=item_id,
            file_name=file_name,
            invoice_type="其他",
            amount=None,
            invoice_number=None,
            invoice_date=None,
            seller_name=None,
            confidence=0.0,
            status="failed",
            message="未能提取文本，可能是扫描件，请手动填写",
        )

    confidence = 0.3
    itype, type_boost = _parse_type(text)
    confidence += type_boost

    amount, amount_boost = _parse_amount(text)
    confidence += amount_boost

    number = _parse_number(text)
    if number:
        confidence += 0.1

    date = _parse_date(text)
    if date:
        confidence += 0.05

    seller = _parse_seller(text)
    if seller:
        confidence += 0.05

    confidence = min(round(confidence, 2), 0.99)

    if amount is None:
        return InvoiceItem(
            id=item_id,
            file_name=file_name,
            invoice_type=itype,
            amount=None,
            invoice_number=number,
            invoice_date=date,
            seller_name=seller,
            confidence=confidence,
            status="failed",
            message="未能识别金额，请手动填写",
        )

    status = "success"
    if confidence < 0.55 or itype == "其他":
        status = "review"

    return InvoiceItem(
        id=item_id,
        file_name=file_name,
        invoice_type=itype,
        amount=round(amount, 2),
        invoice_number=number,
        invoice_date=date,
        seller_name=seller,
        confidence=confidence,
        status=status,
        message="置信度较低，建议核对" if status == "review" else None,
    )


async def analyze_invoices(files: list[UploadFile]) -> dict:
    if not files:
        raise InvoiceError("请至少上传一个 PDF 文件")
    if len(files) > MAX_FILES:
        raise InvoiceError(f"单次最多上传 {MAX_FILES} 个文件")

    items: list[InvoiceItem] = []
    total_size = 0
    saved: list[Path] = []

    try:
        for upload in files:
            filename = upload.filename or "unknown.pdf"
            if not filename.lower().endswith(".pdf"):
                raise InvoiceError(f"「{filename}」不是 PDF 文件")

            data = await upload.read()
            size = len(data)
            if size == 0:
                raise InvoiceError(f"「{filename}」是空文件")
            if size > MAX_FILE_SIZE:
                raise InvoiceError(f"「{filename}」超过 50MB 限制")
            total_size += size
            if total_size > MAX_TOTAL_SIZE:
                raise InvoiceError("全部文件合计超过 100MB 限制")
            if not _validate_pdf_magic(data):
                raise InvoiceError(f"「{filename}」不是有效的 PDF")

            temp_path = TEMP_DIR / f"{uuid.uuid4().hex}.pdf"
            temp_path.write_bytes(data)
            saved.append(temp_path)

            try:
                reader = PdfReader(str(temp_path))
                if reader.is_encrypted:
                    try:
                        if reader.decrypt("") == 0:
                            items.append(
                                InvoiceItem(
                                    id=str(uuid.uuid4()),
                                    file_name=filename,
                                    invoice_type="其他",
                                    amount=None,
                                    invoice_number=None,
                                    invoice_date=None,
                                    seller_name=None,
                                    confidence=0.0,
                                    status="failed",
                                    message="文件已加密，请先解密或手动填写",
                                )
                            )
                            continue
                    except Exception:
                        items.append(
                            InvoiceItem(
                                id=str(uuid.uuid4()),
                                file_name=filename,
                                invoice_type="其他",
                                amount=None,
                                invoice_number=None,
                                invoice_date=None,
                                seller_name=None,
                                confidence=0.0,
                                status="failed",
                                message="文件已加密，请先解密或手动填写",
                            )
                        )
                        continue
            except PdfReadError:
                items.append(
                    InvoiceItem(
                        id=str(uuid.uuid4()),
                        file_name=filename,
                        invoice_type="其他",
                        amount=None,
                        invoice_number=None,
                        invoice_date=None,
                        seller_name=None,
                        confidence=0.0,
                        status="failed",
                        message="文件损坏，无法读取",
                    )
                )
                continue

            try:
                text = _extract_text(temp_path)
            except Exception:
                text = ""

            items.append(parse_invoice_text(text, filename))

        # duplicate invoice numbers
        number_count: dict[str, int] = defaultdict(int)
        for it in items:
            if it.invoice_number:
                number_count[it.invoice_number] += 1
        duplicates = {n for n, c in number_count.items() if c > 1}

        summary_map: dict[str, dict] = {}
        grand_total = 0.0
        success_count = 0
        failed_count = 0

        for it in items:
            if it.status == "failed" or it.amount is None:
                failed_count += 1
                continue
            success_count += 1
            grand_total += it.amount
            bucket = summary_map.setdefault(
                it.invoice_type, {"invoiceType": it.invoice_type, "count": 0, "totalAmount": 0.0}
            )
            bucket["count"] += 1
            bucket["totalAmount"] = round(bucket["totalAmount"] + it.amount, 2)

        # keep type order
        ordered = []
        for t in INVOICE_TYPES:
            if t in summary_map:
                ordered.append(summary_map[t])
        for t, v in summary_map.items():
            if t not in INVOICE_TYPES:
                ordered.append(v)

        return {
            "items": [
                {
                    "id": it.id,
                    "fileName": it.file_name,
                    "invoiceType": it.invoice_type,
                    "amount": it.amount,
                    "invoiceNumber": it.invoice_number,
                    "invoiceDate": it.invoice_date,
                    "sellerName": it.seller_name,
                    "confidence": it.confidence,
                    "status": it.status,
                    "message": it.message,
                    "duplicate": bool(it.invoice_number and it.invoice_number in duplicates),
                }
                for it in items
            ],
            "summary": ordered,
            "grandTotal": round(grand_total, 2),
            "successCount": success_count,
            "failedCount": failed_count,
            "duplicateNumbers": sorted(duplicates),
        }
    finally:
        for p in saved:
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
