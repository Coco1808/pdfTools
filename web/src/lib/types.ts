export const MAX_FILES = 20
export const MAX_FILE_SIZE = 500 * 1024 * 1024
export const MAX_TOTAL_SIZE = 500 * 1024 * 1024
export const MAX_PDF_PAGES = 1000

export const INVOICE_TYPES = [
  '增值税专用发票',
  '增值税普通发票',
  '电子发票（专用）',
  '电子发票（普通）',
  '火车票',
  '行程单',
  '其他',
] as const

export type InvoiceType = (typeof INVOICE_TYPES)[number]

export interface PdfFileItem {
  id: string
  file: File
  name: string
  size: number
}

export type InvoiceStatus = 'success' | 'failed' | 'review'

export interface InvoiceItem {
  id: string
  fileName: string
  invoiceType: string
  amount: number | null
  invoiceNumber: string | null
  invoiceDate: string | null
  sellerName: string | null
  confidence: number
  status: InvoiceStatus
  message?: string | null
  duplicate?: boolean
}

export interface InvoiceSummaryRow {
  invoiceType: string
  count: number
  totalAmount: number
}

export interface InvoiceAnalyzeResult {
  items: InvoiceItem[]
  summary: InvoiceSummaryRow[]
  grandTotal: number
  successCount: number
  failedCount: number
  duplicateNumbers: string[]
}

export interface TextablePageResult {
  page: number
  text: string
  charCount: number
  source: 'embedded' | 'ocr' | string
}

export interface TextableProcessResult {
  token: string
  fileName: string
  sourceFileName: string
  pageCount: number
  totalChars: number
  method: string
  alreadySelectable: boolean
  ocrPageCount: number
  embeddedPageCount: number
  pages: TextablePageResult[]
}

export interface TocEntry {
  title: string
  page: number
  level: number
  source: string
}

export interface TocGenerateResult {
  token: string
  fileName: string
  sourceFileName: string
  originalPageCount: number
  finalPageCount: number
  tocPageCount: number
  entryCount: number
  method: string
  entries: TocEntry[]
}

export interface SplitPart {
  fileName: string
  fromPage: number
  toPage: number
  pageCount: number
}

export interface SplitResult {
  token: string
  fileName: string
  sourceFileName: string
  pageCount: number
  partCount: number
  mode: string
  parts: SplitPart[]
}

export interface CompressResult {
  token: string
  fileName: string
  sourceFileName: string
  pageCount: number
  quality: string
  originalSize: number
  compressedSize: number
  savedRatio: number
  note: string
}

export interface WatermarkResult {
  token: string
  fileName: string
  sourceFileName: string
  pageCount: number
  text: string
  opacity: number
  angle: number
  fontSize: number
  tile: boolean
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function validatePdfFiles(
  incoming: File[],
  existingCount = 0,
  existingSize = 0,
): { ok: File[]; errors: string[] } {
  return validateNamedFiles(incoming, existingCount, existingSize, isPdfFile, '不是 PDF 文件')
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tif', '.tiff']
const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/gif',
  'image/tiff',
]

function isPdfFile(file: File) {
  return file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
}

function isImageFile(file: File) {
  const name = file.name.toLowerCase()
  return IMAGE_EXTS.some((ext) => name.endsWith(ext)) || IMAGE_TYPES.includes(file.type)
}

export function validateImageFiles(
  incoming: File[],
  existingCount = 0,
  existingSize = 0,
): { ok: File[]; errors: string[] } {
  return validateNamedFiles(incoming, existingCount, existingSize, isImageFile, '不是支持的图片格式')
}

function validateNamedFiles(
  incoming: File[],
  existingCount: number,
  existingSize: number,
  isAllowed: (file: File) => boolean,
  invalidMessage: string,
): { ok: File[]; errors: string[] } {
  const errors: string[] = []
  const ok: File[] = []
  let count = existingCount
  let size = existingSize

  for (const file of incoming) {
    if (!isAllowed(file)) {
      errors.push(`「${file.name}」${invalidMessage}`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`「${file.name}」超过 500MB 限制`)
      continue
    }
    if (count + 1 > MAX_FILES) {
      errors.push(`单次最多上传 ${MAX_FILES} 个文件`)
      break
    }
    if (size + file.size > MAX_TOTAL_SIZE) {
      errors.push('全部文件合计超过 500MB 限制')
      break
    }
    ok.push(file)
    count += 1
    size += file.size
  }

  return { ok, errors }
}
