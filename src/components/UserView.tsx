/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Plus, UserPlus, Shield, ToggleLeft, ToggleRight, X, Mail, Check, User, Trash2, Edit, Coffee } from 'lucide-react';

interface UserViewProps {
  currentUser: any;
}

export default function UserView({ currentUser }: UserViewProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cafes, setCafes] = useState<any[]>([]);
  const [selectedCafeId, setSelectedCafeId] = useState('');
  const [editCafeId, setEditCafeId] = useState('');

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'kasir'>('kasir');

  // Edit Form Modal States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'kasir'>('kasir');

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    type: 'danger' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users?userId=${currentUser?.ID_User}`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCafes = async () => {
    try {
      const res = await fetch('/api/cafes');
      const data = await res.json();
      setCafes(data);
      if (data.length > 0) {
        setSelectedCafeId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching cafes:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCafes();

    const handleUpdate = () => {
      fetchUsers();
      fetchCafes();
    };
    window.addEventListener('ws_db_update', handleUpdate);
    return () => {
      window.removeEventListener('ws_db_update', handleUpdate);
    };
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nama.trim() || !email.trim() || !password.trim()) {
      alert('Mohon isi seluruh data form pendaftaran.');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama,
          email,
          password,
          role,
          status: 'active',
          actorId: currentUser.ID_User,
          cafeId: currentUser.Role === 'admin' ? currentUser.cafeId : selectedCafeId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsFormOpen(false);
        setNama('');
        setEmail('');
        setPassword('');
        setRole('kasir');
        fetchUsers();
      } else {
        alert(data.message || 'Gagal menambahkan pengguna.');
      }
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string, name: string) => {
    if (userId === currentUser.ID_User) {
      alert('Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif!');
      return;
    }

    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const confirmMsg = nextStatus === 'inactive' 
      ? `Apakah Anda yakin ingin MENONAKTIFKAN akun kasir "${name}"? Kasir ini tidak akan bisa login.`
      : `Aktifkan kembali akun kasir "${name}"?`;

    setConfirmDialog({
      isOpen: true,
      title: nextStatus === 'inactive' ? 'Nonaktifkan Kasir' : 'Aktifkan Kasir',
      message: confirmMsg,
      type: 'warning',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: nextStatus,
              actorId: currentUser.ID_User,
            }),
          });

          const result = await res.json();
          if (result.success) {
            fetchUsers();
          } else {
            alert(result.message || 'Gagal merubah status.');
          }
        } catch (err) {
          console.error('Error updating user status:', err);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleRole = async (userId: string, currentRole: string, name: string) => {
    if (userId === currentUser.ID_User) {
      alert('Anda tidak dapat mengubah hak akses Anda sendiri!');
      return;
    }

    const nextRole = currentRole === 'admin' ? 'kasir' : 'admin';
    
    setConfirmDialog({
      isOpen: true,
      title: 'Ubah Hak Akses',
      message: `Ubah peran "${name}" menjadi ${nextRole.toUpperCase()}?`,
      type: 'info',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: nextRole,
              actorId: currentUser.ID_User,
            }),
          });

          const result = await res.json();
          if (result.success) {
            fetchUsers();
          }
        } catch (err) {
          console.error('Error toggling user role:', err);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleOpenEditModal = (user: any) => {
    setEditUserId(user.ID_User);
    setEditNama(user.Nama);
    setEditEmail(user.Email);
    setEditPassword('');
    setEditRole(user.Role);
    setEditCafeId(user.cafeId || '');
    setIsEditOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editNama.trim() || !editEmail.trim()) {
      alert('Nama dan Email tidak boleh kosong.');
      return;
    }

    try {
      const body: any = {
        nama: editNama,
        email: editEmail,
        role: editRole,
        actorId: currentUser.ID_User,
        cafeId: editCafeId,
      };
      if (editPassword.trim()) {
        body.password = editPassword;
      }

      const res = await fetch(`/api/users/${editUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setIsEditOpen(false);
        fetchUsers();
      } else {
        alert(data.message || 'Gagal mengubah detail pengguna.');
      }
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (userId === currentUser.ID_User) {
      alert('Anda tidak dapat menghapus akun Anda sendiri!');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Akun Kasir',
      message: `Apakah Anda yakin ingin MENGHAPUS akun "${name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${userId}?actorId=${currentUser.ID_User}`, {
            method: 'DELETE',
          });

          const data = await res.json();
          if (data.success) {
            fetchUsers();
          } else {
            alert(data.message || 'Gagal menghapus pengguna.');
          }
        } catch (err) {
          console.error('Error deleting user:', err);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const filteredUsers = (users || []).filter((u) => {
    if (!u) return false;
    const matchesSearch = (u.Nama || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                          (u.Email || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    
    // Admin (owner cafe) only sees users of their own cafe and cannot see/manage other admins or creators
    if (currentUser.Role === 'admin') {
      return matchesSearch && u.cafeId === currentUser.cafeId && u.Role !== 'admin' && u.Role !== 'creator';
    }
    
    // Creator can see everything
    return matchesSearch;
  });

  return (
    <div id="users-management-container" className="space-y-6">
      
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="user-master-heading" className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Manajemen Pengguna (Kasir & Admin)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Kelola data akun kasir, ubah status keaktifan, dan atur hak akses peran operasional secara langsung.
          </p>
        </div>

        {(currentUser.Role === 'admin' || currentUser.Role === 'creator') && (
          <button
            id="open-add-user-btn"
            onClick={() => {
              if (currentUser.Role === 'admin') {
                setSelectedCafeId(currentUser.cafeId || '');
              }
              setIsFormOpen(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-700 transition cursor-pointer shadow-lg shadow-amber-600/10"
          >
            <UserPlus className="h-4.5 w-4.5" />
            Tambah Kasir Baru
          </button>
        )}
      </div>

      {/* Search Input Filter */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            id="user-search-input"
            type="text"
            placeholder="Cari pengguna berdasarkan nama atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500 font-semibold text-xs transition"
          />
        </div>
      </div>

      {/* Users Data Grid */}
      {loading ? (
        <div className="text-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-zinc-400 text-xs mt-2">Memuat daftar kasir...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
          <p className="text-zinc-500 text-sm font-semibold">Tidak ada kasir/pengguna ditemukan.</p>
        </div>
      ) : (
        <div id="users-table-wrapper" className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left">
            <thead className="bg-zinc-50 dark:bg-[#1f1a16] text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Nama Pengguna</th>
                <th className="px-6 py-4">Kontak Email</th>
                <th className="px-6 py-4">Hak Akses Role</th>
                <th className="px-6 py-4">Status Akun</th>
                <th className="px-6 py-4">Tanggal Gabung</th>
                {(currentUser.Role === 'admin' || currentUser.Role === 'creator') && <th className="px-6 py-4 text-right">Tindakan Admin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {filteredUsers.map((u) => (
                <tr key={u.ID_User} className="hover:bg-zinc-50/50 dark:hover:bg-[#25201c]/30 transition">
                  {/* Name with avatar badge */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                        {u.Nama.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{u.Nama}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold">
                          <span className="text-amber-600 font-mono uppercase">{u.ID_User}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded max-w-[130px] truncate" title={cafes.find(c => c.id === u.cafeId)?.namaToko || 'Default Outlet'}>
                            {cafes.find(c => c.id === u.cafeId)?.namaToko || 'Default Outlet'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-4 font-mono">{u.Email}</td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <button
                      id={`toggle-role-${u.ID_User}`}
                      onClick={() => (currentUser.Role === 'admin' || currentUser.Role === 'creator') && handleToggleRole(u.ID_User, u.Role, u.Nama)}
                      disabled={(currentUser.Role !== 'admin' && currentUser.Role !== 'creator') || u.ID_User === currentUser.ID_User}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 transition
                        ${u.Role === 'creator'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10'
                          : u.Role === 'admin' 
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}
                        ${(currentUser.Role === 'admin' || currentUser.Role === 'creator') && u.ID_User !== currentUser.ID_User ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      <Shield className="h-3 w-3" />
                      {u.Role}
                    </button>
                  </td>

                  {/* Status Toggle */}
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide
                      ${u.Status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' 
                        : 'bg-rose-500/10 text-rose-600'}`}>
                      {u.Status === 'active' ? 'Aktif' : 'Non-aktif'}
                    </span>
                  </td>

                  {/* Created At */}
                  <td className="px-6 py-4 text-zinc-400 dark:text-zinc-500 font-mono">
                    {(() => {
                      if (!u.Created_At) return '-';
                      const d = new Date(u.Created_At);
                      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { dateStyle: 'medium' });
                    })()}
                  </td>

                  {/* Admin toggles */}
                  {(currentUser.Role === 'admin' || currentUser.Role === 'creator') && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.ID_User !== currentUser.ID_User ? (
                          <>
                            {/* Toggle Status */}
                            <button
                              id={`toggle-status-btn-${u.ID_User}`}
                              onClick={() => handleToggleStatus(u.ID_User, u.Status, u.Nama)}
                              className={`p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-1 cursor-pointer text-xs font-bold transition
                                ${u.Status === 'active' ? 'text-zinc-600 hover:text-rose-500' : 'text-emerald-600'}`}
                              title={u.Status === 'active' ? 'Deaktivasi Akun' : 'Aktifkan Akun'}
                            >
                              {u.Status === 'active' ? (
                                <>
                                  <ToggleRight className="h-4.5 w-4.5 text-emerald-500" />
                                  <span className="sr-only sm:not-sr-only">Deaktif</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="h-4.5 w-4.5 text-zinc-400" />
                                  <span className="sr-only sm:not-sr-only">Aktifkan</span>
                                </>
                              )}
                            </button>

                            {/* Edit User */}
                            <button
                              id={`edit-user-btn-${u.ID_User}`}
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-amber-600 hover:text-amber-700 flex items-center justify-center gap-1 cursor-pointer text-xs font-bold transition"
                              title="Ubah Detail Pengguna"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span className="sr-only sm:not-sr-only">Ubah</span>
                            </button>

                            {/* Delete User */}
                            <button
                              id={`delete-user-btn-${u.ID_User}`}
                              onClick={() => handleDeleteUser(u.ID_User, u.Nama)}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 hover:text-rose-700 flex items-center justify-center gap-1 cursor-pointer text-xs font-bold transition"
                              title="Hapus Akun Pengguna"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only sm:not-sr-only">Hapus</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-400 italic">Akun Anda</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}      {/* --- ADD USER FORM DIALOG --- */}
      {isFormOpen && (
        <div id="user-form-dialog" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden">
            <button
              id="close-user-dialog"
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 pb-2">
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-lg flex items-center gap-2">
                <UserPlus className="h-5.5 w-5.5 text-amber-500" />
                Daftarkan Akun Kasir Baru
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Tambahkan data staf pelaksana kasir atau manajemen untuk mengoperasikan sistem POS Maissy Coffee.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
                {/* Nama Lengkap */}
                <div className="space-y-1.5">
                  <label htmlFor="user-fullname-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="user-fullname-field"
                    type="text"
                    placeholder="Masukkan nama lengkap staf..."
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="user-email-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> Alamat Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="user-email-field"
                    type="email"
                    placeholder="Contoh: kasir.rian@maissy.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="user-pwd-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Kata Sandi Baru <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="user-pwd-field"
                    type="password"
                    placeholder="Minimal 6 karakter..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                    required
                  />
                </div>

                {/* Peran / Hak Akses */}
                <div className="space-y-1.5">
                  <label htmlFor="user-role-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Peran & Hak Akses <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="user-role-field"
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition font-bold"
                    disabled={currentUser.Role === 'admin'}
                  >
                    <option value="kasir">User (Kasir)</option>
                    {currentUser.Role === 'creator' && (
                      <>
                        <option value="admin">Admin (Owner/Manager)</option>
                        <option value="creator">Pembuat Aplikasi (Creator)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Outlet Cafe / Warung */}
                {role !== 'creator' && (
                  <div className="space-y-1.5">
                    <label htmlFor="user-cafe-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <Coffee className="h-3.5 w-3.5" /> Outlet Cafe / Warung <span className="text-rose-500">*</span>
                    </label>
                    {currentUser.Role === 'admin' ? (
                      <input
                        type="text"
                        value={cafes.find((c) => c.id === currentUser.cafeId)?.namaToko || 'Outlet Anda'}
                        disabled
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#1a1613]/50 text-zinc-500 dark:text-zinc-400 text-xs font-bold cursor-not-allowed"
                      />
                    ) : (
                      <select
                        id="user-cafe-field"
                        value={selectedCafeId}
                        onChange={(e) => setSelectedCafeId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition font-bold"
                        required
                      >
                        {cafes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.namaToko}
                          </option>
                        ))}
                        {cafes.length === 0 && <option value="cafe-maissy-coffee">Default Cafe (Maissy Coffee)</option>}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Action */}
              <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#201c18]/50 flex justify-end gap-3 rounded-b-2xl font-semibold">
                <button
                  type="button"
                  id="cancel-user-form"
                  onClick={() => setIsFormOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="submit-user-form"
                  className="py-2.5 px-5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 cursor-pointer transition shadow-lg shadow-amber-600/10 flex items-center gap-1"
                >
                  <Check className="h-4 w-4" />
                  Daftarkan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT USER FORM DIALOG --- */}
      {isEditOpen && (
        <div id="edit-user-dialog" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden">
            <button
              id="close-edit-user-dialog"
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 pb-2">
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-lg flex items-center gap-2">
                <Edit className="h-5.5 w-5.5 text-amber-500" />
                Ubah Data Akun Pengguna
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Ubah informasi profil atau ganti kata sandi akun pengguna terpilih.
              </p>
            </div>

            <form onSubmit={handleEditUser} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
                {/* Nama Lengkap */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-user-fullname-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="edit-user-fullname-field"
                    type="text"
                    placeholder="Masukkan nama lengkap staf..."
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-user-email-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> Alamat Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="edit-user-email-field"
                    type="email"
                    placeholder="Contoh: kasir.rian@maissy.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-user-pwd-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Kata Sandi Baru <span className="text-zinc-400 font-normal">(Kosongkan jika tidak ingin mengubah)</span>
                  </label>
                  <input
                    id="edit-user-pwd-field"
                    type="password"
                    placeholder="Minimal 6 karakter..."
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                {/* Peran / Hak Akses */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-user-role-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Peran & Hak Akses <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="edit-user-role-field"
                    value={editRole}
                    onChange={(e: any) => setEditRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition font-bold"
                    disabled={currentUser.Role === 'admin'}
                  >
                    <option value="kasir">User (Kasir)</option>
                    {currentUser.Role === 'creator' && (
                      <>
                        <option value="admin">Admin (Owner/Manager)</option>
                        <option value="creator">Pembuat Aplikasi (Creator)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Outlet Cafe / Warung */}
                {editRole !== 'creator' && (
                  <div className="space-y-1.5">
                    <label htmlFor="edit-user-cafe-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <Coffee className="h-3.5 w-3.5" /> Outlet Cafe / Warung <span className="text-rose-500">*</span>
                    </label>
                    {currentUser.Role === 'admin' ? (
                      <input
                        type="text"
                        value={cafes.find((c) => c.id === currentUser.cafeId)?.namaToko || 'Outlet Anda'}
                        disabled
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#1a1613]/50 text-zinc-500 dark:text-zinc-400 text-xs font-bold cursor-not-allowed"
                      />
                    ) : (
                      <select
                        id="edit-user-cafe-field"
                        value={editCafeId}
                        onChange={(e) => setEditCafeId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition font-bold"
                        required
                      >
                        {cafes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.namaToko}
                          </option>
                        ))}
                        {cafes.length === 0 && <option value="cafe-maissy-coffee">Default Cafe (Maissy Coffee)</option>}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Action */}
              <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#201c18]/50 flex justify-end gap-3 rounded-b-2xl font-semibold">
                <button
                  type="button"
                  id="cancel-edit-user-form"
                  onClick={() => setIsEditOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="submit-edit-user-form"
                  className="py-2.5 px-5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 cursor-pointer transition shadow-lg shadow-amber-600/10 flex items-center gap-1"
                >
                  <Check className="h-4 w-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- REUSABLE CONFIRMATION DIALOG --- */}
      {confirmDialog.isOpen && (
        <div id="reusable-confirm-dialog" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-sm bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 
                ${confirmDialog.type === 'danger' ? 'bg-rose-500/10 text-rose-600' :
                  confirmDialog.type === 'warning' ? 'bg-amber-500/10 text-amber-600' :
                  'bg-sky-500/10 text-sky-600'}`}
              >
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition text-center"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`flex-1 py-2.5 px-4 rounded-xl text-white font-bold text-xs cursor-pointer transition text-center shadow-lg
                  ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' :
                    confirmDialog.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' :
                    'bg-sky-600 hover:bg-sky-700 shadow-sky-600/10'}`}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
