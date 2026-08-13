import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dropzone } from '../../../components/Dropzone'
import { useToast } from '../../../components/Toast'
import { analyzeInvoices, exportInvoicesCsv } from '../../../api/client'
import {
  INVOICE_TYPES,
  formatMoney,
  uid,
  validatePdfFiles,
  type InvoiceItem,
  type PdfFileItem,
} from '../../../lib/types'
import '../styles/ToolPage.less'
import './InvoicePage.less'

function recompute(items: InvoiceItem[]) {
  const summaryMap = new Map<string, { invoiceType: string; count: number; totalAmount: number }>()
  let grandTotal = 0
  let successCount = 0
  let failedCount = 0

  for (const it of items) {
    if (it.amount == null || Number.isNaN(it.amount)) {
      failedCount += 1
      continue
    }
    successCount += 1
    grandTotal += it.amount
    const row = summaryMap.get(it.invoiceType) || {
      invoiceType: it.invoiceType,
      count: 0,
      totalAmount: 0,
    }
    row.count += 1
    row.totalAmount = Math.round((row.totalAmount + it.amount) * 100) / 100
    summaryMap.set(it.invoiceType, row)
  }

  const ordered: { invoiceType: string; count: number; totalAmount: number }[] = []
  for (const t of INVOICE_TYPES) {
    const row = summaryMap.get(t)
    if (row) ordered.push(row)
  }
  for (const [t, row] of summaryMap) {
    if (!(INVOICE_TYPES as readonly string[]).includes(t)) ordered.push(row)
  }

  const numberCount = new Map<string, number>()
  items.forEach((it) => {
    if (it.invoiceNumber) {
      numberCount.set(it.invoiceNumber, (numberCount.get(it.invoiceNumber) || 0) + 1)
    }
  })
  const duplicates = [...numberCount.entries()].filter(([, c]) => c > 1).map(([n]) => n)

  return {
    summary: ordered,
    grandTotal: Math.round(grandTotal * 100) / 100,
    successCount,
    failedCount,
    duplicateNumbers: duplicates,
    items: items.map((it) => ({
      ...it,
      duplicate: Boolean(it.invoiceNumber && duplicates.includes(it.invoiceNumber)),
    })),
  }
}

