function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return '#'
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) return escapeHtml(trimmed)
  return '#'
}

function renderInline(text: string): string {
  let html = escapeHtml(text)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    return `<img src="${safeUrl(url)}" alt="${escapeHtml(alt)}" />`
  })
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    return `<a href="${safeUrl(url)}" target="_blank" rel="noreferrer">${label}</a>`
  })
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return html
}

function isTableSeparator(line: string) {
  return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line)
}

function splitRow(line: string) {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderTable(header: string, rows: string[]) {
  const heads = splitRow(header)
  const body = rows.map(splitRow)
  return [
    '<table>',
    '<thead><tr>',
    ...heads.map((cell) => `<th>${renderInline(cell)}</th>`),
    '</tr></thead><tbody>',
    ...body.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`),
    '</tbody></table>',
  ].join('')
}

export function renderMarkdown(source: string): string {
  const fences: string[] = []
  const prepared = source.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_m, lang, code) => {
    const token = `%%FENCE${fences.length}%%`
    const cls = lang ? ` class="lang-${escapeHtml(lang)}"` : ''
    fences.push(`<pre><code${cls}>${escapeHtml(String(code).replace(/\n$/, ''))}</code></pre>`)
    return `\n${token}\n`
  })

  const lines = prepared.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const fence = line.trim().match(/^%%FENCE(\d+)%%$/)
    if (fence) {
      flushParagraph()
      html.push(fences[Number(fence[1])])
      i += 1
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph()
      html.push('<hr />')
      i += 1
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph()
      const rows: string[] = []
      i += 2
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i])
        i += 1
      }
      html.push(renderTable(line, rows))
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      const quotes = [quote[1]]
      i += 1
      while (i < lines.length) {
        const next = lines[i].match(/^>\s?(.*)$/)
        if (!next) break
        quotes.push(next[1])
        i += 1
      }
      html.push(`<blockquote>${quotes.map((item) => `<p>${renderInline(item)}</p>`).join('')}</blockquote>`)
      continue
    }

    const list = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
    if (list) {
      flushParagraph()
      const ordered = /\d+\./.test(list[2])
      const items = [list[3]]
      i += 1
      while (i < lines.length) {
        const next = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
        if (!next) break
        items.push(next[3])
        i += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      html.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`)
      continue
    }

    paragraph.push(line.trim())
    i += 1
  }

  flushParagraph()
  return html.join('\n')
}
