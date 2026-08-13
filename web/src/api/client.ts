import type {
  CompressResult,
  InvoiceAnalyzeResult,
  SplitResult,
  TextableProcessResult,
  TocGenerateResult,
  WatermarkResult,
} from '../lib/types'

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) {
      return data.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('；') || '请求失败'
    }
    return String(data?.detail || data?.message || `请求失败（${res.status}）`)
  } catch {
    return `请求失败（${res.status}）`
  }
}

export async function translateNaming(text: string): Promise<{
  source: string
  english: string
  words: string[]
}> {
  const res = await fetch('/api/naming/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return res.json()
}

export async function mergePdfs(files: File[]): Promise<{ blob: Blob; fileName: string }> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))

  const res = await fetch('/api/merge', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(await readError(res))
  }

  const disposition = res.headers.get('content-disposition') || ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition)
  const fileName = match ? decodeURIComponent(match[1]) : `merged-${Date.now()}.pdf`
  const blob = await res.blob()
  return { blob, fileName }
}

export async function getPdfInfo(file: File): Promise<{ fileName: string; pageCount: number }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/pdf/info', { method: 'POST', body: form })
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return res.json()
}

export async function replacePdfPage(params: {
  source: File
  replacement: File
  pageNumber: number
  replacementPageNumber?: number
}): Promise<{ blob: Blob; fileName: string }> {
  const form = new FormData()
  form.append('source', params.source)
  form.append('replacement', params.replacement)
  form.append('page_number', String(params.pageNumber))
  form.append('replacement_page_number', String(params.replacementPageNumber ?? 1))

  const res = await fetch('/api/replace', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(await readError(res))
  }

  const disposition = res.headers.get('content-disposition') || ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition)
  const fileName = match ? decodeURIComponent(match[1]) : `replaced-${Date.now()}.pdf`
  const blob = await res.blob()
  return { blob, fileName }
}

export async function analyzeInvoices(files: File[]): Promise<InvoiceAnalyzeResult> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))

  const res = await fetch('/api/invoice/analyze', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(await readError(res))
  }

  return res.json()
}

export async function processTextable(
  file: File,
  forceOcr = false,
): Promise<TextableProcessResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('force_ocr', String(forceOcr))

  const res = await fetch('/api/textable/process', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(await readError(res))
  }

  return res.json()
}

export async function downloadTextable(token: string, fileName: string) {
  const res = await fetch(`/api/textable/download/${token}`)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  const blob = await res.blob()
  downloadBlob(blob, fileName)
}

export async function generateToc(file: File): Promise<TocGenerateResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/toc/generate', { method: 'POST', body: form })
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return res.json()
}

export async function downloadToc(token: string, fileName: string) {
  const res = await fetch(`/api/toc/download/${token}`)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  const blob = await res.blob()
  downloadBlob(blob, fileName)
}

export async function splitPdf(params: {
  file: File
  mode: 'range' | 'every'
  ranges?: string
  everyN?: number
}): Promise<SplitResult> {
  const form = new FormData()
  form.append('file', params.file)
  form.append('mode', params.mode)
  form.append('ranges', params.ranges || '')
  form.append('every_n', String(params.everyN ?? 1))
  const res = await fetch('/api/split', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function downloadSplit(token: string, fileName: string) {
  const res = await fetch(`/api/split/download/${token}`)
  if (!res.ok) throw new Error(await readError(res))
  downloadBlob(await res.blob(), fileName)
}

export async function compressPdf(file: File, quality: string): Promise<CompressResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('quality', quality)
  const res = await fetch('/api/compress', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function downloadCompress(token: string, fileName: string) {
  const res = await fetch(`/api/compress/download/${token}`)
  if (!res.ok) throw new Error(await readError(res))
  downloadBlob(await res.blob(), fileName)
}

export async function watermarkPdf(params: {
  file: File
  text: string
  opacity: number
  angle: number
  fontSize: number
  tile: boolean
}): Promise<WatermarkResult> {
  const form = new FormData()
  form.append('file', params.file)
  form.append('text', params.text)
  form.append('opacity', String(params.opacity))
  form.append('angle', String(params.angle))
  form.append('font_size', String(params.fontSize))
  form.append('tile', String(params.tile))
  const res = await fetch('/api/watermark', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function downloadWatermark(token: string, fileName: string) {
  const res = await fetch(`/api/watermark/download/${token}`)
  if (!res.ok) throw new Error(await readError(res))
  downloadBlob(await res.blob(), fileName)
}

export async function pdfToImages(
  file: File,
  imageFormat: 'png' | 'jpeg' = 'png',
  dpi: 72 | 150 | 300 = 150,
): Promise<{ blob: Blob; fileName: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('image_format', imageFormat)
  form.append('dpi', String(dpi))

  const res = await fetch('/api/pdf-to-images', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error(await readError(res))
  }

  const disposition = res.headers.get('content-disposition') || ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition)
  const fileName = match ? decodeURIComponent(match[1]) : `pdf-images-${Date.now()}.zip`
  return { blob: await res.blob(), fileName }
}

export async function imagesToPdf(
  files: File[],
  pageMode: 'a4' | 'original' = 'a4',
): Promise<{ blob: Blob; fileName: string }> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  form.append('page_mode', pageMode)

  const res = await fetch('/api/images-to-pdf', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error(await readError(res))
  }

  const disposition = res.headers.get('content-disposition') || ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition)
  const fileName = match ? decodeURIComponent(match[1]) : `images-${Date.now()}.pdf`
  return { blob: await res.blob(), fileName }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportInvoicesCsv(
  items: {
    fileName: string
    invoiceType: string
    amount: number | null
    invoiceNumber: string | null
    invoiceDate: string | null
    sellerName: string | null
    status: string
  }[],
) {
  const header = ['文件名', '发票类型', '金额', '发票号码', '开票日期', '销售方', '状态']
  const rows = items.map((it) => [
    it.fileName,
    it.invoiceType,
    it.amount == null ? '' : it.amount.toFixed(2),
    it.invoiceNumber || '',
    it.invoiceDate || '',
    it.sellerName || '',
    it.status,
  ])

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `invoice-summary-${Date.now()}.csv`)
}
