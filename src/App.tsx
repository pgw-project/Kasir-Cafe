/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Coffee, LayoutDashboard, ShoppingCart, BookOpen, Users, 
  FileText, Settings as SettingsIcon, LogOut, Menu as Hamburger, 
  X, Lock, Mail, UserCheck, ShieldAlert, KeyRound, Sparkles, AlertCircle,
  MessageSquare, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Sub-views
import ThemeToggle from './components/ThemeToggle.jsx';
import DashboardView from './components/DashboardView.jsx';
import POSView from './components/POSView.jsx';
import MenuView from './components/MenuView.jsx';
import UserView from './components/UserView.jsx';
import ReportView from './components/ReportView.jsx';
import SettingsView from './components/SettingsView.jsx';
import AuditLogView from './components/AuditLogView.jsx';

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved === 'true';
  });

  // Auth states
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Auth inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regNama, setRegNama] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'kasir' | 'admin'>('kasir');

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');

  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  // Page layout states
  const [activePage, setActivePage] = useState<'dashboard' | 'pos' | 'menu' | 'users' | 'reports' | 'logs' | 'settings'>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // --- REAL-TIME WEBSOCKET STATES & HOOKS ---
  const [presenceUsers, setPresenceUsers] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [wsSocket, setWsSocket] = useState<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      if (wsSocket) {
        wsSocket.close();
        setWsSocket(null);
      }
      setPresenceUsers([]);
      setChatMessages([]);
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pingInterval: any = null;

    const connectWS = () => {
      setWsStatus('connecting');
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}`;
      
      const ws = new WebSocket(wsUrl);
      socket = ws;
      setWsSocket(ws);

      ws.onopen = () => {
        setWsStatus('connected');
        ws.send(JSON.stringify({
          type: 'identify',
          user: currentUser,
          currentView: activePage,
        }));

        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence') {
            setPresenceUsers(data.users);
          } else if (data.type === 'chat_history') {
            setChatMessages(data.history);
          } else if (data.type === 'chat') {
            setChatMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message].slice(-50);
            });
            
            setIsChatOpen(open => {
              if (!open) {
                setUnreadCount(c => c + 1);
              }
              return open;
            });
            
            const ev = new CustomEvent('ws_chat', { detail: data.message });
            window.dispatchEvent(ev);
          } else if (data.type === 'db_update') {
            const ev = new CustomEvent('ws_db_update', { detail: data });
            window.dispatchEvent(ev);
          }
        } catch (err) {
          console.error('Error parsing websocket message:', err);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        clearInterval(pingInterval);
        reconnectTimeout = setTimeout(() => {
          if (currentUser) connectWS();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket client error:', err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (socket) {
        socket.close();
      }
      clearTimeout(reconnectTimeout);
      clearInterval(pingInterval);
    };
  }, [currentUser]);

  useEffect(() => {
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(JSON.stringify({
        type: 'change_view',
        currentView: activePage,
      }));
    }
  }, [activePage, wsSocket]);

  // Apply Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('isDarkMode', String(isDarkMode));
  }, [isDarkMode]);

  // Auth Actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAuthError('Email dan sandi harus diisi.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          setAuthError(parsed.message || `Login gagal (Status: ${res.status}).`);
        } catch {
          setAuthError(`Koneksi gagal (${res.status}): ${text.substring(0, 80)}...`);
        }
        return;
      }

      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Reset states
        setLoginEmail('');
        setLoginPassword('');
        setActivePage('dashboard');
      } else {
        setAuthError(data.message || 'Login gagal.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(`Koneksi ke server terputus: ${err.message || err}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');

    if (!regNama.trim() || !regEmail.trim() || !regPassword.trim()) {
      setAuthError('Seluruh kolom formulir pendaftaran wajib diisi.');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: regNama,
          email: regEmail,
          password: regPassword,
          role: regRole,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          setAuthError(parsed.message || `Pendaftaran gagal (Status: ${res.status}).`);
        } catch {
          setAuthError(`Koneksi gagal (${res.status}): ${text.substring(0, 80)}...`);
        }
        return;
      }

      const data = await res.json();
      if (data.success) {
        setAuthSuccessMsg('Pendaftaran staf berhasil! Silakan login.');
        setAuthMode('login');
        // Pre-fill email
        setLoginEmail(regEmail);
        
        // Reset fields
        setRegNama('');
        setRegEmail('');
        setRegPassword('');
        setRegRole('kasir');
      } else {
        setAuthError(data.message || 'Pendaftaran gagal.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(`Kesalahan koneksi ke server: ${err.message || err}`);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');

    if (!forgotEmail.trim() || !forgotNewPassword.trim()) {
      setAuthError('Silakan isi email dan sandi baru Anda.');
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, newPassword: forgotNewPassword }),
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          setAuthError(parsed.message || `Reset gagal (Status: ${res.status}).`);
        } catch {
          setAuthError(`Koneksi gagal (${res.status}): ${text.substring(0, 80)}...`);
        }
        return;
      }

      const data = await res.json();
      if (data.success) {
        setAuthSuccessMsg(data.message || 'Sandi berhasil diubah. Silakan login.');
        setAuthMode('login');
        setLoginEmail(forgotEmail);
        
        setForgotEmail('');
        setForgotNewPassword('');
      } else {
        setAuthError(data.message || 'Email tidak terdaftar.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(`Gagal menghubungi server: ${err.message || err}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    setToken(null);
    setCurrentUser(null);
    setActivePage('dashboard');
  };

  // Helper log addition (for visual logs backup)
  const appendLog = async (action: string, module: string, desc: string) => {
    console.log(`[Activity Log: ${module}] Action: ${action} - Description: ${desc}`);
  };

  // Render correct main view page based on active selection
  const renderActiveView = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardView currentUser={currentUser} onNavigate={(p: any) => setActivePage(p)} />;
      case 'pos':
        return <POSView currentUser={currentUser} addLog={appendLog} />;
      case 'menu':
        return <MenuView currentUser={currentUser} onAddLog={appendLog} />;
      case 'users':
        return <UserView currentUser={currentUser} />;
      case 'reports':
        return <ReportView currentUser={currentUser} />;
      case 'logs':
        return <AuditLogView />;
      case 'settings':
        return <SettingsView currentUser={currentUser} />;
      default:
        return <DashboardView currentUser={currentUser} onNavigate={(p: any) => setActivePage(p)} />;
    }
  };

  // Side navigation links (filtered based on role)
  const navLinks = [
    { id: 'dashboard', label: 'Dashboard Analitik', icon: LayoutDashboard, roles: ['admin', 'kasir'] },
    { id: 'pos', label: 'Transaksi POS', icon: ShoppingCart, roles: ['admin', 'kasir'] },
    { id: 'menu', label: 'Katalog Menu (CRUD)', icon: BookOpen, roles: ['admin'] },
    { id: 'users', label: 'Kelola Pengguna', icon: Users, roles: ['admin'] },
    { id: 'reports', label: 'Laporan Penjualan', icon: FileText, roles: ['admin', 'kasir'] },
    { id: 'logs', label: 'Audit Trail Logs', icon: KeyRound, roles: ['admin'] },
    { id: 'settings', label: 'Pengaturan Kafe', icon: SettingsIcon, roles: ['admin'] },
  ];

  const allowedLinks = navLinks.filter(link => currentUser && link.roles.includes(currentUser.Role));

  // --- LOGGED OUT AUTH VIEW ---
  if (!token || !currentUser) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-[#0c0a09] flex items-center justify-center p-4 transition-colors duration-300">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle isDarkMode={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
        </div>

        <motion.div 
          id="auth-card-container"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-[#1a1613] border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Top Logo and Branding */}
          <div className="flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-amber-600/10 text-amber-600 flex items-center justify-center mb-4 border border-amber-600/20">
              <Coffee className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 font-sans">
              Kafe Maissy Coffee
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-semibold uppercase tracking-wider">
              POS & Management Suite
            </p>
          </div>

          {/* Validation Alert Lines */}
          {authError && (
            <div id="auth-error-alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-500 flex items-center gap-2">
              <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccessMsg && (
            <div id="auth-success-alert" className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
              <UserCheck className="h-4.5 w-4.5 flex-shrink-0" />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          {/* AUTH FORMS CHANGER */}
          <AnimatePresence mode="wait">
            {authMode === 'login' && (
              <motion.form 
                key="login-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin} 
                className="space-y-4"
              >
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Mail className="h-4 w-4" /> Kontak Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="nama@maissy.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500 text-xs font-semibold transition"
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="login-password" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Lock className="h-4 w-4" /> Kata Sandi
                    </label>
                    <button
                      type="button"
                      id="link-forgot-pwd"
                      onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccessMsg(''); }}
                      className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer"
                    >
                      Lupa Sandi?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500 text-xs font-semibold transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  id="auth-login-btn"
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-lg shadow-amber-600/15 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserCheck className="h-4 w-4" />
                  Masuk Operasional
                </button>
              </motion.form>
            )}

            {authMode === 'register' && (
              <motion.form 
                key="register-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleRegister} 
                className="space-y-4"
              >
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-nama" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Nama Lengkap</label>
                  <input
                    id="reg-nama"
                    type="text"
                    placeholder="Nama lengkap Anda..."
                    value={regNama}
                    onChange={(e) => setRegNama(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 text-xs font-semibold transition"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Email Kerja</label>
                  <input
                    id="reg-email"
                    type="email"
                    placeholder="nama@maissy.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 text-xs font-semibold transition"
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-password" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Kata Sandi Baru</label>
                  <input
                    id="reg-password"
                    type="password"
                    placeholder="Min 6 Karakter..."
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 text-xs font-semibold transition"
                    required
                  />
                </div>

                {/* Role select */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-role" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Peran Sistem</label>
                  <select
                    id="reg-role"
                    value={regRole}
                    onChange={(e: any) => setRegRole(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 text-xs font-bold focus:outline-none focus:border-amber-500 transition"
                  >
                    <option value="kasir">User (Kasir Maissy)</option>
                    <option value="admin">Admin (Manager/Owner)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  id="auth-register-btn"
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-lg shadow-amber-600/15 transition cursor-pointer"
                >
                  Daftarkan Akun
                </button>
              </motion.form>
            )}

            {authMode === 'forgot' && (
              <motion.form 
                key="forgot-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleForgotPassword} 
                className="space-y-4"
              >
                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Alamat Email Terdaftar</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="nama@maissy.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 text-xs font-semibold transition"
                    required
                  />
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label htmlFor="forgot-new-pwd" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Kata Sandi Baru</label>
                  <input
                    id="forgot-new-pwd"
                    type="password"
                    placeholder="Masukkan sandi baru Anda..."
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c]/60 text-zinc-950 dark:text-zinc-100 text-xs font-semibold transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  id="auth-reset-btn"
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-lg shadow-amber-600/15 transition cursor-pointer"
                >
                  Setel Ulang Kata Sandi
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Toggle buttons to switch Auth Mode */}
          <div className="flex justify-between text-xs font-bold border-t border-zinc-100 dark:border-zinc-800/80 pt-4 text-zinc-500 dark:text-zinc-400">
            {authMode === 'login' ? (
              <>
                <span>Belum punya akun?</span>
                <button
                  id="link-register"
                  onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccessMsg(''); }}
                  className="text-amber-600 hover:underline cursor-pointer"
                >
                  Registrasi Staf
                </button>
              </>
            ) : (
              <>
                <span>Sudah punya akun?</span>
                <button
                  id="link-login"
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccessMsg(''); }}
                  className="text-amber-600 hover:underline cursor-pointer"
                >
                  Silakan Login
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // --- MAIN APP PORTAL VIEW (LOGGED IN) ---
  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#0c0a09] text-zinc-900 dark:text-zinc-100 transition-colors duration-300 flex flex-col md:flex-row">
      
      {/* Mobile Top Header (hidden on md screens) */}
      <header className="md:hidden bg-white dark:bg-[#110e0c] border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <Coffee className="h-5.5 w-5.5 text-amber-500" />
          <span className="font-extrabold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Maissy Coffee</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle isDarkMode={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
          <button
            id="mobile-menu-trigger"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#1a1613] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
          >
            {isMobileSidebarOpen ? <X className="h-5 w-5" /> : <Hamburger className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Responsive Collapsible Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Sidebar (Desktop / Tablet Persistent, Mobile Drawer) */}
      <aside 
        id="sidebar-panel"
        className={`fixed md:sticky top-0 left-0 bottom-0 z-40 w-64 bg-white dark:bg-[#110e0c] border-r border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between transform transition-transform duration-300 md:transform-none h-screen
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="p-2 bg-amber-600/10 rounded-xl text-amber-600">
              <Coffee className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight text-zinc-950 dark:text-zinc-50">Maissy Coffee</h2>
              <span className="text-[10px] text-amber-600 dark:text-amber-500 font-extrabold uppercase tracking-widest block mt-0.5">POS System</span>
            </div>
          </div>

          {/* User profile brief card */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1a1613] border border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">
              {currentUser.Nama.charAt(0)}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 block truncate">{currentUser.Nama}</span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block uppercase font-bold tracking-wide">{currentUser.Role}</span>
            </div>
          </div>

          {/* Realtime Active Presence Users */}
          {presenceUsers.length > 1 && (
            <div className="p-3 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2 bg-emerald-500/5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Staf Aktif ({presenceUsers.length})</span>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {presenceUsers
                  .filter(u => u.ID_User !== currentUser.ID_User)
                  .map((u, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {u.Nama.charAt(0)}
                        </div>
                        <div className="min-w-0 text-left">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 block truncate leading-tight">{u.Nama}</span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block capitalize leading-none">{u.Role}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-[#1a1613] px-1.5 py-0.5 rounded shrink-0">
                        {u.currentView === 'pos' ? 'POS' : u.currentView === 'menu' ? 'Menu' : u.currentView === 'users' ? 'Staf' : u.currentView === 'reports' ? 'Laporan' : u.currentView === 'logs' ? 'Log' : u.currentView === 'settings' ? 'Setelan' : 'Dashboard'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Navigation Links List */}
          <nav className="space-y-1">
            {allowedLinks.map((link) => {
              const IconComp = link.icon;
              const isActive = activePage === link.id;
              return (
                <button
                  key={link.id}
                  id={`nav-link-${link.id}`}
                  onClick={() => {
                    setActivePage(link.id as any);
                    setIsMobileSidebarOpen(false); // Auto close mobile
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl flex items-center gap-3 font-semibold text-xs transition cursor-pointer
                    ${isActive 
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/15 font-bold' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1613]'}`}
                >
                  <IconComp className="h-4.5 w-4.5" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-4">
          {/* Theme switcher on desktop sidebar */}
          <div className="hidden md:flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Pilih Tema</span>
            <ThemeToggle isDarkMode={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
          </div>

          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-3 transition cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main id="main-content-panel" className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-y-auto h-screen md:h-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            {renderActiveView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Realtime Staff Chat Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="w-80 h-96 bg-white dark:bg-[#110e0c] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3"
            >
              {/* Chat Header */}
              <div className="px-4 py-3 bg-amber-600 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-bold text-xs">Pesan Instan Staf</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <button
                  id="close-chat"
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50 dark:bg-[#1a1613]">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <MessageSquare className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-1" />
                    <p className="text-xs text-zinc-400 dark:text-zinc-600">Belum ada obrolan. Mulai sapa rekan kerja Anda!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isSelf = msg.user.ID_User === currentUser.ID_User;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium mb-0.5 px-1">
                          {msg.user.Nama} ({msg.user.Role})
                        </span>
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-xl text-xs break-all shadow-xs text-left
                            ${isSelf
                              ? 'bg-amber-600 text-white rounded-tr-none'
                              : 'bg-white dark:bg-[#221e1a] text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-800 rounded-tl-none'}`}
                        >
                          {msg.message}
                        </div>
                        <span className="text-[8px] text-zinc-400/80 dark:text-zinc-500/80 mt-0.5 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMessage.trim() || !wsSocket) return;
                  wsSocket.send(JSON.stringify({
                    type: 'chat',
                    message: newMessage.trim(),
                  }));
                  setNewMessage('');
                }}
                className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#110e0c] flex gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ketik pesan..."
                  className="flex-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50 dark:bg-[#1a1613] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-600"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Toggle Button */}
        <button
          id="toggle-chat-drawer"
          onClick={() => {
            setIsChatOpen(!isChatOpen);
            setUnreadCount(0);
          }}
          className="p-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg hover:shadow-xl transition flex items-center justify-center cursor-pointer relative"
        >
          <MessageSquare className="h-5.5 w-5.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-bold h-5 w-5 rounded-full flex items-center justify-center animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
