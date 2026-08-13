import { CatalogPage } from '../shared/catalog'
import { homeCards } from './cards'

export function HomePage() {
  return <CatalogPage title="首页" items={homeCards} />
}
