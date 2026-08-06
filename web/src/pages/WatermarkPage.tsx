import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../components/Dropzone'
import { useToast } from '../components/Toast'
import { downloadWatermark, watermarkPdf } from '../api/client'
import { formatBytes, validatePdfFiles, type WatermarkResult } from '../lib/types'
import './ToolPage.css'
import './ReplacePage.css'
import './ExtraTools.css'

type Phase = 'idle' | 'working' | 'done'

export function WatermarkPage() {
  const { push } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('机密')
  const [opacity, setOpacity] = useState(0.25)
  const [angle, setAngle] = useState(45)
  const [fontSize, setFontSize] = useState(48)
  const [tile, setTile] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<WatermarkResult | null>(null)

  const onFiles = (files: File[]) => {
    const { ok, errors } = validatePdfFiles(files.slice(0, 1), 0, 0)
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setFile(ok[0])
    setResult(null)
    setPhase('idle')
  }

  const onApply = async () => {
    if (!file) {
      push('请先上传 PDF', 'warn')
      return
    }
    if (!text.trim()) {
      push('请填写水印文字', 'warn')
      return
    }
    setPhase('working')
    try {
      const data = await watermarkPdf({
        file,
        text: text.trim(),
        opacity,
        angle,
        fontSize,
        tile,
      })
      setResult(data)
      setPhase('done')
      push('水印已添加', 'success')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '添加水印失败', 'error')
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
        <h1 className="section-title">添加水印</h1>
        <p className="section-desc">为每一页叠加文字水印，可调整透明度、角度、字号，支持平铺。</p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel replace-main">
          {!file ? (
            <Dropzone onFiles={onFiles} disabled={busy} hint="上传要加水印的 PDF（单文件）" />
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

                <label className="field">
                  <span>水印文字</span>
                  <input
                    value={text}
                    disabled={busy}
                    maxLength={40}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="例如：内部资料 / 仅供查阅"
                  />
                </label>

                <div className="field-grid">
                  <label className="field">
                    <span>透明度 {opacity.toFixed(2)}</span>
                    <input
                      type="range"
                      min={0.05}
                      max={0.8}
                      step={0.05}
                      value={opacity}
                      disabled={busy}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                    />
                  </label>
                  <label className="field">
                    <span>角度 {angle}°</span>
                    <input
                      type="range"
                      min={-60}
                      max={60}
                      step={5}
                      value={angle}
                      disabled={busy}
                      onChange={(e) => setAngle(Number(e.target.value))}
                    />
                  </label>
                  <label className="field">
                    <span>字号 {fontSize}</span>
                    <input
                      type="range"
                      min={16}
                      max={96}
                      step={2}
                      value={fontSize}
                      disabled={busy}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                    />
                  </label>
                </div>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={tile}
                    disabled={busy}
                    onChange={(e) => setTile(e.target.checked)}
                  />
                  <span>平铺整页（关闭则仅页面中央一枚）</span>
                </label>

                <div className="wm-preview" aria-hidden>
                  <span
                    style={{
                      opacity,
                      transform: `rotate(${angle}deg)`,
                      fontSize: Math.max(18, fontSize * 0.45),
                    }}
                  >
                    {text || '水印预览'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">左侧可实时预览水印风格，确认后应用到全部页面。</p>
            <AnimatePresence mode="wait">
              {phase === 'working' && (
                <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="status-block">
                  <p>正在添加水印…</p>
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
                  <p>已为 {result.pageCount} 页添加水印</p>
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
                      downloadWatermark(result.token, result.fileName).catch((e) =>
                        push(e instanceof Error ? e.message : '下载失败', 'error'),
                      )
                    }
                  >
                    下载结果
                  </button>
                  <button type="button" className="btn btn-soft" disabled={busy} onClick={onApply}>
                    重新应用
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    清空重来
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy || !file} onClick={onApply}>
                    {busy ? '处理中…' : '添加水印'}
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
