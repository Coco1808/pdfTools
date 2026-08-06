import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
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
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
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
