/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, Upload, Check, CloudLightning } from 'lucide-react';
import { Menu } from '../types.js';

// Preset library removed as requested

interface MenuViewProps {
  currentUser: any;
  onAddLog: (action: string, module: string, desc: string) => void;
}

export default function MenuView({ currentUser, onAddLog }: MenuViewProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editId, setEditId] = useState('');
  
  const [namaMenu, setNamaMenu] = useState('');
  const [kategori, setKategori] = useState('Minuman');
  const [harga, setHarga] = useState<number | ''>('');
  const [status, setStatus] = useState<'Tersedia' | 'Habis'>('Tersedia');
  
  // Image URL State
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string>('');

  // Delete Confirmation Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<{ id: string; name: string } | null>(null);

  // Settings
  const [driveFolderId, setDriveFolderId] = useState('1nXzPzQ2lqqaATvNybfTqcYU9lHc2DuG5');

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/menus');
      const data = await res.json();
      setMenus(data);
    } catch (err) {
      console.error('Error fetching menus:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();

    const handleUpdate = () => {
      fetchMenus();
    };
    window.addEventListener('ws_db_update', handleUpdate);
    return () => {
      window.removeEventListener('ws_db_update', handleUpdate);
    };
  }, []);

  const handleOpenAdd = () => {
    setFormMode('add');
    setNamaMenu('');
    setKategori('Minuman');
    setHarga('');
    setStatus('Tersedia');
    setFotoPreview('');
    setFotoUrl('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (menu: Menu) => {
    setFormMode('edit');
    setEditId(menu.ID_Menu);
    setNamaMenu(menu.Nama_Menu);
    setKategori(menu.Kategori);
    setHarga(menu.Harga);
    setStatus(menu.Status);
    setFotoPreview(menu.Foto_URL);
    setFotoUrl(menu.Foto_URL);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!namaMenu.trim() || harga === '') {
      alert('Silakan lengkapi seluruh kolom yang wajib diisi.');
      return;
    }

    const payload = {
      nama: namaMenu,
      kategori,
      harga: Number(harga),
      status,
      fotoBase64: '',
      fotoFileName: '',
      fotoUrl: convertGoogleDriveUrl(fotoUrl),
      actorId: currentUser.ID_User,
    };

    try {
      const url = formMode === 'add' ? '/api/menus' : `/api/menus/${editId}`;
      const method = formMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        setIsFormOpen(false);
        fetchMenus();
      } else {
        alert(result.message || 'Gagal menyimpan menu.');
      }
    } catch (err: any) {
      console.error('Error saving menu:', err);
      alert(`Terjadi kesalahan koneksi ke server: ${err.message || err}`);
    }
  };

  const triggerDeleteMenu = (id: string, name: string) => {
    setMenuToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const executeDeleteMenu = async () => {
    if (!menuToDelete) return;
    const { id } = menuToDelete;

    try {
      const res = await fetch(`/api/menus/${id}?actorId=${currentUser.ID_User}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (result.success) {
        fetchMenus();
        setDeleteConfirmOpen(false);
        setMenuToDelete(null);
      } else {
        alert(result.message || 'Gagal menghapus menu.');
      }
    } catch (err) {
      console.error('Error deleting menu:', err);
      alert('Terjadi kesalahan koneksi saat menghapus menu.');
    }
  };

  const getNormalizedCategory = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower === 'coffee' || lower === 'non-coffee' || lower === 'minuman') return 'Minuman';
    if (lower === 'snacks' || lower === 'desserts' || lower === 'makanan') return 'Makanan';
    return cat;
  };

  const filteredMenus = menus.filter((m) => {
    const matchesSearch = m.Nama_Menu.toLowerCase().includes(searchQuery.toLowerCase());
    const normalizedMenuCat = getNormalizedCategory(m.Kategori);
    const matchesCategory = selectedCategory === 'Semua' || normalizedMenuCat === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['Semua', 'Makanan', 'Minuman'];

  // Helper to convert Google Drive sharing links to direct image source links
  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return url;
    
    let fileId = '';
    
    // Pattern 1: /file/d/FILE_ID
    const dMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    // Pattern 2: id=FILE_ID or &id=FILE_ID
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    
    if (dMatch && dMatch[1]) {
      fileId = dMatch[1];
    } else if (idMatch && idMatch[1]) {
      fileId = idMatch[1];
    }

    if (fileId) {
      // Use lh3.googleusercontent.com/d/FILE_ID as it is extremely robust,
      // doesn't have same-site cookie restrictions, and bypasses blocks in preview iframes.
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    return url;
  };

  return (
    <div id="menu-management-container" className="space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="menu-master-heading" className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Manajemen Data Menu
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Tambah, edit, atau hapus menu Kafe Maissy Coffee.
          </p>
        </div>

        {(currentUser.Role === 'admin' || currentUser.Role === 'creator') && (
          <button
            id="open-add-menu-btn"
            onClick={handleOpenAdd}
            className="py-2.5 px-4 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-700 transition cursor-pointer shadow-lg shadow-amber-600/10"
          >
            <Plus className="h-4.5 w-4.5" />
            Tambah Menu Baru
          </button>
        )}
      </div>

      {/* Search and Category Tabs */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            id="menu-search-input"
            type="text"
            placeholder="Cari menu berdasarkan nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500 font-semibold text-xs transition"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              id={`tab-menu-cat-${cat.toLowerCase()}`}
              onClick={() => setSelectedCategory(cat)}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition
                ${selectedCategory === cat 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-zinc-50 dark:bg-[#25201c] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#342d27]'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menus Table/Grid List */}
      {loading ? (
        <div className="text-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-zinc-400 text-xs mt-2">Memuat basis data menu...</p>
        </div>
      ) : filteredMenus.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
          <p className="text-zinc-500 text-sm font-semibold">Tidak ada menu yang ditemukan.</p>
          <p className="text-zinc-400 text-xs mt-1">Sesuaikan kata kunci pencarian Anda.</p>
        </div>
      ) : (
        <div id="menus-table-wrapper" className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left">
            <thead className="bg-zinc-50 dark:bg-[#1f1a16] text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Foto</th>
                <th className="px-6 py-4">Kode Menu</th>
                <th className="px-6 py-4">Nama Menu</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Harga</th>
                <th className="px-6 py-4">Status</th>
                {(currentUser.Role === 'admin' || currentUser.Role === 'creator') && <th className="px-6 py-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {filteredMenus.map((menu) => (
                <tr key={menu.ID_Menu} className="hover:bg-zinc-50/50 dark:hover:bg-[#25201c]/30 transition">
                  <td className="px-6 py-4">
                    <div className="h-11 w-11 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={menu.Foto_URL}
                        alt={menu.Nama_Menu}
                        className="object-cover w-full h-full"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200';
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-amber-600 dark:text-amber-500 font-bold">{menu.ID_Menu}</td>
                  <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">{menu.Nama_Menu}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {getNormalizedCategory(menu.Kategori)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-zinc-900 dark:text-zinc-100 font-bold">
                    Rp {menu.Harga.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide
                      ${menu.Status === 'Tersedia' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-500'}`}>
                      {menu.Status}
                    </span>
                  </td>
                  {(currentUser.Role === 'admin' || currentUser.Role === 'creator') && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          id={`edit-menu-${menu.ID_Menu}`}
                          onClick={() => handleOpenEdit(menu)}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1a1613] hover:bg-zinc-50 dark:hover:bg-[#25201c] text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-500 transition cursor-pointer"
                          title="Ubah Menu"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          id={`del-menu-${menu.ID_Menu}`}
                          onClick={() => triggerDeleteMenu(menu.ID_Menu, menu.Nama_Menu)}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1a1613] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-400 hover:text-rose-600 transition cursor-pointer"
                          title="Hapus Menu"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- ADD/EDIT MENU FORM DIALOG --- */}
      {isFormOpen && (
        <div id="menu-form-dialog" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 relative">
            <button
              id="close-menu-dialog"
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-lg">
              {formMode === 'add' ? 'Tambah Item Menu Baru' : `Ubah Item Menu ${editId}`}
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Lengkapi detail menu dan unggah foto produk kopi atau makanan pendamping.
            </p>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Menu */}
                <div className="space-y-1.5">
                  <label htmlFor="menu-name-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Nama Menu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="menu-name-field"
                    type="text"
                    placeholder="Contoh: Es Kopi Susu Aren"
                    value={namaMenu}
                    onChange={(e) => setNamaMenu(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                    required
                  />
                </div>

                {/* Kategori */}
                <div className="space-y-1.5">
                  <label htmlFor="menu-cat-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="menu-cat-field"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Harga */}
                <div className="space-y-1.5">
                  <label htmlFor="menu-price-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Harga Jual (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="menu-price-field"
                    type="number"
                    placeholder="Contoh: 18000"
                    value={harga}
                    onChange={(e) => setHarga(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs font-bold focus:outline-none focus:border-amber-500 transition"
                    required
                  />
                </div>

                {/* Status Ketersediaan */}
                <div className="space-y-1.5">
                  <label htmlFor="menu-status-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Status Menu <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="status-available-btn"
                      onClick={() => setStatus('Tersedia')}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer
                        ${status === 'Tersedia' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-500' 
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      Tersedia
                    </button>
                    <button
                      type="button"
                      id="status-soldout-btn"
                      onClick={() => setStatus('Habis')}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer
                        ${status === 'Habis' 
                          ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-500' 
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      Habis
                    </button>
                  </div>
                </div>
              </div>

              {/* URL Input Field */}
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="menu-url-field" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block">
                    URL Gambar Menu (Format HTTP/HTTPS)
                  </label>
                  <input
                    id="menu-url-field"
                    type="url"
                    placeholder="Contoh: https://images.unsplash.com/... atau link Google Drive"
                    value={fotoUrl}
                    onChange={(e) => {
                      const converted = convertGoogleDriveUrl(e.target.value.trim());
                      setFotoUrl(converted);
                      setFotoPreview(converted); // Sync preview to URL
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-normal">
                  💡 <strong>Tips Google Drive:</strong> Tempelkan link sharing biasa dari Google Drive. Aplikasi akan otomatis mengubahnya menjadi link gambar langsung. Pastikan akses file diatur ke <strong>"Siapa saja yang memiliki link"</strong> agar gambar dapat muncul.
                </p>

                {fotoUrl && (
                  <div className="mt-2 flex flex-col items-center p-2.5 bg-zinc-50 dark:bg-[#25201c]/40 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">Pratinjau Gambar:</p>
                    <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <img 
                        src={fotoUrl} 
                        alt="Preview URL" 
                        className="object-cover w-full h-full" 
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Action */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  id="cancel-menu-form"
                  onClick={() => setIsFormOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="submit-menu-form"
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
      {/* --- DELETE CONFIRMATION DIALOG --- */}
      {deleteConfirmOpen && menuToDelete && (
        <div id="delete-confirm-dialog" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-sm bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setDeleteConfirmOpen(false);
                setMenuToDelete(null);
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="h-12 h-12 w-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base">
                Konfirmasi Hapus Menu
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus menu <strong className="text-zinc-950 dark:text-zinc-100 font-semibold">"{menuToDelete.name}"</strong>? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setMenuToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition text-center"
              >
                Batal
              </button>
              <button
                type="button"
                id="confirm-delete-menu-btn"
                onClick={executeDeleteMenu}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer transition text-center shadow-lg shadow-rose-600/10"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
