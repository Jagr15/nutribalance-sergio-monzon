import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { RuntimeConfigErrorScreen } from './infrastructure/api/RuntimeConfigErrorScreen'
import { runtimeConfig } from './infrastructure/api/runtimeConfig'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {runtimeConfig.status === 'invalid' ? (
      <RuntimeConfigErrorScreen runtimeConfig={runtimeConfig} />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>,
)
