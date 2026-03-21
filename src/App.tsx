import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PF from './pages/PF'
import PJ1 from './pages/PJ1'
import PJ2 from './pages/PJ2'
import Configuracoes from './pages/Configuracoes'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 24, maxWidth: 600, width: '100%' }}>
            <h2 style={{ color: '#ff453a', marginBottom: 12, fontFamily: 'monospace' }}>Erro na aplicação</h2>
            <pre style={{ color: '#a1a1aa', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {(this.state.error as Error).message}
              {'\n\n'}
              {(this.state.error as Error).stack}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pf" element={<PF />} />
              <Route path="/pj1" element={<PJ1 />} />
              <Route path="/pj2" element={<PJ2 />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
