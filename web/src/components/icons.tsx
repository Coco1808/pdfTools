import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  )
}

export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Icon>
  )
}

export function IconDocs(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.5V9h5.5" />
    </Icon>
  )
}

export function IconCode(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m14 6-4 12" />
    </Icon>
  )
}

export function IconLife(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </Icon>
  )
}

export function IconMerge(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v6H8zM5 14h6v6H5zM13 14h6v6h-6z" />
      <path d="M12 10v4" />
    </Icon>
  )
}

export function IconSplit(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v16H8z" />
      <path d="M12 4v16" />
    </Icon>
  )
}

export function IconCompress(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v16H8z" />
      <path d="M10 12h4M12 9.5v5" />
    </Icon>
  )
}

export function IconWatermark(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5h14v14H5z" />
      <path d="m8 16 2.2-6 2.3 6 2.2-6 2.3 6" />
    </Icon>
  )
}

export function IconReplace(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 7h7v10H7z" />
      <path d="M14 10h4v8h-7" />
    </Icon>
  )
}

export function IconTextable(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 5h12M12 5v14M8 19h8" />
    </Icon>
  )
}

export function IconToc(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 7h12M6 12h12M6 17h8" />
    </Icon>
  )
}

export function IconInvoice(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v16l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4z" />
      <path d="M9 9h6M9 13h6" />
    </Icon>
  )
}

export function IconImages(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6h14v12H5z" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m8 16 3.2-3.4 2.3 2.4 2.2-2.6L19 16" />
    </Icon>
  )
}

export function IconPdfImages(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4h7l4 4v4" />
      <path d="M13 4v4h4" />
      <path d="M5 13h14v7H5z" />
      <circle cx="8.4" cy="15.6" r="0.9" />
      <path d="m7.4 20 2.2-2.2 1.6 1.5 1.7-1.8L16.8 20" />
    </Icon>
  )
}

export function IconNaming(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 19 4.5-14h1.6L16.6 19" />
      <path d="M7.8 13h7.2" />
      <path d="M18.2 8v8M16.4 16.8 18.2 19l1.8-2.2" />
    </Icon>
  )
}

export function IconJson(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5c-2 0-3 1.2-3 3v2.2c0 1-.6 1.8-2 2 1.4.2 2 1 2 2V16c0 1.8 1 3 3 3" />
      <path d="M16 5c2 0 3 1.2 3 3v2.2c0 1 .6 1.8 2 2-1.4.2-2 1-2 2V16c0 1.8-1 3-3 3" />
    </Icon>
  )
}
