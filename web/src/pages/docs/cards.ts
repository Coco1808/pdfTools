import type { AppCard } from '../shared/catalog'

export const docAppCards: AppCard[] = [
  { to: '/merge', title: 'PDF合并', desc: '合并多个PDF文件', icon: 'merge' },
  { to: '/split', title: 'PDF拆分', desc: '按页码或每N页拆分', icon: 'split' },
  { to: '/compress', title: 'PDF压缩', desc: '缩小文件体积', icon: 'compress' },
  { to: '/watermark', title: '添加水印', desc: '为页面加上文字水印', icon: 'watermark' },
  { to: '/replace', title: '替换页面', desc: '用另一份PDF替换指定页', icon: 'replace' },
  { to: '/textable', title: '转可复制', desc: 'OCR 或提取文字生成可复制PDF', icon: 'textable' },
  { to: '/toc', title: '生成目录', desc: '识别标题并插入可点击目录', icon: 'toc' },
  { to: '/images-to-pdf', title: '图片转PDF', desc: '多张图片按顺序合成一份PDF', icon: 'images' },
  { to: '/pdf-to-images', title: 'PDF转图片', desc: '将每一页导出为PNG或JPG', icon: 'pdfImages' },
  { to: '/invoice', title: '发票汇总', desc: '识别金额并按类型合计', icon: 'invoice' },
]

export const docToolPaths = docAppCards.map((item) => item.to)
