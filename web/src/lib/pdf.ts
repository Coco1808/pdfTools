import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'

GlobalWorkerOptions.workerSrc = pdfWorker

const docCache = new WeakMap<File, Promise<PDFDocumentProxy>>()

export function getPdfDocument(file: File): Promise<PDFDocumentProxy> {
  let pending = docCache.get(file)
  if (!pending) {
    pending = file.arrayBuffer().then((data) => getDocument({ data }).promise)
    docCache.set(file, pending)
  }
  return pending
}

export async function getPdfPageCount(file: File): Promise<number> {
  const doc = await getPdfDocument(file)
  return doc.numPages
}
