import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import supabase from './lib/supabase'
import Inventory from './pages/Inventory'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Reports from './pages/Reports'
import MultiChannel from './pages/MultiChannel'
import Transactions from './pages/Transactions'
import UpdatePassword from './pages/UpdatePassword'

const LOGO_B64 = 'data:image/png;base64,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'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg> },
  { to: '/inventory', label: 'Inventory', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
  { to: '/transactions', label: 'Transactions', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" /></svg> },
  { to: '/reports', label: 'Reports', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
  { to: '/multichannel', label: 'Multi-Channel', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg> },
]

function Sidebar({ session, userRole, onClose, isMobile }) {
  const location = useLocation()
  return (
    <aside className="flex flex-col h-full w-64 bg-[#0F1A24] text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <img src={LOGO_B64} alt="Upcycle 4 Better" className="h-10 w-10 object-contain rounded-lg bg-white p-1 flex-shrink-0" />
        <div>
          <p className="font-bold text-white text-sm leading-tight">Upcycle 4 Better</p>
          <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Inventory</p>
        </div>
        {isMobile && (
          <button onClick={onClose} className="ml-auto text-white/40 hover:text-white/80 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-3 pb-2">Navigation</p>
        {NAV_LINKS.map(link => {
          const active = location.pathname === link.to
          return (
            <Link key={link.to} to={link.to} onClick={isMobile ? onClose : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${active ? 'nav-active' : 'text-white/50 hover:text-white/90 hover:bg-white/5'}`}>
              <span className={`transition-colors ${active ? 'text-[#5A96BE]' : 'text-white/30 group-hover:text-white/60'}`}>{link.icon}</span>
              {link.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A0B464]"></span>}
            </Link>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5">
          <div className="w-8 h-8 rounded-full bg-[#3C78A0]/30 border border-[#3C78A0]/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[#A0C8DC] text-xs font-bold uppercase">{session?.user?.email?.[0] || 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">{session?.user?.email}</p>
            <p className="text-[10px] text-white/30 capitalize">{userRole || 'staff'}</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} title="Sign out" className="text-white/30 hover:text-rose-400 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

function AppContent() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUserRole(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setIsPasswordRecovery(true); setSession(session); setLoading(false); return }
      if (event === 'USER_UPDATED') setIsPasswordRecovery(false)
      setSession(session)
      if (session) fetchUserRole(session.user.id)
      else { setUserRole(null); setIsPasswordRecovery(false); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserRole(userId) {
    try {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).single()
      if (error && error.code !== 'PGRST116') throw error
      setUserRole(data?.role || 'staff')
    } catch { setUserRole('staff') }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1A24]">
      <div className="text-center">
        <img src={LOGO_B64} alt="U4B" className="w-16 h-16 object-contain mx-auto mb-4 rounded-xl bg-white p-2" />
        <div className="w-8 h-8 border-2 border-[#3C78A0] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-white/40 text-sm font-medium">Loading...</p>
      </div>
    </div>
  )

  if (isPasswordRecovery) return <Routes><Route path="*" element={<UpdatePassword onDone={() => setIsPasswordRecovery(false)} />} /></Routes>

  if (!session) return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="*" element={<Login />} />
    </Routes>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#EEF2F5]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col flex-shrink-0"><Sidebar session={session} userRole={userRole} /></div>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full flex flex-col">
            <Sidebar session={session} userRole={userRole} onClose={() => setSidebarOpen(false)} isMobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0F1A24] border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_B64} alt="U4B" className="h-8 w-8 object-contain rounded-lg bg-white p-1" />
            <span className="text-white font-bold text-sm">Upcycle 4 Better</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/multichannel" element={<MultiChannel />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return <Router><AppContent /></Router>
}
