import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SessionApp from './SessionApp.tsx'
import { applyTheme, readTheme } from './theme'

applyTheme(readTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionApp />
  </StrictMode>,
)
