import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { WelcomePage } from './pages/WelcomePage'
import { HomePage } from './pages/HomePage'
import { DocsAppsPage } from './pages/DocsAppsPage'
import { CodeAppsPage } from './pages/CodeAppsPage'
import { LifeAppsPage } from './pages/LifeAppsPage'
import { MergePage } from './pages/MergePage'
import { InvoicePage } from './pages/InvoicePage'
import { ReplacePage } from './pages/ReplacePage'
import { TextablePage } from './pages/TextablePage'
import { TocPage } from './pages/TocPage'
import { SplitPage } from './pages/SplitPage'
import { CompressPage } from './pages/CompressPage'
import { WatermarkPage } from './pages/WatermarkPage'

export default function App() {
  return (
    <Routes>
      {/* 进入项目先到欢迎页 */}
      <Route path="/" element={<WelcomePage />} />

      <Route element={<Layout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/docs" element={<DocsAppsPage />} />
        <Route path="/code" element={<CodeAppsPage />} />
        <Route path="/life" element={<LifeAppsPage />} />
        <Route path="/merge" element={<MergePage />} />
        <Route path="/split" element={<SplitPage />} />
        <Route path="/compress" element={<CompressPage />} />
        <Route path="/watermark" element={<WatermarkPage />} />
        <Route path="/replace" element={<ReplacePage />} />
        <Route path="/textable" element={<TextablePage />} />
        <Route path="/toc" element={<TocPage />} />
        <Route path="/invoice" element={<InvoicePage />} />
      </Route>
    </Routes>
  )
}
