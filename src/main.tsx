import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './acfc-brand.css'
import './index.css'
import { iniciarSync } from './lib/sync'

void iniciarSync().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
