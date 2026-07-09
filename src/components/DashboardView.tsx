/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, Award, TrendingUp, RefreshCw, Layers, Sparkles, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardViewProps {
  currentUser: any;
  onNavigate: (page: string) => void;
}

export default function DashboardView({ currentUser, onNavigate }: DashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cafeName, setCafeName] = useState('Maissy Coffee');

  useEffect(() => {
    const fetchCafeName = async () => {
      try {
        if (!currentUser?.ID_User) return;
        const res = await fetch(`/api/settings?userId=${currentUser.ID_User}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.namaToko) {
            setCafeName(data.namaToko);
          }
        }
      } catch (err) {
        console.error('Error fetching cafe name:', err);
      }
    };
    fetchCafeName();
  }, [currentUser]);

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/reports/analytics?userId=${currentUser?.ID_User || ''}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    const handleUpdate = () => {
      fetchAnalytics();
    };
    window.addEventListener('ws_db_update', handleUpdate);
    return () => {
      window.removeEventListener('ws_db_update', handleUpdate);
    };
  }, []);

  if (loading) {
    return (
      <div id="dashboard-loading" className="flex flex-col items-center justify-center h-96 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat dasbor analitik {cafeName}...</p>
      </div>
    );
  }

  const summary = data?.summary || { todaySales: 0, todayOrdersCount: 0, totalSalesEver: 0, salesGrowthPct: 0, todayBestItem: '-' };
  const salesLast7Days = data?.salesLast7Days || [];
  const categoryDistribution = data?.categoryDistribution || [];
  const topSellingItems = data?.topSellingItems || [];

  // Find max value in last 7 days to scale our custom SVG chart
  const maxSalesVal = Math.max(...(salesLast7Days || []).map((d: any) => d?.amount || 0), 50000);

  // Colors for categories
  const categoryColors: { [key: string]: string } = {
    'Minuman': '#d97706', // amber-600
    'Makanan': '#4f46e5', // indigo-600
    'Coffee': '#d97706', // amber-600
    'Non-Coffee': '#0d9488', // teal-600
    'Snacks': '#4f46e5', // indigo-600
    'Desserts': '#db2777', // pink-600
    'Lainnya': '#71717a', // zinc-500
  };

  return (
    <div id="dashboard-container" className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="dashboard-welcome-heading" className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            Selamat Datang, {currentUser?.Nama || 'Kasir'} <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {currentUser?.Role === 'admin' 
              ? `Berikut ringkasan performa dan metrik operasional ${cafeName} saat ini.`
              : 'Siap melayani pelanggan hari ini? Gunakan panel POS untuk mencatat pesanan.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="refresh-analytics-btn"
            onClick={fetchAnalytics}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#25201c] flex items-center gap-2 cursor-pointer transition"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-xs font-semibold">Segarkan Data</span>
          </button>

          {currentUser?.Role === 'kasir' && (
            <button
              id="navigate-pos-btn"
              onClick={() => onNavigate('pos')}
              className="py-2.5 px-5 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition cursor-pointer shadow-lg shadow-amber-600/10"
            >
              Mulai Transaksi (POS)
            </button>
          )}
        </div>
      </div>

      {/* Overview stats grid */}
      <div id="stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1: Pendapatan Hari Ini */}
        <motion.div
          id="stat-revenue"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#1a1613] relative overflow-hidden shadow-sm card-interactive"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">Pendapatan Hari Ini</span>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-500">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
              Rp {(summary?.todaySales || 0).toLocaleString('id-ID')}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">
                {summary.salesGrowthPct >= 0 ? '+' : ''}{summary.salesGrowthPct.toFixed(1)}%
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">dari kemarin</span>
            </div>
          </div>
        </motion.div>

        {/* Stat 2: Pesanan Hari Ini */}
        <motion.div
          id="stat-orders"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#1a1613] relative overflow-hidden shadow-sm card-interactive"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">Pesanan Hari Ini</span>
            <div className="p-3 bg-teal-500/10 rounded-xl text-teal-600 dark:text-teal-500">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
              {summary.todayOrdersCount} Transaksi
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              Status aktif di kasir sekarang
            </p>
          </div>
        </motion.div>

        {/* Stat 3: Item Terlaris */}
        <motion.div
          id="stat-bestseller"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#1a1613] relative overflow-hidden shadow-sm card-interactive"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">Terlaris Hari Ini</span>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-500">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 truncate" title={summary.todayBestItem}>
              {summary.todayBestItem}
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              Produk favorit pelanggan saat ini
            </p>
          </div>
        </motion.div>

        {/* Stat 4: Total Keseluruhan (Admin) atau Shift Personal (Kasir) */}
        <motion.div
          id="stat-cumulative"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#1a1613] relative overflow-hidden shadow-sm card-interactive"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              {currentUser?.Role === 'admin' ? 'Total Penjualan' : 'Profil Kasir Aktif'}
            </span>
            <div className="p-3 bg-pink-500/10 rounded-xl text-pink-600 dark:text-pink-500">
              {currentUser?.Role === 'admin' ? <Layers className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
              {currentUser?.Role === 'admin' 
                ? `Rp ${(summary?.totalSalesEver || 0).toLocaleString('id-ID')}`
                : (currentUser?.Nama || 'Kasir')}
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              {currentUser?.Role === 'admin' ? 'Omzet kumulatif di database' : 'Hak Akses: KASIR MAISSY'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Main Charts & Visualizations Grid */}
      {currentUser?.Role === 'admin' ? (
        <div id="analytics-visuals" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart 1: Line Chart - Tren Penjualan Harian */}
          <div id="chart-daily-sales" className="lg:col-span-2 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base">Perkembangan Penjualan Mingguan</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Grafik total transaksi rupiah dalam 7 hari terakhir</p>
              </div>
            </div>

            {/* Premium Custom SVG Chart */}
            <div className="w-full h-64 mt-4 relative">
              <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = 20 + ratio * 140;
                  const labelVal = Math.round(maxSalesVal - ratio * maxSalesVal);
                  return (
                    <g key={index}>
                      <line x1="45" y1={y} x2="485" y2={y} stroke="#e4e4e7" strokeDasharray="4 4" className="dark:stroke-zinc-800/50" />
                      <text x="5" y={y + 4} fill="#a1a1aa" className="text-[10px] font-mono select-none" textAnchor="start">
                        {labelVal >= 1000000 
                          ? `${(labelVal / 1000000).toFixed(1)}M` 
                          : labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Draw the area and path line */}
                {salesLast7Days.length > 1 && (() => {
                  const paddingLeft = 60;
                  const paddingRight = 15;
                  const width = 500 - paddingLeft - paddingRight;
                  const height = 140;
                  const step = width / (salesLast7Days.length - 1);

                  const points = salesLast7Days.map((d: any, index: number) => {
                    const x = paddingLeft + index * step;
                    const y = 160 - (d.amount / (maxSalesVal || 1)) * height;
                    return { x, y };
                  });

                  const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
                  const areaD = `${pathD} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`;

                  return (
                    <>
                      {/* Gradient Area Fill */}
                      <path d={areaD} fill="url(#chart-gradient)" />
                      {/* Stroke Line */}
                      <path d={pathD} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      {/* Point Dots */}
                      {points.map((p, index) => {
                        const amt = salesLast7Days[index].amount;
                        return (
                          <g key={index} className="group cursor-pointer">
                            <circle cx={p.x} cy={p.y} r="5" fill="#d97706" stroke="#ffffff" strokeWidth="1.5" className="dark:stroke-[#1a1613] hover:r-7 transition-all duration-200" />
                            {/* Hover tooltip logic built in SVG for reliability */}
                            <rect x={p.x - 45} y={p.y - 32} width="90" height="20" rx="4" fill="#18181b" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                            <text x={p.x} y={p.y - 18} fill="#ffffff" className="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none text-center" textAnchor="middle">
                              Rp {Math.round(amt / 1000)}k
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>

              {/* X Axis Labels */}
              <div className="absolute bottom-1 left-[60px] right-[15px] flex justify-between">
                {salesLast7Days.map((d: any, idx: number) => (
                  <span key={idx} className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 font-sans">
                    {d.date}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Chart 2: Donut Chart - Kategori Terlaris */}
          <div id="chart-categories" className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base">Proporsi Kategori Menu</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Persentase omzet penjualan berdasar kelompok produk</p>
            </div>

            {/* Interactive Custom SVG Donut Chart */}
            <div className="flex items-center justify-center my-6">
              <div className="relative w-44 h-44">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {(() => {
                    const totalVal = categoryDistribution.reduce((acc: number, cur: any) => acc + cur.value, 0) || 1;
                    let currentOffset = 0;

                    return categoryDistribution.map((cat: any, index: number) => {
                      const percentage = (cat.value / totalVal) * 100;
                      const strokeDasharray = `${percentage} ${100 - percentage}`;
                      const strokeDashoffset = 100 - currentOffset;
                      currentOffset += percentage;

                      const color = categoryColors[cat.name] || '#a1a1aa';

                      return (
                        <circle
                          key={index}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke={color}
                          strokeWidth="10"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Center text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</span>
                  <span className="text-xs font-extrabold text-zinc-950 dark:text-zinc-50 mt-0.5">
                    Rp {categoryDistribution.reduce((acc: number, cur: any) => acc + cur.value, 0) >= 1000000
                      ? `${(categoryDistribution.reduce((acc: number, cur: any) => acc + cur.value, 0) / 1000000).toFixed(2)}M`
                      : `${Math.round(categoryDistribution.reduce((acc: number, cur: any) => acc + cur.value, 0) / 1000)}k`}
                  </span>
                </div>
              </div>
            </div>

            {/* Legends list */}
            <div className="space-y-1.5 mt-2">
              {categoryDistribution.map((cat: any, idx: number) => {
                const totalVal = categoryDistribution.reduce((acc: number, cur: any) => acc + cur.value, 0) || 1;
                const percent = ((cat.value / totalVal) * 100).toFixed(1);
                const color = categoryColors[cat.name] || '#a1a1aa';
                return (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                      <span className="text-zinc-600 dark:text-zinc-400">{cat.name}</span>
                    </div>
                    <div className="text-zinc-900 dark:text-zinc-200">
                      Rp {(cat.value || 0).toLocaleString('id-ID')} <span className="text-[10px] text-zinc-400 ml-1">({percent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Alternate Dashboard for Cashier role */
        <div id="cashier-shift-dashboard" className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613]">
          <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base flex items-center gap-2">
            Panduan & Tindakan Kasir
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Petunjuk operasional standar kasir Maissy Coffee</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
              <h4 className="font-bold text-sm text-amber-700 dark:text-amber-500">1. Catat Nama Pelanggan</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Selalu tanyakan dan input nama pelanggan sebelum melakukan pembayaran. Ini penting untuk pemanggilan pesanan di barist.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-teal-500/5 border border-teal-500/10 space-y-2">
              <h4 className="font-bold text-sm text-teal-700 dark:text-teal-500">2. Proses Pembayaran</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Pilih item di POS, klik Bayar, masukkan nominal uang yang diserahkan pelanggan. Sistem akan otomatis menghitung uang kembali.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
              <h4 className="font-bold text-sm text-indigo-700 dark:text-indigo-500">3. Cetak Struk Bukti</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Setelah transaksi sukses, jendela pop-up struk akan muncul. Cetak struk belanja pelanggan dan serahkan bersama pesanan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Top 5 Best Sellers (Admin Only) */}
      {currentUser?.Role === 'admin' && (
        <div id="top-sellers-section" className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613]">
          <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-base">Top 5 Produk Terlaris</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Produk dengan kuantitas penjualan tertinggi saat ini</p>
          
          <div className="mt-6 space-y-4">
            {topSellingItems.map((item: any, idx: number) => {
              const maxQty = Math.max(...topSellingItems.map((t: any) => t.qty), 1);
              const progressPct = (item.qty / maxQty) * 100;

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-md bg-zinc-100 dark:bg-[#25201c] flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                        #{idx + 1}
                      </span>
                      <span className="text-zinc-800 dark:text-zinc-200">{item.name}</span>
                    </div>
                    <span className="text-zinc-500 dark:text-zinc-400 font-mono">
                      {item.qty} pcs <span className="text-[10px] text-zinc-400 ml-1">(Rp {(item.total || 0).toLocaleString('id-ID')})</span>
                    </span>
                  </div>
                  {/* Custom progress line */}
                  <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
