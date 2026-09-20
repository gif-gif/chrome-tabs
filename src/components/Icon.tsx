import type { SVGProps } from 'react'

export type IconName =
  | 'search'
  | 'close'
  | 'copy'
  | 'pin'
  | 'star'
  | 'deduplicate'
  | 'sort-domain'
  | 'eye'
  | 'eye-off'
  | 'chevron'
  | 'chevron-left'
  | 'chevron-right'
  | 'tab'
  | 'refresh'
  | 'clear'
  | 'all-tabs'
  | 'window'
  | 'active-tab'
  | 'globe'
  | 'palette'
  | 'list'
  | 'group'
  | 'collapse-all'
  | 'expand-all'
  | 'check'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'name'> {
  name: IconName
}

const paths: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  pin: (
    <>
      <path d="M12 17v5" />
      <path d="M7 3h10l-2 6 3 3v2H6v-2l3-3-2-6Z" />
    </>
  ),
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.5-4.4 6.2-.9L12 3Z" />,
  deduplicate: (
    <>
      <rect x="4" y="5" width="11" height="11" rx="2" />
      <path d="M9 19h8a2 2 0 0 0 2-2V9M8 9l4 4M12 9l-4 4" />
    </>
  ),
  'sort-domain': (
    <>
      <path d="M4 6h10M4 12h7M4 18h4" />
      <path d="M17 5v14m0 0-3-3m3 3 3-3" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3 21 21" />
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.3 3.1M6.3 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3.2-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  tab: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M7 7h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M18.5 16a8 8 0 1 1 .8-7.5L20 12" />
    </>
  ),
  clear: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  'all-tabs': (
    <>
      <rect x="3" y="5" width="14" height="12" rx="2" />
      <path d="M7 3h12a2 2 0 0 1 2 2v12M7 9h6" />
    </>
  ),
  window: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8h18M7 6h.01M10 6h.01" />
    </>
  ),
  'active-tab': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <circle cx="12" cy="14" r="2.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 1.4-2.9l-.5-.7a1.8 1.8 0 0 1 1.4-2.9H18a3 3 0 0 0 3-3C21 6.8 17 3 12 3Z" />
      <circle cx="7.5" cy="11.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r=".75" fill="currentColor" stroke="none" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  group: (
    <>
      <rect x="3" y="4" width="8" height="7" rx="1" />
      <rect x="13" y="4" width="8" height="7" rx="1" />
      <rect x="3" y="13" width="8" height="7" rx="1" />
      <rect x="13" y="13" width="8" height="7" rx="1" />
    </>
  ),
  'collapse-all': <path d="m7 15 5-5 5 5M7 10l5-5 5 5" />,
  'expand-all': <path d="m7 9 5 5 5-5M7 14l5 5 5-5" />,
  check: <path d="m5 12 4 4L19 6" />,
}

export function Icon({ name, width = 18, height = 18, ...props }: IconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}
