import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../components/Dropzone'
import { PdfPagePreview } from '../components/PdfPagePreview'
import { useToast } from '../components/Toast'
import { downloadBlob, replacePdfPage } from '../api/client'
import { getPdfPageCount } from '../lib/pdf'
import { formatBytes, validatePdfFiles } from '../lib/types'
import './ToolPage.css'
import './ReplacePage.css'

type Phase = 'idle' | 'working' | 'done'

interface LoadedPdf {
  file: File
  pageCount: number
}

export function ReplacePage() {
  const { push } = useToast()
  const [source, setSource] = useState<LoadedPdf | null>(null)
  const [replacement, setReplacement] = useState<LoadedPdf | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [replacementPageNumber, setReplacementPageNumber] = useState(1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  useEffect(() => {
    if (source) {
      setPageNumber((n) => Math.min(Math.max(1, n), source.pageCount))
    }
  }, [source])

  useEffect(() => {
    if (replacement) {
      setReplacementPageNumber((n) => Math.min(Math.max(1, n), replacement.pageCount))
    }
  }, [replacement])

  const loadPdf = async (files: File[], kind: 'source' | 'replacement') => {
    const { ok, errors } = validatePdfFiles(files.slice(0, 1), 0, 0)
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return

    const file = ok[0]
    setLoadingInfo(true)
    setPhase('idle')
    setResult(null)
    try {
      const pageCount = await getPdfPageCount(file)
      const loaded = { file, pageCount }
      if (kind === 'source') {
        setSource(loaded)
        setPageNumber(1)
      } else {
        setReplacement(loaded)
        setReplacementPageNumber(1)
      }
      push(`已读取「${file.name}」，共 ${pageCount} 页`, 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : '读取 PDF 失败', 'error')
    } finally {
      setLoadingInfo(false)
    }
  }

  const onReplace = async () => {
    if (!source || !replacement) {
      push('请先上传原文档和替换页文件', 'warn')
      return
    }
    setPhase('working')
    try {
      const out = await replacePdfPage({
        source: source.file,
        replacement: replacement.file,
        pageNumber,
        replacementPageNumber,
      })
      setResult(out)
      setPhase('done')
      push('页面替换完成，可以下载了', 'success')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '替换失败', 'error')
    }
  }

  const clearAll = () => {
    setSource(null)
    setReplacement(null)
    setPageNumber(1)
    setReplacementPageNumber(1)
    setResult(null)
    setPhase('idle')
  }

  const busy = phase === 'working' || loadingInfo

  return (
    <div className="container tool-page">
      <header className="tool-header">
        <h1 className="section-title">替换页面</h1>
        <p className="section-desc">
          上传原 PDF 与替换页，预览对比后一键替换。指定页码即可，其余页面保持不变。
        </p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel replace-main">
          <div className="replace-grid">
            <section className="replace-block">
              <div className="replace-block-head">
                <h2>1. 原文档</h2>
                {source && (
                  <button type="button" className="btn btn-soft" disabled={busy} onClick={() => setSource(null)}>
                    更换
                  </button>
                )}
              </div>
              {!source ? (
                <Dropzone
                  onFiles={(files) => loadPdf(files, 'source')}
                  disabled={busy}
                  hint="上传需要改页的 PDF（单文件）"
                />
              ) : (
                <div className="file-card">
                  <p className="file-card-name">{source.file.name}</p>
                  <p className="file-card-meta">
                    {formatBytes(source.file.size)} · 共 {source.pageCount} 页
                  </p>
                  <PdfPagePreview
                    file={source.file}
                    pageNumber={pageNumber}
                    label="将被替换的页面"
                    accent="source"
                  />
                  <label className="field">
                    <span>替换第几页</span>
                    <div className="page-control">
                      <input
                        type="number"
                        min={1}
                        max={source.pageCount}
                        value={pageNumber}
                        disabled={busy}
                        onChange={(e) => setPageNumber(Number(e.target.value) || 1)}
                      />
                      <span className="page-range">/ {source.pageCount}</span>
                    </div>
                  </label>
                  <div className="page-chips" role="list">
                    {Array.from({ length: Math.min(source.pageCount, 12) }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="listitem"
                        className={`page-chip ${n === pageNumber ? 'active' : ''}`}
                        disabled={busy}
                        onClick={() => setPageNumber(n)}
                      >
                        {n}
                      </button>
                    ))}
                    {source.pageCount > 12 && <span className="page-more">…共 {source.pageCount} 页</span>}
                  </div>
                </div>
              )}
            </section>

            <section className="replace-block">
              <div className="replace-block-head">
                <h2>2. 替换页来源</h2>
                {replacement && (
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={busy}
                    onClick={() => setReplacement(null)}
                  >
                    更换
                  </button>
                )}
              </div>
              {!replacement ? (
                <Dropzone
                  onFiles={(files) => loadPdf(files, 'replacement')}
                  disabled={busy}
                  hint="上传用于替换的 PDF（默认取其第 1 页）"
                />
              ) : (
                <div className="file-card">
                  <p className="file-card-name">{replacement.file.name}</p>
                  <p className="file-card-meta">
                    {formatBytes(replacement.file.size)} · 共 {replacement.pageCount} 页
                  </p>
                  <PdfPagePreview
                    file={replacement.file}
                    pageNumber={replacementPageNumber}
                    label="用来替换的页面"
                    accent="replacement"
                  />
                  <label className="field">
                    <span>使用其中第几页</span>
                    <div className="page-control">
                      <input
                        type="number"
                        min={1}
                        max={replacement.pageCount}
                        value={replacementPageNumber}
                        disabled={busy}
                        onChange={(e) => setReplacementPageNumber(Number(e.target.value) || 1)}
                      />
                      <span className="page-range">/ {replacement.pageCount}</span>
                    </div>
                  </label>
                  {replacement.pageCount > 1 && (
                    <div className="page-chips" role="list">
                      {Array.from({ length: Math.min(replacement.pageCount, 12) }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="listitem"
                          className={`page-chip ${n === replacementPageNumber ? 'active' : ''}`}
                          disabled={busy}
                          onClick={() => setReplacementPageNumber(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {(source || replacement) && (
            <section className="compare-strip">
              <div className="compare-head">
                <h3>预览对比</h3>
                <p>左侧将被覆盖，右侧将写入该位置</p>
              </div>
              <div className="compare-grid">
                <PdfPagePreview
                  file={source?.file ?? null}
                  pageNumber={pageNumber}
                  label="原页（将被替换）"
                  accent="source"
                />
                <div className="compare-arrow" aria-hidden>
                  →
                </div>
                <PdfPagePreview
                  file={replacement?.file ?? null}
                  pageNumber={replacementPageNumber}
                  label="新页（替换后）"
                  accent="replacement"
                />
              </div>
            </section>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">
              {source && replacement
                ? `将用「${replacement.file.name}」第 ${replacementPageNumber} 页，替换原文档第 ${pageNumber} 页。`
                : '先上传原文档和替换页文件，预览确认后再替换。'}
            </p>

            <AnimatePresence mode="wait">
              {phase === 'working' && (
                <motion.div
                  key="working"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="status-block"
                >
                  <p>正在替换页面…</p>
                  <div className="progress-track">
                    <div className="progress-bar" />
                  </div>
                </motion.div>
              )}
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
                  <p>替换成功：{result.fileName}</p>
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
                    下载结果
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    继续替换
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !source || !replacement}
                    onClick={onReplace}
                  >
                    {phase === 'working' ? '处理中…' : '开始替换'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || (!source && !replacement)}
                    onClick={clearAll}
                  >
                    清空重来
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
