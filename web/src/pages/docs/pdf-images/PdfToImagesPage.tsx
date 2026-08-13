import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../../../components/Dropzone'
import { useToast } from '../../../components/Toast'
import { downloadBlob, pdfToImages } from '../../../api/client'
import { formatBytes, validatePdfFiles } from '../../../lib/types'
import '../styles/ToolPage.less'
import '../styles/ReplacePage.less'
import '../styles/ExtraTools.less'

type Phase = 'idle' | 'working' | 'done'
type ImageFormat = 'png' | 'jpeg'
type Dpi = 72 | 150 | 300

const DPI_OPTIONS: { value: Dpi; label: string; desc: string }[] = [
  { value: 72, label: '72 DPI', desc: '体积小，适合预览' },
  { value: 150, label: '150 DPI', desc: '常用：清晰度与体积平衡' },
  { value: 300, label: '300 DPI', desc: '更清晰，文件更大' },
]

export function PdfToImagesPage() {
  const { push } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [imageFormat, setImageFormat] = useState<ImageFormat>('png')
  const [dpi, setDpi] = useState<Dpi>(150)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null)

  const onFiles = (files: File[]) => {
    const { ok, errors } = validatePdfFiles(files.slice(0, 1), 0, 0)
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setFile(ok[0])
    setResult(null)
    setPhase('idle')
  }

  const onConvert = async () => {
    if (!file) {
      push('请先上传 PDF', 'warn')
      return
    }
    setPhase('working')
    try {
      const converted = await pdfToImages(file, imageFormat, dpi)
      setResult(converted)
      setPhase('done')
      push('转换完成，可以下载了', 'success')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '转换失败', 'error')
    }
  }

  const clearAll = () => {
    setFile(null)
    setResult(null)
    setPhase('idle')
  }

  const busy = phase === 'working'
  const isZip = result?.fileName.toLowerCase().endsWith('.zip')

  return (
    <div className="container tool-page">
      <header className="tool-header">
        <h1 className="section-title">PDF 转图片</h1>
        <p className="section-desc">把 PDF 每一页导出为 PNG 或 JPG。单页直接下载图片，多页打包为 ZIP。</p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel replace-main">
          {!file ? (
            <Dropzone
              onFiles={onFiles}
              disabled={busy}
              hint="上传要转换的 PDF（单文件 · 最多 80 页）"
            />
          ) : (
            <div className="extra-workspace">
              <div className="file-card compact">
                <div className="extra-file-row">
                  <div>
                    <p className="file-card-name">{file.name}</p>
                    <p className="file-card-meta">{formatBytes(file.size)}</p>
                  </div>
                  <button type="button" className="btn btn-soft" disabled={busy} onClick={clearAll}>
                    更换
                  </button>
                </div>

                <div className="field">
                  <span>图片格式</span>
                  <div className="mode-tabs">
                    <button
                      type="button"
                      className={imageFormat === 'png' ? 'active' : ''}
                      disabled={busy}
                      onClick={() => setImageFormat('png')}
                    >
                      PNG
                    </button>
                    <button
                      type="button"
                      className={imageFormat === 'jpeg' ? 'active' : ''}
                      disabled={busy}
                      onClick={() => setImageFormat('jpeg')}
                    >
                      JPG
                    </button>
                  </div>
                </div>

                <div className="field">
                  <span>清晰度</span>
                  <div className="mode-tabs cols-3">
                    {DPI_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={dpi === opt.value ? 'active' : ''}
                        disabled={busy}
                        onClick={() => setDpi(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="file-card-meta">
                  {DPI_OPTIONS.find((opt) => opt.value === dpi)?.desc}
                  {imageFormat === 'png' ? ' · PNG 无损' : ' · JPG 体积更小'}
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">150 DPI 适合大多数场景。超过 80 页请先拆分再转换。</p>
            <AnimatePresence mode="wait">
              {phase === 'working' && (
                <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="status-block">
                  <p>正在转换，请稍候…</p>
                  <div className="progress-track">
                    <div className="progress-bar" />
                  </div>
                </motion.div>
              )}
              {phase === 'done' && result && (
                <motion.div
                  key="d"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="status-block success"
                >
                  <div className="success-check">✓</div>
                  <p>转换成功：{result.fileName}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="side-actions">
              {phase === 'done' && result ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => downloadBlob(result.blob, result.fileName)}
                  >
                    {isZip ? '下载 ZIP' : '下载图片'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    继续转换
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy || !file} onClick={onConvert}>
                    {busy ? '转换中…' : '生成图片'}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy || !file} onClick={clearAll}>
                    清空
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