export function InvoicePage() {
  const { push } = useToast()
  const [files, setFiles] = useState<PdfFileItem[]>([])
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [working, setWorking] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const stats = useMemo(() => recompute(items), [items])

  const addFiles = (incoming: File[]) => {
    const { ok, errors } = validatePdfFiles(
      incoming,
      files.length,
      files.reduce((s, i) => s + i.size, 0),
    )
    errors.forEach((e) => push(e, 'warn'))
    if (!ok.length) return
    setFiles((prev) => [
      ...prev,
      ...ok.map((file) => ({ id: uid(), file, name: file.name, size: file.size })),
    ])
    setAnalyzed(false)
    setItems([])
  }

  const runAnalyze = async () => {
    if (!files.length) {
      push('请先上传发票 PDF', 'warn')
      return
    }
    setWorking(true)
    try {
      const result = await analyzeInvoices(files.map((f) => f.file))
      setItems(result.items)
      setAnalyzed(true)
      if (result.duplicateNumbers.length) {
        push(`发现重复发票号码：${result.duplicateNumbers.join('、')}`, 'warn')
      } else {
        push(`识别完成：成功 ${result.successCount}，失败 ${result.failedCount}`, 'success')
      }
    } catch (err) {
      push(err instanceof Error ? err.message : '识别失败', 'error')
    } finally {
      setWorking(false)
    }
  }

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const next = { ...it, ...patch }
        if (patch.amount != null && !Number.isNaN(patch.amount)) {
          next.status = next.status === 'failed' ? 'review' : next.status
          next.message = next.status === 'review' ? '已手动修正，建议再核对' : next.message
        }
        return next
      }),
    )
  }

  const clearAll = () => {
    setFiles([])
    setItems([])
    setAnalyzed(false)
  }

  return (
    <div className="container tool-page">
      <header className="tool-header">
        <h1 className="section-title">发票金额汇总</h1>
        <p className="section-desc">
          上传发票类 PDF，自动识别类型与金额，按类型汇总。识别不准时可直接改，合计实时更新。
        </p>
      </header>

      <div className="tool-layout invoice-layout">
        <div className="tool-main panel">
          {!files.length ? (
            <Dropzone onFiles={addFiles} disabled={working} />
          ) : (
            <div className="list-panel">
              <div className="list-toolbar">
                <div>
                  已选 <strong>{files.length}</strong> 个文件
                  {analyzed ? ` · 已识别 ${items.length} 条` : ''}
                </div>
                <div className="toolbar-actions">
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={working}
                    onClick={() => document.getElementById('invoice-more')?.click()}
                  >
                    继续添加
                  </button>
                  <input
                    id="invoice-more"
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
              </div>

              {!analyzed && (
                <ul className="pending-files">
                  {files.map((f, i) => (
                    <li key={f.id}>
                      <span>{i + 1}. {f.name}</span>
                      <button
                        type="button"
                        className="icon-btn danger"
                        disabled={working}
                        onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {working && (
                <div className="status-block">
                  <p>正在识别发票内容…</p>
                  <div className="progress-track">
                    <div className="progress-bar" />
                  </div>
                </div>
              )}

              <AnimatePresence>
                {analyzed && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="invoice-table-wrap"
                  >
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th>文件</th>
                          <th>类型</th>
                          <th>金额</th>
                          <th>号码 / 日期</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.items.map((it) => (
                          <tr key={it.id} className={it.duplicate ? 'dup' : ''}>
                            <td>
                              <div className="cell-name">{it.fileName}</div>
                              {it.sellerName && <div className="cell-sub">{it.sellerName}</div>}
                            </td>
                            <td>
                              <select
                                value={it.invoiceType}
                                onChange={(e) => updateItem(it.id, { invoiceType: e.target.value })}
                              >
                                {INVOICE_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="amount-input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={it.amount ?? ''}
                                placeholder="手动填写"
                                onChange={(e) => {
                                  const v = e.target.value
                                  updateItem(it.id, {
                                    amount: v === '' ? null : Number(v),
                                  })
                                }}
                              />
                            </td>
                            <td>
                              <div className="cell-sub">
                                {it.invoiceNumber || '—'}
                                {it.duplicate && <span className="badge badge-warn">重复</span>}
                              </div>
                              <div className="cell-sub">{it.invoiceDate || '日期未知'}</div>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  it.status === 'success'
                                    ? 'badge-success'
                                    : it.status === 'review'
                                      ? 'badge-warn'
                                      : 'badge-danger'
                                }`}
                              >
                                {it.status === 'success'
                                  ? '成功'
                                  : it.status === 'review'
                                    ? '需核对'
                                    : '失败'}
                              </span>
                              {it.message && <div className="cell-sub">{it.message}</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <aside className="tool-side">
          <div className="side-card panel summary-card">
            <h2>类型汇总</h2>
            {!analyzed ? (
              <p className="side-tip">上传并识别后，这里会按发票类型展示合计。</p>
            ) : (
              <>
                <ul className="summary-list">
                  {stats.summary.map((row) => (
                    <li key={row.invoiceType}>
                      <span className="sum-type">{row.invoiceType}</span>
                      <span className="sum-count">{row.count} 张</span>
                      <span className="sum-amount">{formatMoney(row.totalAmount)}</span>
                    </li>
                  ))}
                  {!stats.summary.length && <li className="empty">暂无有效金额</li>}
                </ul>
                <div className="grand-total">
                  <div>
                    <strong>合计</strong>
                    <span>
                      {stats.successCount + stats.failedCount} 张 · 有效 {stats.successCount} · 待补{' '}
                      {stats.failedCount}
                    </span>
                  </div>
                  <div className="grand-money">{formatMoney(stats.grandTotal)}</div>
                </div>
              </>
            )}

            <div className="side-actions">
              {!analyzed ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={working || !files.length}
                  onClick={runAnalyze}
                >
                  {working ? '识别中…' : '开始识别'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={working}
                    onClick={() => exportInvoicesCsv(stats.items)}
                  >
                    导出 CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={working}
                    onClick={runAnalyze}
                  >
                    重新识别
                  </button>
                </>
              )}
              <button type="button" className="btn btn-ghost" disabled={working || !files.length} onClick={clearAll}>
                清空重来
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
