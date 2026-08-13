import type { AppCard } from '../shared/catalog'

export const codeAppCards: AppCard[] = [
  { to: '/naming', title: '变量起名', desc: '中文含义转英文命名并一键复制', icon: 'naming' },
  { to: '/json', title: 'JSON工具', desc: '格式化 JSON，提取键名、值、路径或指定字段', icon: 'json' },
]

export const codeToolPaths = codeAppCards.map((item) => item.to)
