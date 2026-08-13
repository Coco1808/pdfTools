import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../../../components/Dropzone'
import { PdfPagePreview } from '../../../components/PdfPagePreview'
import { useToast } from '../../../components/Toast'
import { downloadToc, generateToc } from '../../../api/client'
import { formatBytes, validatePdfFiles, type TocGenerateResult } from '../../../lib/types'
import '../styles/ToolPage.less'
import '../styles/ReplacePage.less'
import './TocPage.less'

type Phase = 'idle' | 'working' | 'done'

const METHOD_LABEL: Record<string, string> = {
  outline: '基于原书签',
  heading: '基于标题样式',
  page: '基于每页首行',
}

export function TocPage() {
  const { push } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<TocGenerateResult | null>(null)

  const onFiles = (files: File[]) => {
    const { ok, errors } = validatePdfFiles(files.slice(0, 1), 0, 0)
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setFile(ok[0])
    setResult(null)
    setPhase('idle')
  }

  const onGenerate = async () => {
    if (!file) {
      push('请先上传 PDF', 'warn')
      return
    }
    setPhase('working')
    try {
      const data = await generateToc(file)
      setResult(data)
      setPhase('done')
      push(`已生成目录：${data.entryCount} 条，插入 ${data.tocPageCount} 页`, 'success')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '生成失败', 'error')
    }
  }

  const clearAll = () => {
    setFile(null)
    setResult(null)
    setPhase('idle')
  }

  const busy = phase === 'working'

  return (
    <div className="container tool-page">
      <header className="tool-header">
        <h1 className="section-title">自动生成目录</h1>
        <p className="section-desc">
          自动识别书签、标题或页面首行，在文档开头插入可点击目录，并写入 PDF 书签导航。
        </p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel replace-main">
          {!file ? (
            <Dropzone onFiles={onFiles} disabled={busy} hint="上传需要生成目录的 PDF（单文件）" />
          ) : (
            <div className="toc-workspace">
              <div className="file-card compact">
                <div className="toc-file-row">
                  <div>
                    <p className="file-card-name">{file.name}</p>
                    <p className="file-card-meta">{formatBytes(file.size)}</p>
                  </div>
                  <button type="button" className="btn btn-soft" disabled={busy} onClick={clearAll}>
                    更换文件
                  </button>
                </div>
                <PdfPagePreview file={file} pageNumber={1} label="文档首页预览" accent="source" />
              </div>

              <div className="toc-panel">
                <div className="toc-panel-head">
                  <h2>识别到的目录</h2>
                  {result && (
                    <span className="badge badge-success">
                      {METHOD_LABEL[result.method] || result.method}
                    </span>
                  )}
                </div>

                {phase === 'working' && (
                  <div className="status-block">
                    <p>正在分析结构并生成目录…</p>
                    <div className="progress-track">
                      <div className="progress-bar" />
                    </div>
                  </div>
                )}

                {!result && phase !== 'working' && (
                  <div className="toc-empty">
                    点击「生成目录」后，这里会列出标题、页码与层级。生成结果会插入到 PDF 首页。
                  </div>
                )}

                {result && (
                  <>
                    <div className="toc-meta">
                      <span>{result.entryCount} 条</span>
                      <span>原 {result.originalPageCount} 页</span>
                      <span>目录 {result.tocPageCount} 页</span>
                      <span>合计 {result.finalPageCount} 页</span>
                    </div>
                    <ol className="toc-list">
                      {result.entries.map((e, i) => (
                        <li key={`${e.page}-${i}`} className={`level-${e.level}`}>
                          <span className="toc-title">{e.title}</span>
                          <span className="toc-dots" aria-hidden />
                          <span className="toc-page">p.{e.page}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">
              优先使用原 PDF 书签；若无书签则按标题字号识别；再不行则用每页首行作为条目。
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
                  <p>目录已写入，条目可点击跳转</p>
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
                      downloadToc(result.token, result.fileName).catch((err) =>
                        push(err instanceof Error ? err.message : '下载失败', 'error'),
                      )
                    }
                  >
                    下载带目录 PDF
                  </button>
                  <button type="button" className="btn btn-soft" disabled={busy} onClick={onGenerate}>
                    重新生成
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
                    onClick={onGenerate}
                  >
                    {busy ? '生成中…' : '生成目录'}
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
