export type AppCard = {
  to: string
  title: string
  desc: string
  icon:
    | 'merge'
    | 'split'
    | 'compress'
    | 'watermark'
    | 'replace'
    | 'textable'
    | 'toc'
    | 'invoice'
    | 'images'
    | 'pdfImages'
    | 'naming'
    | 'json'
    | 'docs'
    | 'code'
    | 'life'
}
