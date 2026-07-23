import type { Translator } from '../i18n/i18n'
import { Icon } from './Icon'
interface DrawerToggleProps { onClose: () => void; t: Translator; pending?: boolean }
export function DrawerToggle({ onClose, t, pending = false }: DrawerToggleProps) {
  return <div className="drawer-rail"><button type="button" className="drawer-toggle" aria-label={t('closeSidePanel')} onClick={onClose} disabled={pending}><Icon name="chevron-right" width={16} height={16} /></button></div>
}
