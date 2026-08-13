import { useCallback, useRef, useState, type DragEvent } from 'react'
import { motion } from 'framer-motion'
import './Dropzone.less'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  hint?: string
}

export function Dropzone({ onFiles, disabled, hint }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const takeFiles = useCallback(
    (list: FileList | null) => {
      if (!list || disabled) return
      onFiles(Array.from(list))
    },
    [disabled, onFiles],
  )

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    takeFiles(e.dataTransfer.files)
  }

  return (
    <motion.div
      className={`dropzone ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      animate={dragging ? { scale: 1.01 } : { scale: 1 }}
      transition={{ duration: 0.22 }}
    >
      <div className="dropzone-glow" aria-hidden />
      <div className="dropzone-content">
        <div className="dropzone-icon" aria-hidden>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path
              d="M18 24V10M18 10l-5 5M18 10l5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 24v2a4 4 0 004 4h12a4 4 0 004-4v-2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="dropzone-title">拖拽 PDF 到此处，或点击选择</p>
        <p className="dropzone-hint">
          {hint || '仅支持 .pdf · 单文件 ≤ 50MB · 合计 ≤ 100MB · 最多 20 个'}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          选择文件
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => {
          takeFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </motion.div>
  )
}
