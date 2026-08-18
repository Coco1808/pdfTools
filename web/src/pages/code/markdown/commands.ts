export type EditorSnapshot = {
  value: string
  start: number
  end: number
}

export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after = before,
  placeholder = '文本',
): EditorSnapshot {
  const selected = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  const cursor = start + before.length
  return { value: next, start: cursor, end: cursor + selected.length }
}

export function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string,
  placeholder = '列表项',
): EditorSnapshot {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIndex = value.indexOf('\n', end)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  const block = value.slice(lineStart, lineEnd) || placeholder
  const nextBlock = block
    .split('\n')
    .map((line) => {
      const trimmed = line.replace(/^\s+/, '')
      if (trimmed.startsWith(prefix)) return line
      return `${prefix}${trimmed || placeholder}`
    })
    .join('\n')
  return {
    value: value.slice(0, lineStart) + nextBlock + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + nextBlock.length,
  }
}

export function setHeading(
  value: string,
  start: number,
  end: number,
  level: number,
): EditorSnapshot {
  void end
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIndex = value.indexOf('\n', start)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  const line = value.slice(lineStart, lineEnd).replace(/^#{1,6}\s+/, '')
  const heading = `${'#'.repeat(level)} ${line || '标题'}`
  return {
    value: value.slice(0, lineStart) + heading + value.slice(lineEnd),
    start: lineStart + level + 1,
    end: lineStart + heading.length,
  }
}

export function insertBlock(
  value: string,
  start: number,
  end: number,
  block: string,
): EditorSnapshot {
  void start
  const insertAt = end
  const needsLead = insertAt > 0 && value[insertAt - 1] !== '\n' ? '\n\n' : insertAt > 0 ? '\n' : ''
  const needsTail = insertAt < value.length && value[insertAt] !== '\n' ? '\n\n' : '\n'
  const chunk = `${needsLead}${block}${needsTail}`
  const cursor = insertAt + needsLead.length
  return {
    value: value.slice(0, insertAt) + chunk + value.slice(insertAt),
    start: cursor,
    end: cursor + block.length,
  }
}

export const TABLE_TEMPLATE = ['| 列1 | 列2 | 列3 |', '| --- | --- | --- |', '| 内容 | 内容 | 内容 |'].join('\n')
export const CODE_TEMPLATE = '```\ncode\n```'
export const HR_TEMPLATE = '---'
