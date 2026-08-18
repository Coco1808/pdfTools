import DOMPurify from 'dompurify'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { downloadBlob } from '../../../api/client'
import { useToast } from '../../../components/Toast'
import {
  CODE_TEMPLATE,
  HR_TEMPLATE,
  TABLE_TEMPLATE,
  insertBlock,
  prefixLines,
  setHeading,
  wrapSelection,
  type EditorSnapshot,
} from './commands'
import { renderMarkdown } from './render'
import './MarkdownPage.less'

function ToolIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export function MarkdownPage() {
  const { push } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const openRef = useRef<HTMLInputElement>(null)
  const history = useRef({ stack: [''], index: 0 })
  const typingTimer = useRef(0)
  const [value, setValue] = useState('')
  const [fileName, setFileName] = useState('markdown.md')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const preview = useMemo(() => DOMPurify.sanitize(renderMarkdown(value)), [value])

  const restore = (start: number, end: number) => {
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(start, end)
    })
  }

  const syncHistoryButtons = () => {
    setCanUndo(history.current.index > 0)
    setCanRedo(history.current.index < history.current.stack.length - 1)
  }

  const pushHistory = (next: string) => {
    const h = history.current
    if (h.stack[h.index] === next) return
    h.stack = h.stack.slice(0, h.index + 1)
    h.stack.push(next)
    if (h.stack.length > 80) h.stack.shift()
    h.index = h.stack.length - 1
    syncHistoryButtons()
  }

  const apply = (snapshot: EditorSnapshot) => {
    pushHistory(snapshot.value)
    setValue(snapshot.value)
    restore(snapshot.start, snapshot.end)
  }

  const currentRange = () => {
    const el = textareaRef.current
    return {
      start: el?.selectionStart ?? value.length,
      end: el?.selectionEnd ?? value.length,
    }
  }

  const undo = () => {
    const h = history.current
    if (h.index <= 0) return
    h.index -= 1
    setValue(h.stack[h.index])
    syncHistoryButtons()
  }

  const redo = () => {
    const h = history.current
    if (h.index >= h.stack.length - 1) return
    h.index += 1
    setValue(h.stack[h.index])
    syncHistoryButtons()
  }

  const onChange = (next: string) => {
    setValue(next)
    window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => pushHistory(next), 400)
  }

  const wrap = (before: string, after = before, placeholder = '文本') => {
    const { start, end } = currentRange()
    apply(wrapSelection(value, start, end, before, after, placeholder))
  }

  const onSave = () => {
    downloadBlob(new Blob([value], { type: 'text/markdown;charset=utf-8' }), fileName)
    push(`已保存 ${fileName}`, 'success')
  }

  const onOpen = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      history.current = { stack: [text], index: 0 }
      setValue(text)
      setFileName(file.name)
      syncHistoryButtons()
      push(`已打开 ${file.name}`, 'success')
    }
    reader.readAsText(file)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey
      if (!meta) return
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault()
        redo()
      } else if (event.key.toLowerCase() === 'b') {
        event.preventDefault()
        wrap('**', '**', '粗体')
      } else if (event.key.toLowerCase() === 'i') {
        event.preventDefault()
        wrap('*', '*', '斜体')
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        onSave()
      } else if (event.key.toLowerCase() === 'o') {
        event.preventDefault()
        openRef.current?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="container markdown-page">
      <header className="tool-header">
        <h1 className="section-title">Markdown 编辑器</h1>
        <p className="section-desc">左侧编辑，右侧实时预览。可插入标题、列表、链接、表格，并打开或保存 .md 文件。</p>
      </header>

      <div className="panel markdown-shell">
        <div className="markdown-toolbar">
          <div className="markdown-tools">
            <button type="button" title="撤销" disabled={!canUndo} onClick={undo}>
              <ToolIcon>
                <path d="M9 8H5V4" />
                <path d="M5 8a7 7 0 1 1-1.2 5.2" />
              </ToolIcon>
            </button>
            <button type="button" title="重做" disabled={!canRedo} onClick={redo}>
              <ToolIcon>
                <path d="M15 8h4V4" />
                <path d="M19 8a7 7 0 1 0 1.2 5.2" />
              </ToolIcon>
            </button>
            <span className="markdown-sep" />
            <button type="button" title="粗体" onClick={() => wrap('**', '**', '粗体')}>
              <strong>B</strong>
            </button>
            <button type="button" title="斜体" onClick={() => wrap('*', '*', '斜体')}>
              <em>I</em>
            </button>
            <span className="markdown-sep" />
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <button
                key={level}
                type="button"
                title={`标题 ${level}`}
                onClick={() => {
                  const { start, end } = currentRange()
                  apply(setHeading(value, start, end, level))
                }}
              >
                H{level}
              </button>
            ))}
            <span className="markdown-sep" />
            <button type="button" title="链接" onClick={() => wrap('[', '](https://)', '链接文字')}>
              <ToolIcon>
                <path d="M10 13a5 5 0 0 0 7.5.1l1.4-1.4a4.5 4.5 0 0 0-6.4-6.4L11.4 6.4" />
                <path d="M14 11a5 5 0 0 0-7.5-.1L5.1 12.3a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1" />
              </ToolIcon>
            </button>
            <button type="button" title="图片" onClick={() => wrap('![', '](https://)', '图片描述')}>
              <ToolIcon>
                <path d="M5 6h14v12H5z" />
                <circle cx="9" cy="10" r="1.3" />
                <path d="m8 16 3-3.2 2.2 2.3 2.1-2.5L19 16" />
              </ToolIcon>
            </button>
            <span className="markdown-sep" />
            <button
              type="button"
              title="无序列表"
              onClick={() => {
                const { start, end } = currentRange()
                apply(prefixLines(value, start, end, '- '))
              }}
            >
              <ToolIcon>
                <path d="M9 6h11M9 12h11M9 18h11" />
                <circle cx="5" cy="6" r="1" />
                <circle cx="5" cy="12" r="1" />
                <circle cx="5" cy="18" r="1" />
              </ToolIcon>
            </button>
            <button
              type="button"
              title="有序列表"
              onClick={() => {
                const { start, end } = currentRange()
                apply(prefixLines(value, start, end, '1. '))
              }}
            >
              <ToolIcon>
                <path d="M10 6h11M10 12h11M10 18h11M4 5h2v4H4M4 13h3M4 15h2v4" />
              </ToolIcon>
            </button>
            <button
              type="button"
              title="代码块"
              onClick={() => {
                const { start, end } = currentRange()
                const selected = value.slice(start, end)
                apply(
                  selected
                    ? wrapSelection(value, start, end, '```\n', '\n```', 'code')
                    : insertBlock(value, start, end, CODE_TEMPLATE),
                )
              }}
            >
              <ToolIcon>
                <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
              </ToolIcon>
            </button>
            <span className="markdown-sep" />
            <button
              type="button"
              title="表格"
              onClick={() => {
                const { start, end } = currentRange()
                apply(insertBlock(value, start, end, TABLE_TEMPLATE))
              }}
            >
              <ToolIcon>
                <path d="M5 6h14v12H5zM5 10h14M5 14h14M10 6v12M15 6v12" />
              </ToolIcon>
            </button>
            <button
              type="button"
              title="分割线"
              onClick={() => {
                const { start, end } = currentRange()
                apply(insertBlock(value, start, end, HR_TEMPLATE))
              }}
            >
              <ToolIcon>
                <path d="M5 12h14" />
              </ToolIcon>
            </button>
          </div>

          <div className="markdown-file-actions">
            <button type="button" className="markdown-file-btn" onClick={onSave}>
              <ToolIcon>
                <path d="M6 4h10l4 4v12H6z" />
                <path d="M8 4v6h8M8 20v-6h8" />
              </ToolIcon>
              保存
            </button>
            <button type="button" className="markdown-file-btn" onClick={() => openRef.current?.click()}>
              <ToolIcon>
                <path d="M5 7h5l2 2h7v10H5z" />
                <path d="M12 12v6M9.5 14.5 12 12l2.5 2.5" />
              </ToolIcon>
              打开
            </button>
            <input
              ref={openRef}
              type="file"
              hidden
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onOpen(file)
                event.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="markdown-split">
          <textarea
            ref={textareaRef}
            className="markdown-editor"
            spellCheck={false}
            placeholder="在此输入Markdown内容..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <div className="markdown-preview" aria-live="polite">
            {value.trim() ? (
              <div className="markdown-html" dangerouslySetInnerHTML={{ __html: preview }} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
