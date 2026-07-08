/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Calendar, FileText, Download, Printer, Filter, ChevronLeft, ChevronRight, X, Bluetooth } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction, TransactionDetail, Menu } from '../types.js';
import { getReceiptUrl } from '../utils/firebaseClient.js';
import { connectPrinter, 
  disconnectPrinter, 
  getConnectedPrinter, 
  isBluetoothSupported, 
  printBluetoothReceipt 
} from '../utils/bluetoothPrinter.js';

interface ReportViewProps {
  currentUser: any;
}

export default function ReportView({ currentUser }: ReportViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [details, setDetails] = useState<TransactionDetail[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPreset, setFilterPreset] = useState<'all' | 'today' | 'last7' | 'month'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Print format dialog state
  const [isPrintOptionOpen, setIsPrintOptionOpen] = useState(false);
  const [printTxId, setPrintTxId] = useState('');

  // Bluetooth Printer states
  const [btStatus, setBtStatus] = useState<{ connected: boolean; name?: string }>({ connected: false });
  const [btLoading, setBtLoading] = useState(false);

  useEffect(() => {
    setBtStatus(getConnectedPrinter());
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
      const settingsRes = await fetch(`/api/settings?userId=${currentUser?.ID_User || ''}`);
      const settings = await settingsRes.json();
      
      const tx = transactions.find((t: any) => t.ID_Transaksi === printTxId);
      const txDetails = details.filter((d: any) => d.ID_Transaksi === printTxId);
      
      if (!tx) {
        alert('Transaksi tidak ditemukan.');
        return;
      }
      
      const result = await printBluetoothReceipt(tx, txDetails, settings, paperSize);
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

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTransactionItemCounts = (txId: string) => {
    const txDetails = (details || []).filter((d) => d && d.ID_Transaksi === txId);
    let makanan = 0;
    let minuman = 0;
    
    txDetails.forEach((d) => {
      if (!d) return;
      const menu = (menus || []).find((m) => m && m.ID_Menu === d.ID_Menu);
      if (menu) {
        const lowerCat = (menu.Kategori || '').toLowerCase();
        if (lowerCat === 'makanan' || lowerCat === 'snacks' || lowerCat === 'desserts') {
          makanan += d.Qty || 0;
        } else {
          minuman += d.Qty || 0;
        }
      } else {
        const nameLower = (d.Nama_Menu || '').toLowerCase();
        if (
          nameLower.includes('croissant') || 
          nameLower.includes('fries') || 
          nameLower.includes('cake') || 
          nameLower.includes('roti') || 
          nameLower.includes('nasi') || 
          nameLower.includes('mie') ||
          nameLower.includes('burger')
        ) {
          makanan += d.Qty || 0;
        } else {
          minuman += d.Qty || 0;
        }
      }
    });
    
    return {
      makanan,
      minuman,
      total: makanan + minuman,
    };
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const [transRes, menusRes] = await Promise.all([
        fetch(`/api/transactions?userId=${currentUser?.ID_User || ''}`),
        fetch('/api/menus')
      ]);
      const transData = await transRes.json();
      const menusData = await menusRes.json();
      
      setTransactions(Array.isArray(transData?.transactions) ? transData.transactions : []);
      setDetails(Array.isArray(transData?.details) ? transData.details : []);
      setMenus(Array.isArray(menusData) ? menusData : []);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setTransactions([]);
      setDetails([]);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    const handleUpdate = () => {
      fetchTransactions();
    };
    window.addEventListener('ws_db_update', handleUpdate);
    return () => {
      window.removeEventListener('ws_db_update', handleUpdate);
    };
  }, []);

  const openPrintWindow = (txId: string, paperSize: string = '80') => {
    const url = getReceiptUrl(txId, paperSize);
    const win = window.open(url, '_blank', 'width=400,height=600');
    if (win) {
      win.focus();
    } else {
      alert('Popup diblokir! Izinkan popup untuk memprint struk.');
    }
  };

  // Filter Logic
  const filteredTransactions = (transactions || []).filter((tx) => {
    if (!tx) return false;

    // 1. Role-based filtration (Cashier only sees their own sales)
    if (currentUser?.Role === 'kasir' && tx.Kasir !== currentUser?.Nama) {
      return false;
    }

    // 2. Search query filtration
    const txIdStr = tx.ID_Transaksi || '';
    const custStr = tx.Nama_Pelanggan || '';
    const kasirStr = tx.Kasir || '';

    const matchesSearch = 
      txIdStr.toLowerCase().includes((searchQuery || '').toLowerCase()) || 
      custStr.toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      kasirStr.toLowerCase().includes((searchQuery || '').toLowerCase());
    
    if (!matchesSearch) return false;

    // 3. Date Presets & Range filter
    if (!tx.Tanggal) return false;
    const txDate = new Date(tx.Tanggal);
    if (isNaN(txDate.getTime())) return false;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (filterPreset === 'today') {
      if (txDate < startOfToday) return false;
    } else if (filterPreset === 'last7') {
      const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (txDate < sevenDaysAgo) return false;
    } else if (filterPreset === 'month') {
      const firstDayOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
      if (txDate < firstDayOfMonth) return false;
    }

    // Custom range
    if (startDate) {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      if (txDate < sDate) return false;
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      if (txDate > eDate) return false;
    }

    return true;
  });

  // Pagination Logic
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  // Totals calculations
  const totalOmzetFiltered = filteredTransactions.reduce((acc, cur) => acc + cur.Total_Harga, 0);

  const { totalMakananFiltered, totalMinumanFiltered, totalQtyFiltered } = filteredTransactions.reduce((acc, tx) => {
    const counts = getTransactionItemCounts(tx.ID_Transaksi);
    return {
      totalMakananFiltered: acc.totalMakananFiltered + counts.makanan,
      totalMinumanFiltered: acc.totalMinumanFiltered + counts.minuman,
      totalQtyFiltered: acc.totalQtyFiltered + counts.total,
    };
  }, { totalMakananFiltered: 0, totalMinumanFiltered: 0, totalQtyFiltered: 0 });

  // Reset pagination if filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterPreset, startDate, endDate]);

  // Export to Real Excel (.xlsx) file
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      alert('Tidak ada data transaksi untuk diekspor!');
      return;
    }

    // Format data into rows suitable for the sheet
    const dataRows = filteredTransactions.map((tx) => {
      const dateFormatted = tx.Tanggal ? new Date(tx.Tanggal).toLocaleString('id-ID') : '';
      const counts = getTransactionItemCounts(tx.ID_Transaksi);
      return {
        'ID Transaksi': tx.ID_Transaksi || '',
        'Tanggal': dateFormatted,
        'Nama Pelanggan': tx.Nama_Pelanggan || '',
        'Kasir': tx.Kasir || '',
        'Total Makanan/Minuman Terjual': counts.total,
        'Makanan Terjual': counts.makanan,
        'Minuman Terjual': counts.minuman,
        'Total Harga (IDR)': tx.Total_Harga || 0,
        'Metode Pembayaran': tx.Metode_Bayar || 'TUNAI',
        'Status': tx.Status || ''
      };
    });

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan');

    // Auto-fit column widths
    const colWidths = Object.keys(dataRows[0] || {}).map(key => {
      let maxLen = key.length;
      dataRows.forEach(row => {
        const val = String((row as any)[key] || '');
        if (val.length > maxLen) {
          maxLen = val.length;
        }
      });
      return { wch: maxLen + 4 };
    });
    worksheet['!cols'] = colWidths;

    // Save/write the workbook file as .xlsx
    XLSX.writeFile(workbook, `Laporan_Penjualan_Maissy_${Date.now()}.xlsx`);
  };

  return (
    <div id="reports-view-container" className="space-y-6">
      {/* Header and Download Excel CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="reporting-main-heading" className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Laporan Penjualan Kafe
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {currentUser?.Role === 'admin' 
              ? 'Laporan agregat rekapitulasi penjualan seluruh kasir untuk di-sinkronisasikan ke Google Spreadsheet.'
              : `Laporan rekap penjualan shift personal atas nama: ${currentUser?.Nama || '-'}`}
          </p>
        </div>

        <button
          id="export-excel-btn"
          onClick={handleExportExcel}
          disabled={filteredTransactions.length === 0}
          className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition
            ${filteredTransactions.length > 0 
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/10' 
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'}`}
        >
          <Download className="h-4 w-4" />
          File Excel
        </button>
      </div>

      {/* Summary Stats of Filtered Data */}
      <div id="filtered-stats" className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Omzet Hasil Filter</span>
          <h4 className="text-xl font-extrabold text-amber-600 dark:text-amber-500 mt-1">
            Rp {totalOmzetFiltered.toLocaleString('id-ID')}
          </h4>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Total Makanan/Minuman Terjual</span>
          <h4 className="text-xl font-extrabold text-teal-600 dark:text-teal-500 mt-1">
            {totalQtyFiltered} Porsi / Item
          </h4>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-semibold">
            Makanan: {totalMakananFiltered} pcs | Minuman: {totalMinumanFiltered} pcs
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Frekuensi Transaksi</span>
          <h4 className="text-xl font-extrabold text-indigo-600 dark:text-indigo-500 mt-1">
            {totalItems} Kali Transaksi
          </h4>
        </div>
      </div>

      {/* Filtering Panels */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-sm flex items-center gap-2">
          <Filter className="h-4.5 w-4.5 text-amber-500" />
          Penyaringan Parameter Laporan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Preset Buttons */}
          <div className="md:col-span-4 space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Pilihan Preset</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(['all', 'today', 'last7', 'month'] as const).map((preset) => {
                const labels = { all: 'Semua', today: 'Hari Ini', last7: '7 Hari', month: 'Bulan' };
                return (
                  <button
                    key={preset}
                    id={`filter-preset-${preset}`}
                    onClick={() => {
                      setFilterPreset(preset);
                      setStartDate('');
                      setEndDate('');
                    }}
                    className={`py-2 text-[10px] font-extrabold rounded-lg border cursor-pointer transition text-center
                      ${filterPreset === preset 
                        ? 'bg-amber-600 text-white border-amber-600' 
                        : 'bg-zinc-50 dark:bg-[#25201c] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'}`}
                  >
                    {labels[preset]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="start-date-picker" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Tanggal Mulai</label>
              <input
                id="start-date-picker"
                type="date"
                value={startDate}
                max={getTodayString()}
                onChange={(e) => {
                  const val = e.target.value;
                  const today = getTodayString();
                  if (val > today) {
                    alert('Tanggal mulai tidak boleh melebihi tanggal hari ini!');
                    setStartDate(today);
                  } else {
                    setStartDate(val);
                  }
                  setFilterPreset('all'); // Clear preset if manual date selected
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-900 dark:text-zinc-100 text-xs font-semibold focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="end-date-picker" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Tanggal Selesai</label>
              <input
                id="end-date-picker"
                type="date"
                value={endDate}
                max={getTodayString()}
                onChange={(e) => {
                  const val = e.target.value;
                  const today = getTodayString();
                  if (val > today) {
                    alert('Tanggal selesai tidak boleh melebihi tanggal hari ini!');
                    setEndDate(today);
                  } else {
                    setEndDate(val);
                  }
                  setFilterPreset('all');
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-900 dark:text-zinc-100 text-xs font-semibold focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Search keyword */}
          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="report-search-field" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Cari Kata Kunci</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                id="report-search-field"
                type="text"
                placeholder="No Transaksi / Cust / Kasir..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-900 dark:text-zinc-100 text-xs font-semibold focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reports Data Table */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-zinc-400 text-xs mt-2">Memuat rekaman log laporan...</p>
        </div>
      ) : paginatedTransactions.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
          <p className="text-zinc-500 text-sm font-semibold">Tidak ada transaksi terdaftar.</p>
          <p className="text-zinc-400 text-xs mt-1">Belum ada aktivitas penjualan pada rentang filter ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div id="reports-table-wrapper" className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left">
              <thead className="bg-zinc-50 dark:bg-[#1f1a16] text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">No Transaksi</th>
                  <th className="px-6 py-4">Waktu Pesan</th>
                  <th className="px-6 py-4">Nama Pelanggan</th>
                  <th className="px-6 py-4">Kasir Pelaksana</th>
                  <th className="px-6 py-4">Total Makanan/Minuman Terjual</th>
                  <th className="px-6 py-4">Makanan Terjual</th>
                  <th className="px-6 py-4">Minuman Terjual</th>
                  <th className="px-6 py-4">Total Bayar</th>
                  <th className="px-6 py-4">Metode Bayar</th>
                  <th className="px-6 py-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {paginatedTransactions.map((tx) => {
                  const counts = getTransactionItemCounts(tx.ID_Transaksi);
                  return (
                    <tr key={tx.ID_Transaksi} className="hover:bg-zinc-50/50 dark:hover:bg-[#25201c]/30 transition">
                      <td className="px-6 py-4 font-mono text-amber-600 dark:text-amber-500 font-bold">{tx.ID_Transaksi}</td>
                      <td className="px-6 py-4 font-mono text-zinc-400 dark:text-zinc-500">
                        {new Date(tx.Tanggal).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">{tx.Nama_Pelanggan}</td>
                      <td className="px-6 py-4">{tx.Kasir}</td>
                      <td className="px-6 py-4 font-mono text-amber-600 dark:text-amber-500 font-bold">{counts.total} pcs</td>
                      <td className="px-6 py-4 font-mono text-emerald-600 dark:text-emerald-500 font-bold">{counts.makanan} pcs</td>
                      <td className="px-6 py-4 font-mono text-sky-600 dark:text-sky-500 font-bold">{counts.minuman} pcs</td>
                      <td className="px-6 py-4 font-mono text-zinc-950 dark:text-zinc-50 font-bold">
                        Rp {tx.Total_Harga.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                          tx.Metode_Bayar === 'QRIS' 
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {tx.Metode_Bayar || 'TUNAI'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          id={`reprint-receipt-${tx.ID_Transaksi}`}
                          onClick={() => {
                            setPrintTxId(tx.ID_Transaksi);
                            setIsPrintOptionOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1a1613] hover:bg-zinc-50 dark:hover:bg-[#25201c] text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-500 cursor-pointer transition inline-flex items-center gap-1 font-bold text-[10px]"
                          title="Cetak Ulang Struk"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Re-print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div id="pagination-controls" className="flex items-center justify-between pt-4">
              <span className="text-xs text-zinc-500">
                Menampilkan <strong className="text-zinc-800 dark:text-zinc-200">{startIndex + 1}</strong> hingga <strong className="text-zinc-800 dark:text-zinc-200">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> dari <strong className="text-zinc-800 dark:text-zinc-200">{totalItems}</strong> transaksi
              </span>

              <div className="flex gap-2">
                <button
                  id="page-prev-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border cursor-pointer border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] text-zinc-500 hover:bg-zinc-50 transition ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 self-center">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  id="page-next-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border cursor-pointer border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] text-zinc-500 hover:bg-zinc-50 transition ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
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
