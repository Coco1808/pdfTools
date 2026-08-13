import { CatalogPage } from './CatalogPage'
import { docAppCards } from '../lib/apps'

export function DocsAppsPage() {
  return <CatalogPage title="文档应用" items={docAppCards} />
}
