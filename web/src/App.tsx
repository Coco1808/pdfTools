import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import {
  WelcomePage,
  HomePage,
  DocsAppsPage,
  CodeAppsPage,
  LifeAppsPage,
  MergePage,
  SplitPage,
  CompressPage,
  WatermarkPage,
  ReplacePage,
  TextablePage,
  TocPage,
  InvoicePage,
  ImagesToPdfPage,
  PdfToImagesPage,
  NamingPage,
  JsonPage,
} from './pages'

export default function App() {
  return (
    <Routes>
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
        <Route path="/images-to-pdf" element={<ImagesToPdfPage />} />
        <Route path="/pdf-to-images" element={<PdfToImagesPage />} />
        <Route path="/naming" element={<NamingPage />} />
        <Route path="/json" element={<JsonPage />} />
      </Route>
    </Routes>
  )
}
