import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../components/Dropzone'
import { PdfPagePreview } from '../components/PdfPagePreview'
import { useToast } from '../components/Toast'
import { downloadTextable, processTextable } from '../api/client'
import { formatBytes, validatePdfFiles, type TextableProcessResult } from '../lib/types'
import './ToolPage.css'
import './ReplacePage.css'
import './TextablePage.css'

type Phase = 'idle' | 'working' | 'done'

export function TextablePage() {
  const { push } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [forceOcr, setForceOcr] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<TextableProcessResult | null>(null)
  const [activePage, setActivePage] = useState(1)

  const activeText = useMemo(() => {
    if (!result) return ''
    return result.pages.find((p) => p.page === activePage)?.text || ''
  }, [result, activePage])

  const onFiles = (files: File[]) => {
    const { ok, errors } = validatePdfFiles(files.slice(0, 1), 0, 0)
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setFile(ok[0])
    setResult(null)
    setPhase('idle')
    setActivePage(1)
  }

  const onProcess = async () => {
    if (!file) {
      push('请先上传 PDF', 'warn')
      return
    }
    setPhase('working')
    try {
      const data = await processTextable(file, forceOcr)
      setResult(data)
      setActivePage(data.pages[0]?.page || 1)
      setPhase('done')
      push(
        data.alreadySelectable
          ? '文档本身已含可选文字，已整理可复制内容'
          : `处理完成：识别 ${data.totalChars} 字，可下载可复制 PDF`,
        'success',
      )
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '处理失败', 'error')
    }
  }

  const copyPage = async () => {
    if (!activeText) {
      push('当前页没有可复制文字', 'warn')
      return
    }
    try {
      await navigator.clipboard.writeText(activeText)
      push('已复制当前页文字', 'success')
    } catch {
      push('复制失败，请手动选择文本', 'error')
    }
  }

  const copyAll = async () => {
    if (!result) return
    const all = result.pages
      .map((p) => `—— 第 ${p.page} 页 ——\n${p.text || '（无文字）'}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(all)
      push('已复制全部文字', 'success')
    } catch {
      push('复制失败，请手动选择文本', 'error')
    }
  }

  const clearAll = () => {
    setFile(null)
    setResult(null)
    setPhase('idle')
    setActivePage(1)
    setForceOcr(false)
  }

  const busy = phase === 'working'

  return (
    <div className="container tool-page">
      <header className="tool-header">
        <h1 className="section-title">转可复制 PDF</h1>
        <p className="section-desc">
          将扫描件或图片型 PDF 识别为可选中、可复制的文字层；文本型 PDF 会直接提取并展示具体文案。
        </p>
      </header>

      <div className="tool-layout textable-layout">
        <div className="tool-main panel replace-main">
          {!file ? (
            <Dropzone onFiles={onFiles} disabled={busy} hint="上传 PDF（单文件，建议 ≤ 30 页）" />
          ) : (
            <div className="textable-workspace">
              <div className="textable-top">
                <div className="file-card compact">
                  <div className="textable-file-row">
                    <div>
                      <p className="file-card-name">{file.name}</p>
                      <p className="file-card-meta">{formatBytes(file.size)}</p>
                    </div>
                    <button type="button" className="btn btn-soft" disabled={busy} onClick={clearAll}>
                      更换文件
                    </button>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={forceOcr}
                      disabled={busy}
                      onChange={(e) => setForceOcr(e.target.checked)}
                    />
                    <span>强制 OCR（即使已有文字也重新识别）</span>
                  </label>
                  <PdfPagePreview file={file} pageNumber={activePage} label="原文档预览" accent="source" />
                </div>

                <div className="text-panel">
                  <div className="text-panel-head">
                    <h2>可复制文案</h2>
                    {result && (
                      <div className="text-panel-actions">
                        <button type="button" className="btn btn-soft" onClick={copyPage}>
                          复制本页
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={copyAll}>
                          复制全部
                        </button>
                      </div>
                    )}
                  </div>

                  {!result && phase !== 'working' && (
                    <div className="text-empty">处理完成后，这里会列出 PDF 中可复制的具体文字内容。</div>
                  )}

                  {phase === 'working' && (
                    <div className="status-block">
                      <p>正在提取 / OCR 识别，扫描件可能需要更久…</p>
                      <div className="progress-track">
                        <div className="progress-bar" />
                      </div>
                    </div>
                  )}

                  {result && (
                    <>
                      <div className="result-meta">
                        <span className="badge badge-success">
                          {result.alreadySelectable ? '已有文字层' : '已生成可复制 PDF'}
                        </span>
                        <span>{result.totalChars} 字</span>
                        <span>
                          嵌入 {result.embeddedPageCount} 页 · OCR {result.ocrPageCount} 页
                        </span>
                      </div>
                      <div className="page-chips" role="list">
                        {result.pages.map((p) => (
                          <button
                            key={p.page}
                            type="button"
                            className={`page-chip ${p.page === activePage ? 'active' : ''}`}
                            onClick={() => setActivePage(p.page)}
                          >
                            {p.page}
                            <em>{p.source === 'ocr' ? 'OCR' : '文本'}</em>
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="text-output"
                        readOnly
                        value={activeText || '（本页未识别到文字）'}
                        spellCheck={false}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">
              文本型 PDF 会保留原版面；扫描件会 OCR 后生成可全选复制的文字 PDF，并在右侧列出每页具体文案。
            </p>

            <AnimatePresence mode="wait">
              {phase === 'done' && result && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="status-block success"
                >
                  <div className="success-check" aria-hidden>
                    ✓
                  </div>
                  <p>
                    {result.method.includes('ocr')
                      ? '已写入文字层，可在 PDF 中复制'
                      : '文本型 PDF，内容已可复制'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="side-actions">
              {phase === 'done' && result ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      downloadTextable(result.token, result.fileName).catch((err) =>
                        push(err instanceof Error ? err.message : '下载失败', 'error'),
                      )
                    }
                  >
                    下载可复制 PDF
                  </button>
                  <button type="button" className="btn btn-soft" disabled={busy} onClick={onProcess}>
                    重新处理
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    清空重来
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !file}
                    onClick={onProcess}
                  >
                    {busy ? '处理中…' : '开始转换'}
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
