import { CatalogPage } from '../shared/catalog'
import { codeAppCards } from './cards'

export function CodeAppsPage() {
  return <CatalogPage title="编程应用" items={codeAppCards} />
}
