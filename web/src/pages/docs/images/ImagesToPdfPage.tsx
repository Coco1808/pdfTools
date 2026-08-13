import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../../../components/Dropzone'
import { SortableFileList } from '../../../components/SortableFileList'
import { useToast } from '../../../components/Toast'
import { downloadBlob, imagesToPdf } from '../../../api/client'
import { formatBytes, uid, validateImageFiles, type PdfFileItem } from '../../../lib/types'
import '../styles/ToolPage.less'
import '../styles/ReplacePage.less'
import '../styles/ExtraTools.less'

type Phase = 'idle' | 'working' | 'done'
type PageMode = 'a4' | 'original'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/bmp,image/gif,image/tiff,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tif,.tiff'

export function ImagesToPdfPage() {
  const { push } = useToast()
  const [items, setItems] = useState<PdfFileItem[]>([])
  const [pageMode, setPageMode] = useState<PageMode>('a4')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null)

  const totalSize = useMemo(() => items.reduce((s, i) => s + i.size, 0), [items])

  const addFiles = (files: File[]) => {
    const { ok, errors } = validateImageFiles(
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

  const onConvert = async () => {
    if (!items.length) {
      push('请至少上传一张图片', 'warn')
      return
    }
    setPhase('working')
    try {
      const converted = await imagesToPdf(items.map((i) => i.file), pageMode)
      setResult(converted)
      setPhase('done')
      push('转换完成，可以下载了', 'success')
    } catch (err) {
      setPhase('idle')
      push(err instanceof Error ? err.message : '转换失败', 'error')
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
        <h1 className="section-title">图片转 PDF</h1>
        <p className="section-desc">上传 JPG / PNG 等图片，按列表顺序合成一份 PDF，每张图一页。</p>
      </header>

      <div className="tool-layout">
        <div className="tool-main panel">
          {items.length === 0 ? (
            <Dropzone
              onFiles={addFiles}
              disabled={phase === 'working'}
              title="拖拽图片到此处，或点击选择"
              hint="支持 JPG / PNG / WEBP / BMP / GIF · 单文件 ≤ 50MB · 合计 ≤ 100MB · 最多 20 张"
              accept={IMAGE_ACCEPT}
            />
          ) : (
            <div className="list-panel extra-workspace">
              <div className="list-toolbar">
                <div>
                  <strong>{items.length}</strong> 张图片 · {formatBytes(totalSize)}
                </div>
                <button
                  type="button"
                  className="btn btn-soft"
                  disabled={phase === 'working'}
                  onClick={() => document.getElementById('images-more')?.click()}
                >
                  继续添加
                </button>
                <input
                  id="images-more"
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files || []))
                    e.target.value = ''
                  }}
                />
              </div>
              <div className="field">
                <span>纸张</span>
                <div className="mode-tabs">
                  <button
                    type="button"
                    className={pageMode === 'a4' ? 'active' : ''}
                    disabled={phase === 'working'}
                    onClick={() => setPageMode('a4')}
                  >
                    A4 适配
                  </button>
                  <button
                    type="button"
                    className={pageMode === 'original' ? 'active' : ''}
                    disabled={phase === 'working'}
                    onClick={() => setPageMode('original')}
                  >
                    按图片尺寸
                  </button>
                </div>
              </div>
              <SortableFileList items={items} onChange={setItems} disabled={phase === 'working'} />
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel">
            <h2>操作</h2>
            <p className="side-tip">
              可拖拽调整图片顺序。A4 会按横竖自动选纸张并居中留白；按图片尺寸则每页与原图比例一致。
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
                  <p>正在转换，请稍候…</p>
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
                    下载 PDF
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    继续转换
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={phase === 'working' || items.length === 0}
                    onClick={onConvert}
                  >
                    {phase === 'working' ? '转换中…' : '生成 PDF'}
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
