import type { Translator } from '../i18n/i18n'
import { getStorePageUrl, openStorePage } from '../chrome/storePage'

interface ExtensionBrandProps {
  t: Translator
  storePageUrl?: string | null
}

export function ExtensionBrand({ t, storePageUrl = getStorePageUrl() }: ExtensionBrandProps) {
  const name = t('extensionName')
  const content = (
    <>
      {/* 32px source keeps the 16px icon sharp on 2x displays. */}
      <img className="extension-brand-icon" src="icons/icon-32.png" width={16} height={16} alt="" />
      <span className="extension-brand-name">{name}</span>
    </>
  )

  if (!storePageUrl) {
    return <span className="extension-brand">{content}</span>
  }

  const label = `${name} – ${t('viewInChromeWebStore')}`
  return (
    <a
      className="extension-brand"
      href={storePageUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={t('viewInChromeWebStore')}
      onClick={(event) => {
        event.preventDefault()
        void openStorePage(storePageUrl).catch(() => undefined)
      }}
    >
      {content}
    </a>
  )
}
