import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../components/Dropzone'
import { SortableFileList } from '../components/SortableFileList'
import { useToast } from '../components/Toast'
import { downloadBlob, mergePdfs } from '../api/client'
import { formatBytes, uid, validatePdfFiles, type PdfFileItem } from '../lib/types'
import './ToolPage.css'

type Phase = 'idle' | 'working' | 'done'

export function MergePage() {
  const { push } = useToast()
  const [items, setItems] = useState<PdfFileItem[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null)

  const totalSize = useMemo(() => items.reduce((s, i) => s + i.size, 0), [items])

  const addFiles = (files: File[]) => {
    const { ok, errors } = validatePdfFiles(
      files,
      items.length,
      items.reduce((s, i) => s + i.size, 0),
    )
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setItems((prev) => [
      ...prev,
      ...ok.map((file) => ({
        id: uid(),
        file,
        name: file.name,
        size: file.size,
      })),
    ])
    setPhase('idle')
    setResult(null)
  }

  const onMerge = async () => {
    if (items.length < 2) {
      push('请至少上传 2 个 PDF 再合并', 'warn')
      return
    }
    setPhase('working')
    try {
      const merged = await mergePdfs(items.map((i) => i.file))
      setResult(merged)
      setPhase('done')
      push('合并完成，可以下载了', 'success')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '合并失败', 'error')
    }
  }

  const clearAll = () => {
    setItems([])
    setResult(null)
    setPhase('idle')
  }

  return (
    <div className="container tool-page">
      <header className="tool-header">
        <h1 className="section-title">PDF 合并</h1>
        <p className="section-desc">上传多个 PDF，拖拽调整顺序，一键合并下载。页序与列表一致。</p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel">
          {items.length === 0 ? (
            <Dropzone onFiles={addFiles} disabled={phase === 'working'} />
          ) : (
            <div className="list-panel">
              <div className="list-toolbar">
                <div>
                  <strong>{items.length}</strong> 个文件 · {formatBytes(totalSize)}
                </div>
                <button
                  type="button"
                  className="btn btn-soft"
                  disabled={phase === 'working'}
                  onClick={() => document.getElementById('merge-more')?.click()}
                >
                  继续添加
                </button>
                <input
                  id="merge-more"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files || []))
                    e.target.value = ''
                  }}
                />
              </div>
              <SortableFileList items={items} onChange={setItems} disabled={phase === 'working'} />
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">建议先排好顺序，再点击合并。加密或损坏的 PDF 会被明确提示。</p>

            <AnimatePresence mode="wait">
              {phase === 'working' && (
                <motion.div
                  key="working"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="status-block"
                >
                  <p>正在合并，请稍候…</p>
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
                  <p>合并成功：{result.fileName}</p>
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
                    下载合并文件
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    继续合并
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={phase === 'working' || items.length < 2}
                    onClick={onMerge}
                  >
                    {phase === 'working' ? '合并中…' : '开始合并'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={phase === 'working' || items.length === 0}
                    onClick={clearAll}
                  >
                    清空列表
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
