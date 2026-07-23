import type { Translator } from '../i18n/i18n'
import { Icon } from './Icon'
export type StatusViewState = 'ready' | 'loading' | 'empty' | 'error'
type BaseStatusViewProps = { operationMessage?: string | null; t: Translator }
type StatusViewProps =
  | (BaseStatusViewProps & { state: 'error'; errorMessage: string; onRetry: () => void })
  | (BaseStatusViewProps & { state: 'ready' | 'loading' | 'empty'; onRetry?: never })
export function StatusView(props: StatusViewProps) {
  const { operationMessage, t } = props
  return <>
    {props.state === 'loading' ? <p className="status-message" role="status" aria-live="polite">{t('loading')}</p> : null}
    {props.state === 'empty' ? <div className="status-panel empty-state"><p>{t('emptyTitle')}</p><p>{t('emptyHint')}</p></div> : null}
    {props.state === 'error' ? <div className="status-panel error-state" role="alert"><p>{props.errorMessage}</p><button className="retry-button" type="button" onClick={props.onRetry}><Icon name="refresh" />{t('retry')}</button></div> : null}
    {operationMessage ? <p className="status-message operation-message" role="status" aria-live="polite">{operationMessage}</p> : null}
  </>
}
