import { Link } from 'react-router-dom'
import type { AppCard } from './types'
import {
  IconCode,
  IconCompress,
  IconDocs,
  IconInvoice,
  IconImages,
  IconPdfImages,
  IconNaming,
  IconJson,
  IconLife,
  IconMerge,
  IconReplace,
  IconSplit,
  IconTextable,
  IconToc,
  IconWatermark,
} from '../../../components/icons'
import './CatalogPage.less'

const icons = {
  merge: IconMerge,
  split: IconSplit,
  compress: IconCompress,
  watermark: IconWatermark,
  replace: IconReplace,
  textable: IconTextable,
  toc: IconToc,
  invoice: IconInvoice,
  images: IconImages,
  pdfImages: IconPdfImages,
  naming: IconNaming,
  json: IconJson,
  docs: IconDocs,
  code: IconCode,
  life: IconLife,
}

type CatalogPageProps = {
  title: string
  items: AppCard[]
  empty?: string
}

export function CatalogPage({ title, items, empty }: CatalogPageProps) {
  return (
    <div className="apps-page">
      <h1 className="apps-title">{title}</h1>
      {items.length ? (
        <div className="apps-grid">
          {items.map((item) => {
            const Glyph = icons[item.icon]
            return (
              <Link key={item.to} to={item.to} className="app-card">
                <span className="app-card-icon">
                  <Glyph />
                </span>
                <h2>{item.title}</h2>
                <p>{item.desc}</p>
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="apps-empty">{empty ?? '即将推出'}</p>
      )}
    </div>
  )
}
