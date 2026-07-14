/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, CheckCircle, Printer, X, QrCode, Banknote, FileText, Bluetooth, Wifi, Usb } from 'lucide-react';
import { Menu } from '../types.js';
import { getReceiptUrl } from '../utils/firebaseClient.js';
import { 
  connectPrinter, 
  disconnectPrinter, 
  getConnectedPrinter, 
  isBluetoothSupported, 
  printBluetoothReceipt 
} from '../utils/bluetoothPrinter.js';
import {
  connectUsbPrinter,
  disconnectUsbPrinter,
  getConnectedUsbPrinter,
  isUsbSupported,
  printUsbReceipt
} from '../utils/usbPrinter.js';

interface POSViewProps {
  currentUser: any;
  addLog: (action: string, module: string, desc: string) => void;
}

export interface CartItem extends Menu {
  qty: number;
}

export default function POSView({ currentUser, addLog }: POSViewProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  
  // Mobile active tab state (Katalog vs Keranjang)
  const [activeMobileTab, setActiveMobileTab] = useState<'catalog' | 'cart'>('catalog');
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [namaPelanggan, setNamaPelanggan] = useState('');
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [uangBayar, setUangBayar] = useState<number | ''>('');
  const [errorCheckout, setErrorCheckout] = useState('');
  
  // Payment method and print dialog
  const [metodeBayar, setMetodeBayar] = useState<'TUNAI' | 'QRIS'>('TUNAI');
  const [isPrintOptionOpen, setIsPrintOptionOpen] = useState(false);
  const [printTxId, setPrintTxId] = useState('');
  
  // Success Modal State
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [latestTx, setLatestTx] = useState<any>(null);

  // Bluetooth Printer states
  const [btStatus, setBtStatus] = useState<{ connected: boolean; name?: string }>({ connected: false });
  const [btLoading, setBtLoading] = useState(false);

  // USB Printer states
  const [usbStatus, setUsbStatus] = useState<{ connected: boolean; name?: string }>({ connected: false });
  const [usbLoading, setUsbLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    setBtStatus(getConnectedPrinter());
    setUsbStatus(getConnectedUsbPrinter());
  }, []);

  const handleConnectBluetooth = async () => {
    setBtLoading(true);
    try {
      const status = await connectPrinter();
      setBtStatus(status);
      if (status.connected) {
        alert(`Berhasil terhubung ke printer Bluetooth: ${status.deviceName}`);
      } else if (status.error) {
        alert(status.error);
      }
    } catch (err: any) {
      alert('Gagal menyambung ke Bluetooth: ' + err.message);
    } finally {
      setBtLoading(false);
    }
  };

  const handleDisconnectBluetooth = async () => {
    await disconnectPrinter();
    setBtStatus({ connected: false });
  };

  const handlePrintBluetooth = async (paperSize: '58' | '80') => {
    try {
      const [txDetailsRes, settingsRes] = await Promise.all([
        fetch(`/api/transactions?userId=${currentUser?.ID_User || ''}`),
        fetch(`/api/settings?userId=${currentUser.ID_User}`)
      ]);
      const txData = await txDetailsRes.json();
      const settings = await settingsRes.json();
      
      const tx = txData.transactions.find((t: any) => t.ID_Transaksi === printTxId);
      const details = txData.details.filter((d: any) => d.ID_Transaksi === printTxId);
      
      if (!tx) {
        alert('Transaksi tidak ditemukan.');
        return;
      }
      
      const result = await printBluetoothReceipt(tx, details, settings, paperSize);
      if (result.success) {
        alert('Struk berhasil dikirim ke printer!');
        setIsPrintOptionOpen(false);
        setPrintTxId('');
      } else {
        alert(result.error || 'Gagal memprint.');
      }
    } catch (err: any) {
      alert('Kesalahan saat mencetak: ' + err.message);
    }
  };

  const handleConnectUsb = async () => {
    setUsbLoading(true);
    try {
      const status = await connectUsbPrinter();
      setUsbStatus(status);
      if (status.connected) {
        alert(`Berhasil terhubung ke printer USB: ${status.deviceName}`);
      } else if (status.error) {
        alert(status.error);
      }
    } catch (err: any) {
      alert('Gagal menyambung ke USB: ' + err.message);
    } finally {
      setUsbLoading(false);
    }
  };

  const handleDisconnectUsb = async () => {
    await disconnectUsbPrinter();
    setUsbStatus({ connected: false });
  };

  const handlePrintUsb = async (paperSize: '58' | '80') => {
    try {
      const [txDetailsRes, settingsRes] = await Promise.all([
        fetch(`/api/transactions?userId=${currentUser?.ID_User || ''}`),
        fetch(`/api/settings?userId=${currentUser.ID_User}`)
      ]);
      const txData = await txDetailsRes.json();
      const settings = await settingsRes.json();
      
      const tx = txData.transactions.find((t: any) => t.ID_Transaksi === printTxId);
      const details = txData.details.filter((d: any) => d.ID_Transaksi === printTxId);
      
      if (!tx) {
        alert('Transaksi tidak ditemukan.');
        return;
      }
      
      const result = await printUsbReceipt(tx, details, settings, paperSize);
      if (result.success) {
        alert('Struk berhasil dikirim ke printer USB!');
        setIsPrintOptionOpen(false);
        setPrintTxId('');
      } else {
        alert(result.error || 'Gagal memprint.');
      }
    } catch (err: any) {
      alert('Kesalahan saat mencetak USB: ' + err.message);
    }
  };

  const fetchPOSSettings = async () => {
    try {
      const res = await fetch(`/api/settings?userId=${currentUser?.ID_User || ''}`);
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings for POS:', err);
    }
  };

  // Load Menus
  const fetchMenus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/menus?userId=${currentUser?.ID_User || ''}`);
      const data = await res.json();
      setMenus(data.filter((m: Menu) => m.Status === 'Tersedia'));
    } catch (err) {
      console.error('Error fetching menus for POS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchPOSSettings();

    const handleUpdate = () => {
      fetchMenus();
      fetchPOSSettings();
    };
    window.addEventListener('ws_db_update', handleUpdate);
    return () => {
      window.removeEventListener('ws_db_update', handleUpdate);
    };
  }, []);

  const addToCart = (item: Menu) => {
    setCart((prevCart) => {
      const existing = prevCart.find((c) => c.ID_Menu === item.ID_Menu);
      if (existing) {
        return prevCart.map((c) =>
          c.ID_Menu === item.ID_Menu ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prevCart, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((c) => {
          if (c.ID_Menu === id) {
            const newQty = c.qty + delta;
            return { ...c, qty: newQty };
          }
          return c;
        })
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((c) => c.ID_Menu !== id));
  };

  const clearCart = () => {
    setCart([]);
    setNamaPelanggan('');
  };

  const totalHarga = cart.reduce((acc, cur) => acc + cur.Harga * cur.qty, 0);
  const totalItem = cart.reduce((acc, cur) => acc + cur.qty, 0);

  // Normalization helper for legacy categories
  const getNormalizedCategory = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower === 'coffee' || lower === 'non-coffee' || lower === 'minuman') return 'Minuman';
    if (lower === 'snacks' || lower === 'desserts' || lower === 'makanan') return 'Makanan';
    return cat || '';
  };

  // Filters
  const categories = ['Semua', 'Makanan', 'Minuman'];
  
  const filteredMenus = (menus || []).filter((menu) => {
    if (!menu) return false;
    const matchesSearch = (menu.Nama_Menu || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const normalizedMenuCat = getNormalizedCategory(menu.Kategori || '');
    const matchesCategory = activeCategory === 'Semua' || normalizedMenuCat === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle Checkout Submit
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    if (!namaPelanggan.trim()) {
      setErrorCheckout('Nama pelanggan wajib diisi!');
      alert('Silakan masukkan Nama Pelanggan sebelum melanjutkan pembayaran.');
      return;
    }
    setErrorCheckout('');
    setMetodeBayar('TUNAI');
    setUangBayar(totalHarga); // Preset exact amount
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSubmit = async () => {
    const finalUangBayar = metodeBayar === 'QRIS' ? totalHarga : Number(uangBayar);
    if (finalUangBayar === '' || finalUangBayar < totalHarga) {
      setErrorCheckout(`Pembayaran kurang! Minimal Rp ${(totalHarga || 0).toLocaleString('id-ID')}`);
      return;
    }

    const kembali = finalUangBayar - totalHarga;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaPelanggan,
          items: cart,
          bayar: finalUangBayar,
          kembali,
          cashierName: currentUser.Nama,
          actorId: currentUser.ID_User,
          metodeBayar,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setLatestTx(result.transaction);
        setIsCheckoutOpen(false);
        setIsSuccessOpen(true);
        clearCart();
      } else {
        setErrorCheckout(result.message || 'Gagal menyimpan transaksi.');
      }
    } catch (err: any) {
      console.error('Error during checkout API post:', err);
      setErrorCheckout(`Kesalahan koneksi ke server: ${err.message || err}`);
    }
  };

  // Quick cash keys shortcuts
  const addCashAmount = (amt: number) => {
    setUangBayar((prev) => (prev === '' ? amt : Number(prev) + amt));
  };

  const openPrintWindow = (txId: string, paperSize: string = '80') => {
    const url = getReceiptUrl(txId, paperSize);
    const win = window.open(url, '_blank', 'width=400,height=600');
    if (win) {
      win.focus();
    } else {
      alert('Popup diblokir! Harap izinkan popup untuk mencetak struk belanja.');
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Mobile Tab Selector */}
      <div className="lg:hidden flex bg-white dark:bg-[#1a1613] p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full shrink-0">
        <button
          onClick={() => setActiveMobileTab('catalog')}
          className={`flex-1 py-2 px-3 text-center rounded-lg text-xs font-bold transition duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeMobileTab === 'catalog'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          <span>Katalog Menu</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('cart')}
          className={`flex-1 py-2 px-3 text-center rounded-lg text-xs font-bold transition duration-200 flex items-center justify-center gap-2 cursor-pointer relative ${
            activeMobileTab === 'cart'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          <span>Keranjang Belanja</span>
          {totalItem > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full min-w-4 text-center">
              {totalItem}
            </span>
          )}
        </button>
      </div>

      <div id="pos-layout" className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 h-full items-start">
        {/* Left Panel: Catalog Grid (8 Cols) */}
        <div id="pos-catalog-panel" className={`lg:col-span-7 xl:col-span-8 space-y-6 ${activeMobileTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
        
        {/* Search and Filters */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <input
              id="pos-search-input"
              type="text"
              placeholder="Cari menu kopi atau makanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500 font-semibold text-sm transition"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                id={`cat-tab-${cat.toLowerCase()}`}
                onClick={() => setActiveCategory(cat)}
                className={`py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition
                  ${activeCategory === cat 
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10' 
                    : 'bg-zinc-50 dark:bg-[#25201c] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#342d27]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div id="pos-catalog-loading" className="text-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
            <p className="text-zinc-400 text-xs mt-3">Mengambil katalog menu...</p>
          </div>
        ) : filteredMenus.length === 0 ? (
          <div id="pos-catalog-empty" className="text-center py-24 bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-100 dark:border-zinc-800 p-8">
            <p className="text-zinc-500 text-sm font-semibold">Tidak ada menu yang cocok atau tersedia.</p>
            <p className="text-zinc-400 text-xs mt-1">Harap sesuaikan pencarian atau tambahkan menu baru di master data.</p>
          </div>
        ) : (
          <div id="pos-item-grid" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {filteredMenus.map((menu) => (
              <div
                key={menu.ID_Menu}
                id={`pos-item-${menu.ID_Menu}`}
                onClick={() => addToCart(menu)}
                className="group p-3 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200/80 dark:border-zinc-800/80 cursor-pointer flex flex-col justify-between card-interactive"
              >
                <div>
                  {/* Photo with category badge */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <img
                      src={menu.Foto_URL}
                      alt={menu.Nama_Menu}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Fallback image
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200';
                      }}
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-black/60 text-amber-400 uppercase tracking-wide backdrop-blur-sm">
                      {getNormalizedCategory(menu.Kategori)}
                    </span>
                  </div>

                  {/* Details */}
                  <h4 className="mt-3 font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2" title={menu.Nama_Menu}>
                    {menu.Nama_Menu}
                  </h4>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                  <span className="font-extrabold text-sm text-amber-600 dark:text-amber-500">
                    Rp {(menu?.Harga || 0).toLocaleString('id-ID')}
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition duration-300">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Right Panel: Shopping Cart Drawer (4 Cols) */}
        <div id="pos-cart-panel" className={`lg:col-span-5 xl:col-span-4 p-5 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-5 ${activeMobileTab === 'cart' ? 'block' : 'hidden lg:block'}`}>
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-500" />
              Keranjang Pesanan
            </h3>
            {cart.length > 0 && (
              <button
                id="clear-cart-btn"
                onClick={clearCart}
                className="text-zinc-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer"
                title="Kosongkan Keranjang"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            )}
          </div>

          {/* Form input: Nama Pelanggan */}
          <div className="mt-4 space-y-1.5">
            <label htmlFor="customer-name-input" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              Nama Pelanggan <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              id="customer-name-input"
              type="text"
              placeholder="Masukkan nama pemesan..."
              value={namaPelanggan}
              onChange={(e) => setNamaPelanggan(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 font-bold text-sm focus:outline-none focus:border-amber-500 transition"
              required
            />
          </div>

          {/* Cart list */}
          <div id="cart-items-container" className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-zinc-300 dark:text-zinc-700 stroke-[1.5]" />
                <p className="text-xs font-semibold">Keranjang masih kosong.</p>
                <p className="text-[10px] text-zinc-400 mt-1">Pilih menu di samping kiri untuk memesan.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.ID_Menu}
                  id={`cart-item-${item.ID_Menu}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-[#25201c] border border-zinc-100 dark:border-zinc-800/40"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                      {item.Nama_Menu}
                    </h5>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Rp {(item?.Harga || 0).toLocaleString('id-ID')} / pcs
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`dec-qty-${item.ID_Menu}`}
                      onClick={() => updateQty(item.ID_Menu, -1)}
                      className="h-6 w-6 rounded-md bg-white dark:bg-[#1a1613] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 cursor-pointer text-xs"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100 w-5 text-center font-mono">
                      {item.qty}
                    </span>
                    <button
                      id={`inc-qty-${item.ID_Menu}`}
                      onClick={() => updateQty(item.ID_Menu, 1)}
                      className="h-6 w-6 rounded-md bg-white dark:bg-[#1a1613] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 cursor-pointer text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      id={`rem-item-${item.ID_Menu}`}
                      onClick={() => removeFromCart(item.ID_Menu)}
                      className="p-1 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/25 ml-1 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pricing Summary Footer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="space-y-1.5 text-xs font-semibold">
            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
              <span>Total Item:</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">{totalItem} pcs</span>
            </div>
            <div className="flex justify-between text-zinc-950 dark:text-zinc-50 text-base pt-1.5 border-t border-dashed border-zinc-100 dark:border-zinc-800">
              <span className="font-bold">Grand Total:</span>
              <span className="font-extrabold text-amber-600 dark:text-amber-500 font-mono">
                Rp {(totalHarga || 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <button
            id="checkout-trigger-btn"
            onClick={handleOpenCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-300
              ${cart.length > 0 
                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-600/10 active:scale-98' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'}`}
          >
            <CreditCard className="h-4.5 w-4.5" />
            Pilih Pembayaran
          </button>
        </div>
      </div>

      {/* Mobile Floating Sticky Bottom Summary Bar */}
      {totalItem > 0 && activeMobileTab === 'catalog' && (
        <div className="lg:hidden fixed bottom-6 left-6 right-6 z-40 bg-white/95 dark:bg-[#110e0c]/95 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-4 rounded-2xl flex items-center justify-between backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Pesanan</span>
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-500 font-mono">
              Rp {(totalHarga || 0).toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-zinc-500 font-semibold">{totalItem} pcs item</span>
          </div>
          <button
            onClick={() => setActiveMobileTab('cart')}
            className="py-2.5 px-4 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-600/15"
          >
            <span>Lihat Keranjang</span>
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>

  {/* --- CHECKOUT PAYMENTS MODAL --- */}
      {isCheckoutOpen && (
        <div id="checkout-modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden">
            <button
              id="close-checkout-modal"
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 pb-2">
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-lg flex items-center gap-2">
                <CreditCard className="h-5.5 w-5.5 text-amber-500" />
                Proses Pembayaran Kasir
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Penerimaan pembayaran dari Pelanggan: <strong className="text-zinc-800 dark:text-zinc-200">{namaPelanggan}</strong>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
              {/* Grand Total Show */}
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Harus Dibayar</span>
                <h4 className="text-2xl font-extrabold text-amber-600 dark:text-amber-500 font-mono mt-0.5">
                  Rp {(totalHarga || 0).toLocaleString('id-ID')}
                </h4>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block">Metode Pembayaran</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMetodeBayar('TUNAI');
                      setUangBayar(totalHarga);
                    }}
                    className={`py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition
                      ${metodeBayar === 'TUNAI'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/15'
                        : 'bg-zinc-50 dark:bg-[#25201c] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-[#342d27]'}`}
                  >
                    <Banknote className="h-4.5 w-4.5" />
                    TUNAI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMetodeBayar('QRIS');
                      setUangBayar(totalHarga);
                    }}
                    className={`py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition
                      ${metodeBayar === 'QRIS'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/15'
                        : 'bg-zinc-50 dark:bg-[#25201c] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-[#342d27]'}`}
                  >
                    <QrCode className="h-4.5 w-4.5" />
                    QRIS
                  </button>
                </div>
              </div>

              {/* Conditional Panels based on Payment Method */}
              {metodeBayar === 'TUNAI' ? (
                <>
                  {/* Cash Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="uang-bayar-input" className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      Uang Tunai Diterima (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3.5 text-zinc-400 dark:text-zinc-500 font-bold text-sm">Rp</span>
                      <input
                        id="uang-bayar-input"
                        type="number"
                        placeholder="Masukkan jumlah bayar..."
                        value={uangBayar}
                        onChange={(e) => setUangBayar(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 font-extrabold text-base focus:outline-none focus:border-amber-500 transition font-mono"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Cash shortcut buttons */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Uang Pas & Shortcut</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        id="shortcut-pas-btn"
                        onClick={() => setUangBayar(totalHarga)}
                        className="py-2 rounded-xl bg-zinc-50 dark:bg-[#25201c] text-xs font-extrabold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition font-mono"
                      >
                        Uang Pas
                      </button>
                      <button
                        id="shortcut-20k-btn"
                        onClick={() => addCashAmount(20000)}
                        className="py-2 rounded-xl bg-zinc-50 dark:bg-[#25201c] text-xs font-extrabold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition font-mono"
                      >
                        +20.000
                      </button>
                      <button
                        id="shortcut-50k-btn"
                        onClick={() => addCashAmount(50000)}
                        className="py-2 rounded-xl bg-zinc-50 dark:bg-[#25201c] text-xs font-extrabold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition font-mono"
                      >
                        +50.000
                      </button>
                      <button
                        id="shortcut-100k-btn"
                        onClick={() => addCashAmount(100000)}
                        className="py-2 rounded-xl bg-zinc-50 dark:bg-[#25201c] text-xs font-extrabold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition font-mono"
                      >
                        +100.000
                      </button>
                      <button
                        id="shortcut-clear-btn"
                        onClick={() => setUangBayar('')}
                        className="py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 cursor-pointer transition col-span-2"
                      >
                        Reset Nominal
                      </button>
                    </div>
                  </div>

                  {/* Change Calculation */}
                  {uangBayar !== '' && Number(uangBayar) >= totalHarga && (
                    <div id="checkout-change-panel" className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Kembalian:</span>
                      <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-500 font-mono">
                        Rp {Math.max(0, Number(uangBayar || 0) - (totalHarga || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div id="qris-payment-panel" className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#25201c] border border-zinc-200 dark:border-zinc-800/60 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
                      QRIS DYNAMIC (DEMO)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-rose-500 text-white leading-none uppercase">GPN</span>
                  </div>
                  
                  {/* Stylized QRIS QR code container */}
                  <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center justify-center">
                    <div className="relative h-40 w-40 bg-zinc-50 rounded-lg flex items-center justify-center border border-zinc-100 overflow-hidden">
                      <QrCode className="h-28 w-28 text-zinc-900 animate-pulse" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-md bg-white border border-zinc-200 shadow-sm flex items-center justify-center">
                          <span className="text-[9px] font-black text-rose-600">QRIS</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-2 font-mono">
                      NMID: ID1029384756
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                    Tunjukkan kode QRIS ini kepada pelanggan.<br />Setelah pembayaran <strong className="text-emerald-600 dark:text-emerald-500 font-mono">Rp {(totalHarga || 0).toLocaleString('id-ID')}</strong> berhasil diverifikasi, klik konfirmasi di bawah.
                  </p>
                </div>
              )}

              {/* Validation errors */}
              {errorCheckout && (
                <p id="checkout-error" className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                  {errorCheckout}
                </p>
              )}
            </div>

            {/* Submit Pay Footer */}
            <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#201c18]/50 flex justify-end rounded-b-2xl">
              <button
                id="submit-payment-btn"
                onClick={handleCheckoutSubmit}
                disabled={metodeBayar === 'TUNAI' && (uangBayar === '' || Number(uangBayar) < totalHarga)}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-300
                  ${metodeBayar === 'QRIS' || (uangBayar !== '' && Number(uangBayar) >= totalHarga)
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/10 active:scale-98'
                    : 'bg-zinc-100 dark:bg-zinc-850 text-zinc-400 dark:text-zinc-650 cursor-not-allowed'}`}
              >
                {metodeBayar === 'QRIS' ? 'Konfirmasi Pembayaran QRIS' : 'Selesaikan Transaksi (Cetak Struk)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS RECEIPT PRINT POPUP MODAL --- */}
      {isSuccessOpen && latestTx && (
        <div id="success-tx-modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden">
            <div className="p-6 pb-2 shrink-0">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h3 className="font-extrabold text-zinc-950 dark:text-zinc-50 text-xl mt-3">Transaksi Sukses!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  ID Transaksi: <strong className="font-mono text-amber-600">{latestTx.ID_Transaksi}</strong> | Pelanggan: <strong>{latestTx.Nama_Pelanggan}</strong>
                </p>
              </div>
            </div>

            {/* Quick print receipt options */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {/* Receipt print iframe emulation for instant preview inside POS layout */}
              <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#25201c]/40">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-2">Pratinjau Struk Belanja</span>
                <div className="h-44 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white shadow-sm">
                  <iframe
                    src={getReceiptUrl(latestTx.ID_Transaksi)}
                    title="Receipt Preview"
                    className="w-full h-full border-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  id="print-thermal-btn"
                  onClick={() => {
                    setPrintTxId(latestTx.ID_Transaksi);
                    setIsPrintOptionOpen(true);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/10"
                >
                  <Printer className="h-4.5 w-4.5" />
                  Cetak Struk Belanja
                </button>
                <button
                  id="finish-pos-session-btn"
                  onClick={() => {
                    setIsSuccessOpen(false);
                    setLatestTx(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 dark:bg-[#25201c] text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-200 dark:hover:bg-[#342d27] border border-zinc-200 dark:border-zinc-800 cursor-pointer transition text-center"
                >
                  Transaksi Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PRINT METHOD CHOOSE DIALOG --- */}
      {isPrintOptionOpen && printTxId && (
        <div id="print-option-modal" className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              id="close-print-option-modal"
              onClick={() => {
                setIsPrintOptionOpen(false);
                setPrintTxId('');
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base flex items-center gap-2">
              <Printer className="h-5 w-5 text-amber-500" />
              Pilih Metode Cetak Struk
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Pilih format dan ukuran cetak yang sesuai
            </p>

            {/* --- BLUETOOTH PRINTER INTEGRATION SECTION --- */}
            <div className="mt-4 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-amber-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-1">
                  <Bluetooth className="h-3.5 w-3.5" /> Koneksi Printer Bluetooth
                </span>
                {btStatus.connected ? (
                  <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-500 px-2 py-0.5 rounded-full font-bold">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-bold">
                    Offline
                  </span>
                )}
              </div>

              {!isBluetoothSupported() ? (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                  Bluetooth API tidak didukung browser ini. Gunakan Chrome/Edge dan pastikan koneksi HTTPS. Jika di dalam frame pratinjau, silakan buka aplikasi di tab baru.
                </p>
              ) : (
                <div className="space-y-2">
                  {btStatus.connected ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between bg-white dark:bg-[#15110e] border border-zinc-100 dark:border-zinc-850 p-2 rounded-lg text-xs">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                          {btStatus.deviceName}
                        </span>
                        <button
                          type="button"
                          onClick={handleDisconnectBluetooth}
                          className="text-[10px] font-bold text-rose-600 dark:text-rose-500 hover:underline cursor-pointer"
                        >
                          Putuskan
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handlePrintBluetooth('58')}
                          className="py-2 px-3 rounded-xl bg-amber-600 text-white font-bold text-[11px] hover:bg-amber-700 transition cursor-pointer text-center"
                        >
                          Cetak BT 58mm
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintBluetooth('80')}
                          className="py-2 px-3 rounded-xl bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition cursor-pointer text-center"
                        >
                          Cetak BT 80mm
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={btLoading}
                      onClick={handleConnectBluetooth}
                      className="w-full py-2 px-3.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Bluetooth className="h-4 w-4" />
                      {btLoading ? 'Menyambungkan...' : 'Sambungkan Printer Bluetooth'}
                    </button>
                  )}
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-tight">
                    *Akses Bluetooth mungkin diblokir di dalam iframe pratinjau. Jika tombol tidak merespons, buka aplikasi di Tab Baru.
                  </p>

                  {/* Bluetooth Printer Troubleshooting Guide */}
                  <div className="mt-2.5 pt-2 border-t border-amber-500/10 text-[10px] text-zinc-500 dark:text-zinc-400 space-y-1.5 leading-normal">
                    <span className="font-bold text-amber-700 dark:text-amber-400 block">💡 Panduan Sinkronisasi Printer di HP/Tablet:</span>
                    <ul className="list-disc pl-3.5 space-y-1">
                      <li><strong>Koneksi HTTPS:</strong> Pastikan Anda membuka aplikasi ini menggunakan protokol aman <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-0.5 rounded text-[9px]">https://</code>. Google Chrome memblokir Web Bluetooth pada <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-0.5 rounded text-[9px]">http://</code> biasa.</li>
                      <li><strong>Izin Lokasi & GPS (Android):</strong> Chrome membutuhkan <strong>GPS aktif</strong> & izin <strong>Lokasi</strong> untuk mendeteksi perangkat Bluetooth Low Energy (BLE). Aktifkan GPS HP Anda.</li>
                      <li><strong>Tipe Bluetooth BLE:</strong> Browser hanya mendukung Bluetooth Low Energy (BLE). Jika printer Anda bertipe Bluetooth Classic (SPP), gunakan tombol <strong>"Cetak lewat Sistem (PDF)"</strong> di bawah untuk mencetak via aplikasi perantara gratis seperti <strong>RawBT</strong> atau <strong>ESCPOS Print App</strong> di HP.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* --- USB PRINTER INTEGRATION SECTION --- */}
            <div className="mt-4 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-emerald-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                  <Usb className="h-3.5 w-3.5" /> Koneksi Printer USB
                </span>
                {usbStatus.connected ? (
                  <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-500 px-2 py-0.5 rounded-full font-bold">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-bold">
                    Offline
                  </span>
                )}
              </div>

              {!isUsbSupported() ? (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                  Web USB tidak didukung browser ini. Gunakan Google Chrome atau Edge versi terbaru.
                </p>
              ) : (
                <div className="space-y-2">
                  {usbStatus.connected ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between bg-white dark:bg-[#15110e] border border-zinc-100 dark:border-zinc-850 p-2 rounded-lg text-xs">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                          {usbStatus.name || 'Printer USB'}
                        </span>
                        <button
                          type="button"
                          onClick={handleDisconnectUsb}
                          className="text-[10px] font-bold text-rose-600 dark:text-rose-500 hover:underline cursor-pointer"
                        >
                          Putuskan
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handlePrintUsb('58')}
                          className="py-2 px-3 rounded-xl bg-amber-600 text-white font-bold text-[11px] hover:bg-amber-700 transition cursor-pointer text-center"
                        >
                          Cetak USB 58mm
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintUsb('80')}
                          className="py-2 px-3 rounded-xl bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition cursor-pointer text-center"
                        >
                          Cetak USB 80mm
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={usbLoading}
                      onClick={handleConnectUsb}
                      className="w-full py-2 px-3.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Usb className="h-4 w-4" />
                      {usbLoading ? 'Menyambungkan...' : 'Sambungkan Printer USB'}
                    </button>
                  )}
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-tight font-semibold">
                    *Akses USB langsung dari browser Chrome/Edge tanpa driver tambahan, sehingga proses cetak instan.
                  </p>
                </div>
              )}
            </div>

            {/* --- STANDARD BROWSER PRINT SECTION --- */}
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                Atau Cetak lewat Sistem (PDF)
              </span>

              <button
                id="print-size-58-btn"
                onClick={() => {
                  openPrintWindow(printTxId, '58');
                  setIsPrintOptionOpen(false);
                  setPrintTxId('');
                }}
                className="w-full p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] hover:border-amber-500/50 hover:bg-amber-500/5 flex items-center gap-3 transition text-left cursor-pointer"
              >
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-lg">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100">Kertas Thermal 58mm</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Cocok untuk printer mini bluetooth</p>
                </div>
              </button>

              <button
                id="print-size-80-btn"
                onClick={() => {
                  openPrintWindow(printTxId, '80');
                  setIsPrintOptionOpen(false);
                  setPrintTxId('');
                }}
                className="w-full p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] hover:border-amber-500/50 hover:bg-amber-500/5 flex items-center gap-3 transition text-left cursor-pointer"
              >
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-lg">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100">Kertas Thermal 80mm</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Standar printer laci kasir desktop</p>
                </div>
              </button>

              <button
                id="print-size-a4-btn"
                onClick={() => {
                  openPrintWindow(printTxId, 'A4');
                  setIsPrintOptionOpen(false);
                  setPrintTxId('');
                }}
                className="w-full p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] hover:border-amber-500/50 hover:bg-amber-500/5 flex items-center gap-3 transition text-left cursor-pointer"
              >
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100">Invoice PDF HVS A4</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Format digital / cetak printer besar</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
