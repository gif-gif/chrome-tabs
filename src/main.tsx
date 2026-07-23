import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createSafeChromeTabsApi } from './chrome/chromeTabs'
import './styles.css'

const api = createSafeChromeTabsApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} />
  </StrictMode>,
)
