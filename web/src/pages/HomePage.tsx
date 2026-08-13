import { CatalogPage } from './CatalogPage'
import { homeCards } from '../lib/apps'

export function HomePage() {
  return <CatalogPage title="首页" items={homeCards} />
}
