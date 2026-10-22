// Entry point: React starts here and renders <App /> into <div id="root">
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { DataProvider } from './lib/dataStore'
import ErrorBoundary from './components/ErrorBoundary'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('index.html is missing <div id="root">')

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      {/* BrowserRouter lets us have pages like /search and /privacy */}
      <BrowserRouter>
        {/* DataProvider loads listings from the server (or uses the bundled copy) */}
        <DataProvider>
          <App />
        </DataProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
