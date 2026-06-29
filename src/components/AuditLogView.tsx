/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertCircle, History } from 'lucide-react';

export default function AuditLogView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => 
    log.Nama_User.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.Action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.Module.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.Description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Badge styles
  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500';
      case 'CHECKOUT': return 'bg-teal-500/10 text-teal-600 dark:text-teal-500';
      case 'ADD_MENU': return 'bg-amber-500/10 text-amber-600 dark:text-amber-500';
      case 'UPDATE_MENU': return 'bg-blue-500/10 text-blue-600 dark:text-blue-500';
      case 'DELETE_MENU': return 'bg-rose-500/10 text-rose-600';
      case 'UPDATE_SETTINGS': return 'bg-purple-500/10 text-purple-600 dark:text-purple-500';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400';
    }
  };

  return (
    <div id="audit-log-container" className="space-y-6">
      
      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="audit-logs-heading" className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            Log Aktivitas & Audit Trail
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Riwayat log audit real-time tindakan operasional kasir dan administrator untuk kepatuhan keamanan data.
          </p>
        </div>

        <button
          id="refresh-logs-btn"
          onClick={fetchLogs}
          className="py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#25201c] flex items-center justify-center gap-2 cursor-pointer text-xs font-semibold transition"
        >
          <RefreshCw className="h-4 w-4" />
          Segarkan Log
        </button>
      </div>

      {/* Filtering Search */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1a1613] border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            id="log-search-input"
            type="text"
            placeholder="Cari kata kunci tindakan, modul (AUTH/POS), pengguna, atau deskripsi log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#25201c] text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500 font-semibold text-xs transition"
          />
        </div>
      </div>

      {/* Logs List Container */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-zinc-400 text-xs mt-2">Memuat jejak audit log...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#1a1613] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
          <p className="text-zinc-500 text-sm font-semibold">Tidak ada log aktivitas ditemukan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div id="logs-list-wrapper" className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1613] shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left">
                <thead className="bg-zinc-50 dark:bg-[#1f1a16] text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Waktu Kejadian</th>
                    <th className="px-6 py-4">Petugas</th>
                    <th className="px-6 py-4">Aktivitas</th>
                    <th className="px-6 py-4">Modul</th>
                    <th className="px-6 py-4">Deskripsi Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {filteredLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-[#25201c]/30 transition">
                      {/* Timestamp */}
                      <td className="px-6 py-4 font-mono text-zinc-400 dark:text-zinc-500">
                        {new Date(log.Timestamp).toLocaleString('id-ID')}
                      </td>
                      {/* User */}
                      <td className="px-6 py-4">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{log.Nama_User}</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono">ID: {log.ID_User}</span>
                      </td>
                      {/* Action */}
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getActionColor(log.Action)}`}>
                          {log.Action}
                        </span>
                      </td>
                      {/* Module */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">{log.Module}</span>
                      </td>
                      {/* Description */}
                      <td className="px-6 py-4 max-w-xs sm:max-w-md break-words text-zinc-600 dark:text-zinc-300">
                        {log.Description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
