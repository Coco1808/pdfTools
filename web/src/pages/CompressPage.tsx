import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../components/Dropzone'
import { useToast } from '../components/Toast'
import { compressPdf, downloadCompress } from '../api/client'
import { formatBytes, validatePdfFiles, type CompressResult } from '../lib/types'
import './ToolPage.css'
import './ReplacePage.css'
import './ExtraTools.css'

type Phase = 'idle' | 'working' | 'done'

const QUALITY_OPTIONS = [
  { value: 'high', label: '高质量', desc: '尽量保真，适度压缩' },
  { value: 'medium', label: '均衡', desc: '推荐：体积与清晰度平衡' },
  { value: 'low', label: '强力', desc: '更小体积，页面会转成图片' },
]

export function CompressPage() {
  const { push } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [quality, setQuality] = useState('medium')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<CompressResult | null>(null)

  const onFiles = (files: File[]) => {
    const { ok, errors } = validatePdfFiles(files.slice(0, 1), 0, 0)
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setFile(ok[0])
    setResult(null)
    setPhase('idle')
  }

  const onCompress = async () => {
    if (!file) {
      push('请先上传 PDF', 'warn')
      return
    }
    setPhase('working')
    try {
      const data = await compressPdf(file, quality)
      setResult(data)
      setPhase('done')
      push(data.note, data.savedRatio > 0 ? 'success' : 'warn')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '压缩失败', 'error')
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
        <h1 className="section-title">PDF 压缩</h1>
        <p className="section-desc">压缩图片与清理冗余，减小文件体积。强力模式压缩更明显，但文字将不可再选。</p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel replace-main">
          {!file ? (
            <Dropzone onFiles={onFiles} disabled={busy} hint="上传要压缩的 PDF（单文件）" />
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

                <div className="quality-grid">
                  {QUALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`quality-card ${quality === opt.value ? 'active' : ''}`}
                      disabled={busy}
                      onClick={() => setQuality(opt.value)}
                    >
                      <strong>{opt.label}</strong>
                      <span>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {result && (
                <div className="result-card">
                  <h3>压缩结果</h3>
                  <div className="stat-row">
                    <div>
                      <em>原始</em>
                      <strong>{formatBytes(result.originalSize)}</strong>
                    </div>
                    <div className="arrow">→</div>
                    <div>
                      <em>压缩后</em>
                      <strong>{formatBytes(result.compressedSize)}</strong>
                    </div>
                    <div>
                      <em>节省</em>
                      <strong>{result.savedRatio}%</strong>
                    </div>
                  </div>
                  <p className="result-note">{result.note}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">先选压缩强度，再开始。已优化过的 PDF 可能几乎不变小。</p>
            <AnimatePresence mode="wait">
              {phase === 'working' && (
                <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="status-block">
                  <p>正在压缩…</p>
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
                  <p>压缩完成</p>
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
                      downloadCompress(result.token, result.fileName).catch((e) =>
                        push(e instanceof Error ? e.message : '下载失败', 'error'),
                      )
                    }
                  >
                    下载压缩文件
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    清空重来
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy || !file} onClick={onCompress}>
                    {busy ? '压缩中…' : '开始压缩'}
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
