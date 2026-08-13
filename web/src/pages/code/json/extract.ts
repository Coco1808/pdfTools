export type ExtractMode = 'keys' | 'values' | 'paths' | 'fields'
export type OutputFormat = 'json' | 'array' | 'text' | 'csv'

export type ExtractOptions = {
  includeNested: boolean
  includeArrays: boolean
  pretty: boolean
  fields: string
}

type Entry = {
  path: string
  key: string | null
  value: unknown
}

export function parseJson(input: string): unknown {
  const text = input.trim()
  if (!text) {
    throw new Error('请输入 JSON 数据')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('JSON 格式无效，请检查后重试')
  }
}

export function formatJson(input: string): string {
  return JSON.stringify(parseJson(input), null, 2)
}

function unique(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function childPath(parent: string, key: string | number): string {
  if (typeof key === 'number') {
    return parent ? `${parent}[${key}]` : `[${key}]`
  }
  return parent ? `${parent}.${key}` : key
}

function collect(value: unknown, path: string, depth: number, options: ExtractOptions, acc: Entry[]) {
  if (Array.isArray(value)) {
    if (depth > 0 && !options.includeArrays) return
    value.forEach((item, index) => {
      const next = childPath(path, index)
      acc.push({ path: next, key: String(index), value: item })
      if (item !== null && typeof item === 'object') {
        collect(item, next, depth + 1, options, acc)
      }
    })
    return
  }

  if (!isObject(value)) return
  if (depth > 0 && !options.includeNested) return

  for (const [key, child] of Object.entries(value)) {
    const next = childPath(path, key)
    acc.push({ path: next, key, value: child })
    if (child !== null && typeof child === 'object') {
      collect(child, next, depth + 1, options, acc)
    }
  }
}

export function collectEntries(data: unknown, options: ExtractOptions): Entry[] {
  const acc: Entry[] = []
  collect(data, '', 0, options, acc)
  return acc
}

function parseFields(raw: string): string[] {
  return unique(
    raw
      .split(/[,，;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function tokenizePath(path: string): (string | number)[] {
  const source = path.replace(/^\$\.?/, '').trim()
  if (!source) return []
  const tokens: (string | number)[] = []
  const matcher = /([^[.\]]+)|\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = matcher.exec(source))) {
    if (match[1] != null) tokens.push(match[1])
    else tokens.push(Number(match[2]))
  }
  return tokens
}

export function getByPath(root: unknown, path: string): { found: boolean; value: unknown } {
  const tokens = tokenizePath(path)
  if (!tokens.length) return { found: false, value: undefined }
  let current: unknown = root
  for (const token of tokens) {
    if (current == null || typeof current !== 'object') {
      return { found: false, value: undefined }
    }
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token < 0 || token >= current.length) {
        return { found: false, value: undefined }
      }
      current = current[token]
      continue
    }
    if (Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, token)) {
      return { found: false, value: undefined }
    }
    current = (current as Record<string, unknown>)[token]
  }
  return { found: true, value: current }
}

function looksLikePath(field: string) {
  return field.includes('.') || field.includes('[')
}

function stringifyValue(value: unknown): string {
  if (value == null) return String(value)
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function csvCell(value: unknown): string {
  const text = stringifyValue(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function encode(data: unknown, format: OutputFormat, pretty: boolean): string {
  const space = pretty ? 2 : 0
  if (format === 'json' || format === 'array') {
    return JSON.stringify(data, null, space)
  }
  if (format === 'text') {
    if (Array.isArray(data)) return data.map(stringifyValue).join('\n')
    if (isObject(data)) {
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${stringifyValue(value)}`)
        .join('\n')
    }
    return stringifyValue(data)
  }
  if (Array.isArray(data)) {
    const rows = data.map((item) => (Array.isArray(item) ? item : [item]))
    return toCsv(rows)
  }
  if (isObject(data)) {
    return toCsv(
      [['field', 'value'], ...Object.entries(data).map(([key, value]) => [key, value])],
    )
  }
  return csvCell(data)
}

function pickPayload(
  mode: ExtractMode,
  format: OutputFormat,
  entries: Entry[],
  data: unknown,
  fieldsRaw: string,
): unknown {
  if (mode === 'keys') {
    const keys = unique(entries.filter((item) => item.key != null && !/^\d+$/.test(item.key)).map((item) => item.key as string))
    return keys
  }
  if (mode === 'values') {
    return entries.map((item) => item.value)
  }
  if (mode === 'paths') {
    return unique(entries.map((item) => item.path))
  }

  const fields = parseFields(fieldsRaw)
  if (!fields.length) {
    throw new Error('请填写要提取的字段，例如 name, user.email')
  }

  const objectResult: Record<string, unknown> = {}
  const arrayResult: unknown[] = []
  for (const field of fields) {
    let value: unknown
    if (looksLikePath(field)) {
      const hit = getByPath(data, field)
      if (!hit.found) {
        throw new Error(`未找到字段：${field}`)
      }
      value = hit.value
    } else {
      const matches = entries.filter((item) => item.key === field).map((item) => item.value)
      if (!matches.length) {
        const hit = getByPath(data, field)
        if (!hit.found) {
          throw new Error(`未找到字段：${field}`)
        }
        value = hit.value
      } else {
        value = matches.length === 1 ? matches[0] : matches
      }
    }
    objectResult[field] = value
    arrayResult.push(value)
  }
  return format === 'array' || format === 'text' ? arrayResult : objectResult
}

export function extractJson(input: string, mode: ExtractMode, format: OutputFormat, options: ExtractOptions): string {
  const data = parseJson(input)
  const entries = collectEntries(data, options)
  const payload = pickPayload(mode, format, entries, data, options.fields)
  if (format === 'array' && !Array.isArray(payload)) {
    return encode(Object.values(payload as Record<string, unknown>), format, options.pretty)
  }
  return encode(payload, format, options.pretty)
}
