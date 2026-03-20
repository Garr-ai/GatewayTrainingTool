/**
 * main.tsx — Application entry point
 *
 * This is the first file executed by Vite. It mounts the React application
 * into the `#root` div in `index.html`.
 *
 * StrictMode is enabled in development to surface potential issues (e.g.,
 * double-invoking effects and renders) without affecting production behaviour.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Mount the root React component. The `!` asserts that the element exists;
// if index.html is missing the <div id="root"> the app will throw here.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
