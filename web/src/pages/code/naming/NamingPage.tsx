import { useMemo, useState } from 'react'
import { translateNaming } from '../../../api/client'
import { useToast } from '../../../components/Toast'
import { buildNamingSections } from './conventions'
import './NamingPage.less'

export function NamingPage() {
  const { push } = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [english, setEnglish] = useState('')
  const [words, setWords] = useState<string[]>([])
  const [copiedId, setCopiedId] = useState('')

  const sections = useMemo(() => (words.length ? buildNamingSections(words) : []), [words])

  const onGenerate = async () => {
    const source = text.trim()
    if (!source) {
      push('请输入要命名的中文含义', 'warn')
      return
    }
    setBusy(true)
    try {
      const result = await translateNaming(source)
      setEnglish(result.english)
      setWords(result.words)
      setCopiedId('')
    } catch (err) {
      push(err instanceof Error ? err.message : '翻译失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onCopy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      push(`已复制 ${value}`, 'success')
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? '' : current))
      }, 1600)
    } catch {
      push('复制失败，请手动选择', 'error')
    }
  }

  return (
    <div className="container naming-page">
      <header className="tool-header">
        <h1 className="section-title">变量起名</h1>
        <p className="section-desc">输入中文含义，翻译成英文后生成常用命名，点击卡片即可复制。</p>
      </header>

      <form
        className="naming-search panel"
        onSubmit={(event) => {
          event.preventDefault()
          void onGenerate()
        }}
      >
        <label className="naming-field">
          <span>中文含义</span>
          <input
            value={text}
            disabled={busy}
            maxLength={80}
            placeholder="例如：用户信息、订单详情"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? '翻译中…' : '生成命名'}
        </button>
      </form>

      {words.length > 0 && (
        <p className="naming-english">
          英文：<strong>{english}</strong>
          <span> · {words.join(' / ')}</span>
        </p>
      )}

      {sections.length === 0 ? (
        <p className="naming-empty">输入中文后点击生成，将按常见命名、变量命名、方法命名列出结果。</p>
      ) : (
        sections.map((section) => (
          <section key={section.title} className="naming-section">
            <h2>{section.title}</h2>
            <div className="naming-grid">
              {section.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`naming-card${copiedId === card.id ? ' copied' : ''}`}
                  onClick={() => void onCopy(card.id, card.value)}
                >
                  <span className="naming-card-label">
                    <i />
                    {card.label}
                  </span>
                  <strong>{card.value}</strong>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
