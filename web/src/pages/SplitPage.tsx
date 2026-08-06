import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../components/Dropzone'
import { useToast } from '../components/Toast'
import { downloadSplit, splitPdf } from '../api/client'
import { formatBytes, validatePdfFiles, type SplitResult } from '../lib/types'
import './ToolPage.css'
import './ReplacePage.css'
import './ExtraTools.css'

type Phase = 'idle' | 'working' | 'done'

export function SplitPage() {
  const { push } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'range' | 'every'>('range')
  const [ranges, setRanges] = useState('1-1')
  const [everyN, setEveryN] = useState(1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<SplitResult | null>(null)

  const onFiles = (files: File[]) => {
    const { ok, errors } = validatePdfFiles(files.slice(0, 1), 0, 0)
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setFile(ok[0])
    setResult(null)
    setPhase('idle')
  }

  const onSplit = async () => {
    if (!file) {
      push('请先上传 PDF', 'warn')
      return
    }
    setPhase('working')
    try {
      const data = await splitPdf({ file, mode, ranges, everyN })
      setResult(data)
      setPhase('done')
      push(`拆分完成：共 ${data.partCount} 个文件`, 'success')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '拆分失败', 'error')
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
        <h1 className="section-title">PDF 拆分</h1>
        <p className="section-desc">按页码范围或固定页数拆成多个 PDF，打包为 ZIP 下载。</p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel replace-main">
          {!file ? (
            <Dropzone onFiles={onFiles} disabled={busy} hint="上传要拆分的 PDF（单文件）" />
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

                <div className="mode-tabs">
                  <button
                    type="button"
                    className={mode === 'range' ? 'active' : ''}
                    disabled={busy}
                    onClick={() => setMode('range')}
                  >
                    按页码范围
                  </button>
                  <button
                    type="button"
                    className={mode === 'every' ? 'active' : ''}
                    disabled={busy}
                    onClick={() => setMode('every')}
                  >
                    每 N 页一份
                  </button>
                </div>

                {mode === 'range' ? (
                  <label className="field">
                    <span>页码范围（例：1-3,5,8-10）</span>
                    <input
                      value={ranges}
                      disabled={busy}
                      onChange={(e) => setRanges(e.target.value)}
                      placeholder="1-3,5,8-10"
                    />
                  </label>
                ) : (
                  <label className="field">
                    <span>每份页数</span>
                    <input
                      type="number"
                      min={1}
                      value={everyN}
                      disabled={busy}
                      onChange={(e) => setEveryN(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </label>
                )}
              </div>

              {result && (
                <div className="result-card">
                  <h3>拆分结果 · {result.partCount} 个文件</h3>
                  <ul className="part-list">
                    {result.parts.map((p) => (
                      <li key={p.fileName}>
                        <span>{p.fileName}</span>
                        <em>
                          第 {p.fromPage}
                          {p.fromPage !== p.toPage ? `-${p.toPage}` : ''} 页
                        </em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">拆分结果以 ZIP 打包下载，每个范围对应一个 PDF。</p>
            <AnimatePresence mode="wait">
              {phase === 'working' && (
                <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="status-block">
                  <p>正在拆分…</p>
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
                  <p>共 {result.partCount} 个文件，可下载 ZIP</p>
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
                      downloadSplit(result.token, result.fileName).catch((e) =>
                        push(e instanceof Error ? e.message : '下载失败', 'error'),
                      )
                    }
                  >
                    下载 ZIP
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    清空重来
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy || !file} onClick={onSplit}>
                    {busy ? '拆分中…' : '开始拆分'}
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
