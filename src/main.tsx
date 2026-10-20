import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

// Tab admin terbuka seharian: setelah deploy Vercel, chunk halaman lama sudah tidak ada (404). Muat ulang
// untuk ambil versi baru; dijaga 10 dtk supaya chunk yang memang rusak tidak bikin reload tanpa henti.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('admin_chunk_reload') || 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem('admin_chunk_reload', String(Date.now()))
  } catch {
    return // storage diblokir: tanpa penjaga, reload bisa berputar terus
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
