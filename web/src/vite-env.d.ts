/// <reference types="vite/client" />

declare module '*.less' {
  const content: string
  export default content
}

declare module 'pdfjs-dist/build/pdf.worker.min.js?url' {
  const url: string
  export default url
}