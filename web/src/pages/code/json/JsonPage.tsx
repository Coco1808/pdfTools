import { useMemo, useState } from 'react'
import { useToast } from '../../../components/Toast'
import {
  extractJson,
  formatJson,
  type ExtractMode,
  type OutputFormat,
} from './extract'
import './JsonPage.less'

const MODE_OPTIONS: { value: ExtractMode; label: string }[] = [
  { value: 'keys', label: '提取所有键名' },
  { value: 'values', label: '提取所有值' },
  { value: 'paths', label: '提取路径' },
  { value: 'fields', label: '指定字段' },
]

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: 'json', label: 'JSON格式' },
  { value: 'array', label: '数组格式' },
  { value: 'text', label: '文本格式' },
  { value: 'csv', label: 'CSV格式' },
]

export function JsonPage() {
  const { push } = useToast()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<ExtractMode>('keys')
  const [format, setFormat] = useState<OutputFormat>('json')
  const [includeNested, setIncludeNested] = useState(true)
  const [includeArrays, setIncludeArrays] = useState(true)
  const [pretty, setPretty] = useState(true)
  const [fields, setFields] = useState('')

  const canRun = useMemo(() => Boolean(input.trim()), [input])

  const onFormat = () => {
    try {
      const formatted = formatJson(input)
      setInput(formatted)
      setOutput(formatted)
      push('已格式化 JSON', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : '格式化失败', 'error')
    }
  }

  const onExtract = () => {
    try {
      const result = extractJson(input, mode, format, {
        includeNested,
        includeArrays,
        pretty,
        fields,
      })
      setOutput(result)
      push('提取完成', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : '提取失败', 'error')
    }
  }

  const onCopy = async () => {
    if (!output) {
      push('请先格式化或提取', 'warn')
      return
    }
    try {
      await navigator.clipboard.writeText(output)
      push('已复制结果', 'success')
    } catch {
      push('复制失败，请手动选择', 'error')
    }
  }

  const onClear = () => {
    setInput('')
    setOutput('')
  }

  return (
    <div className="container json-page">
      <header className="tool-header">
        <h1 className="section-title">JSON 工具</h1>
        <p className="section-desc">格式化 JSON，或按键名、值、路径、指定字段提取内容。</p>
      </header>

      <div className="json-layout">
        <section className="panel json-pane">
          <div className="json-pane-head">
            <h2>输入 JSON</h2>
            <button type="button" className="btn btn-ghost" disabled={!canRun} onClick={onClear}>
              清空
            </button>
          </div>
          <textarea
            className="json-editor"
            spellCheck={false}
            placeholder='例如：{"user":{"name":"Ada","age":18},"tags":["dev"]}'
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </section>

        <section className="panel json-pane">
          <div className="json-pane-head">
            <h2>结果</h2>
            <button type="button" className="btn btn-ghost" disabled={!output} onClick={() => void onCopy()}>
              复制
            </button>
          </div>
          <textarea className="json-editor" spellCheck={false} readOnly value={output} placeholder="格式化或提取后的结果会显示在这里" />
        </section>
      </div>

      <section className="panel json-controls">
        <div className="json-groups">
          <fieldset className="json-group">
            <legend>提取模式</legend>
            <div className="json-options">
              {MODE_OPTIONS.map((item) => (
                <label key={item.value} className={mode === item.value ? 'active' : ''}>
                  <input
                    type="radio"
                    name="json-mode"
                    checked={mode === item.value}
                    onChange={() => setMode(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="json-group">
            <legend>输出格式</legend>
            <div className="json-options">
              {FORMAT_OPTIONS.map((item) => (
                <label key={item.value} className={format === item.value ? 'active' : ''}>
                  <input
                    type="radio"
                    name="json-format"
                    checked={format === item.value}
                    onChange={() => setFormat(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="json-group">
            <legend>提取选项</legend>
            <div className="json-options">
              <label className={includeNested ? 'active' : ''}>
                <input
                  type="checkbox"
                  checked={includeNested}
                  onChange={(event) => setIncludeNested(event.target.checked)}
                />
                包含嵌套对象
              </label>
              <label className={includeArrays ? 'active' : ''}>
                <input
                  type="checkbox"
                  checked={includeArrays}
                  onChange={(event) => setIncludeArrays(event.target.checked)}
                />
                包含数组元素
              </label>
              <label className={pretty ? 'active' : ''}>
                <input type="checkbox" checked={pretty} onChange={(event) => setPretty(event.target.checked)} />
                格式化输出
              </label>
            </div>
          </fieldset>
        </div>

        {mode === 'fields' && (
          <label className="json-fields">
            <span>指定字段</span>
            <input
              value={fields}
              placeholder="例如：name, user.email, tags[0]"
              onChange={(event) => setFields(event.target.value)}
            />
          </label>
        )}

        <div className="json-actions">
          <button type="button" className="btn btn-primary" disabled={!canRun} onClick={onFormat}>
            格式化
          </button>
          <button type="button" className="btn btn-primary" disabled={!canRun} onClick={onExtract}>
            提取
          </button>
          <button type="button" className="btn btn-soft" disabled={!output} onClick={() => void onCopy()}>
            复制结果
          </button>
        </div>
      </section>
    </div>
  )
}
