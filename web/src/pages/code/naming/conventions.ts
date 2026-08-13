export function pascalCase(words: string[]) {
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
}

export function camelCase(words: string[]) {
  const value = pascalCase(words)
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : ''
}

export function snakeCase(words: string[]) {
  return words.map((w) => w.toLowerCase()).join('_')
}

export function kebabCase(words: string[]) {
  return words.map((w) => w.toLowerCase()).join('-')
}

export function screamCase(words: string[]) {
  return snakeCase(words).toUpperCase()
}

export type NameCard = {
  id: string
  label: string
  value: string
}

type PrefixPair = {
  key: string
  label: string
  prefix: string
}

const VARIABLE_TYPES: PrefixPair[] = [
  { key: 'global', label: '全局变量', prefix: 'g' },
  { key: 'string', label: '字符串变量', prefix: 's' },
  { key: 'number', label: '数字变量', prefix: 'n' },
  { key: 'bool', label: '逻辑变量', prefix: 'b' },
  { key: 'array', label: '数组变量', prefix: 'a' },
  { key: 'regex', label: '正则命名', prefix: 'r' },
  { key: 'func', label: '函数命名', prefix: 'f' },
  { key: 'member', label: '成员变量', prefix: 'm' },
  { key: 'tmp', label: '临时变量', prefix: 'tmp' },
  { key: 'state', label: '状态变量', prefix: 'state' },
]

type MethodRule =
  | { key: string; label: string; kind: 'prefix'; affix: string }
  | { key: string; label: string; kind: 'suffixPascal'; affix: string }
  | { key: string; label: string; kind: 'suffixCamel'; affix: string }

const METHOD_RULES: MethodRule[] = [
  { key: 'load', label: '加载方法', kind: 'prefix', affix: 'load' },
  { key: 'can', label: '判断执行', kind: 'prefix', affix: 'can' },
  { key: 'has', label: '判断包含', kind: 'prefix', affix: 'has' },
  { key: 'is', label: '判断存在', kind: 'prefix', affix: 'is' },
  { key: 'fn', label: '事件函数', kind: 'prefix', affix: 'fn' },
  { key: 'iface', label: '接口类', kind: 'prefix', affix: 'i' },
  { key: 'impl', label: '接口实现类', kind: 'suffixPascal', affix: 'Impl' },
  { key: 'get', label: 'get方法', kind: 'prefix', affix: 'get' },
  { key: 'set', label: 'set方法', kind: 'prefix', affix: 'set' },
  { key: 'query', label: '查询方法', kind: 'prefix', affix: 'query' },
  { key: 'view', label: '查看方法', kind: 'prefix', affix: 'view' },
  { key: 'details', label: '详情方法', kind: 'suffixCamel', affix: 'Details' },
  { key: 'read', label: '读取方法', kind: 'prefix', affix: 'read' },
  { key: 'create', label: '创建方法', kind: 'prefix', affix: 'create' },
  { key: 'save', label: '保存方法', kind: 'prefix', affix: 'save' },
  { key: 'add', label: '新增方法', kind: 'prefix', affix: 'add' },
  { key: 'emit', label: '生成方法', kind: 'prefix', affix: 'emit' },
  { key: 'update', label: '更新方法', kind: 'prefix', affix: 'update' },
  { key: 'edit', label: '编辑方法', kind: 'prefix', affix: 'edit' },
  { key: 'clear', label: '清除方法', kind: 'prefix', affix: 'clear' },
  { key: 'delete', label: '删除方法', kind: 'prefix', affix: 'delete' },
  { key: 'remove', label: '删除方法2', kind: 'prefix', affix: 'remove' },
  { key: 'destroy', label: '移除方法', kind: 'prefix', affix: 'destroy' },
  { key: 'upload', label: '上传方法', kind: 'prefix', affix: 'upload' },
  { key: 'down', label: '下载方法', kind: 'prefix', affix: 'down' },
  { key: 'cache', label: '缓存方法', kind: 'prefix', affix: 'cache' },
]

export type NamingSection = {
  title: string
  cards: NameCard[]
}

export function buildNamingSections(words: string[]): NamingSection[] {
  const pascal = pascalCase(words)
  const camel = camelCase(words)

  const common: NameCard[] = [
    { id: 'const', label: '常量', value: screamCase(words) },
    { id: 'pascal', label: '大驼峰(类命名)', value: pascal },
    { id: 'camel', label: '小驼峰(方法命名)', value: camel },
    { id: 'snake', label: '下划线', value: snakeCase(words) },
    { id: 'lead-snake', label: '前下划线', value: `_${snakeCase(words)}` },
    { id: 'kebab', label: '项目名', value: kebabCase(words) },
  ]

  const variables: NameCard[] = VARIABLE_TYPES.flatMap((item) => [
    {
      id: `${item.key}-camel`,
      label: `${item.label}(驼峰)`,
      value: `${item.prefix}${pascal}`,
    },
    {
      id: `${item.key}-under`,
      label: `${item.label}(下划线)`,
      value: `${item.prefix}_${camel}`,
    },
  ])

  const methods: NameCard[] = METHOD_RULES.map((rule) => {
    if (rule.kind === 'suffixPascal') {
      return { id: rule.key, label: rule.label, value: `${pascal}${rule.affix}` }
    }
    if (rule.kind === 'suffixCamel') {
      return { id: rule.key, label: rule.label, value: `${camel}${rule.affix}` }
    }
    return { id: rule.key, label: rule.label, value: `${rule.affix}${pascal}` }
  })

  return [
    { title: '常见命名', cards: common },
    { title: '变量命名', cards: variables },
    { title: '方法命名', cards: methods },
  ]
}
