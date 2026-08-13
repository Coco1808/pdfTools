import { CatalogPage } from '../shared/catalog'
import { docAppCards } from './cards'

export function DocsAppsPage() {
  return <CatalogPage title="文档应用" items={docAppCards} />
}
