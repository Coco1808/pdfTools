import { useEffect, useRef, useState } from 'react'
import { getPdfDocument } from '../lib/pdf'
import './PdfPagePreview.less'

interface Props {
  file: File | null
  pageNumber: number
  label?: string
  accent?: 'source' | 'replacement'
}

export function PdfPagePreview({ file, pageNumber, label, accent = 'source' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setStatus('idle')
      setError(null)
      return
    }

    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return

    setStatus('loading')
    setError(null)

    ;(async () => {
      try {
        const doc = await getPdfDocument(file)
        if (cancelled) return
        const safePage = Math.min(Math.max(1, pageNumber), doc.numPages)
        const page = await doc.getPage(safePage)
        if (cancelled) return

        const base = page.getViewport({ scale: 1 })
        const maxWidth = canvas.parentElement?.clientWidth || 360
        const scale = Math.min(1.6, maxWidth / base.width)
        const viewport = page.getViewport({ scale })

        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法创建画布')

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        await page.render({ canvasContext: context, viewport }).promise
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : '预览失败')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [file, pageNumber])

  if (!file) {
    return (
      <div className={`pdf-preview empty accent-${accent}`}>
        <p>上传后将在此预览页面</p>
      </div>
    )
  }

  return (
    <div className={`pdf-preview accent-${accent}`}>
      {label && (
        <div className="pdf-preview-label">
          <span>{label}</span>
          <span className="pdf-preview-page">第 {pageNumber} 页</span>
        </div>
      )}
      <div className="pdf-preview-frame">
        {(status === 'loading' || status === 'idle') && (
          <div className="pdf-preview-state">正在渲染预览…</div>
        )}
        {status === 'error' && <div className="pdf-preview-state error">{error}</div>}
        <canvas ref={canvasRef} className={status === 'ready' ? 'visible' : 'hidden'} />
      </div>
    </div>
  )
}
