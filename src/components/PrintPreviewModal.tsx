import React, { useEffect, useState } from 'react';
import { X, Printer, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Transaction, TransactionDetail } from '../types';

interface PrintPreviewModalProps {
  txId: string;
  paperSize: '58' | '80' | 'A4';
  onClose: () => void;
}

export default function PrintPreviewModal({ txId, paperSize, onClose }: PrintPreviewModalProps) {
  const [data, setData] = useState<{
    transaction: Transaction;
    details: TransactionDetail[];
    settings: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReceiptData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/receipt/${txId}/data`);
        if (!res.ok) {
          throw new Error('Gagal mengambil data struk belanja.');
        }
        const json = await res.json();
        if (json.success) {
          setData(json);
        } else {
          throw new Error(json.message || 'Transaksi tidak ditemukan.');
        }
      } catch (err: any) {
        console.error('Error fetching receipt:', err);
        setError(err.message || 'Gagal memuat data cetak struk.');
      } finally {
        setLoading(false);
      }
    }

    if (txId) {
      loadReceiptData();
    }
  }, [txId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
        <div className="bg-white dark:bg-[#1a1613] p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Menyiapkan Pratinjau Struk...</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Mengambil data transaksi dan tata letak cetak</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
        <div className="bg-white dark:bg-[#1a1613] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-500 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-500 rounded-full mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Gagal Membuka Pratinjau</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 mb-4 leading-relaxed">{error || 'Data tidak ditemukan'}</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-xs rounded-xl transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { transaction: tx, details, settings } = data;

  // Custom Paper sizing configuration for layout display
  const widthClass = paperSize === '58' ? 'max-w-[320px]' : paperSize === '80' ? 'max-w-[390px]' : 'max-w-[720px]';
  const paperBg = paperSize === 'A4' ? 'bg-white text-zinc-900' : 'bg-[#faf8f5] dark:bg-[#fffdfa] text-black border border-amber-900/10 shadow-inner';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto no-print">
      <div className="w-full max-w-2xl bg-zinc-50 dark:bg-[#15110e] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 bg-white dark:bg-[#1a1613] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-lg">
              <Printer className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50 text-sm">Pratinjau Struk Belanja</h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Format: {paperSize === '58' ? 'Kertas Thermal 58mm' : paperSize === '80' ? 'Kertas Thermal 80mm' : 'Invoice A4 HVS'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Paper Container Viewport */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-zinc-200 dark:bg-zinc-900/40">
          
          {/* PHYSICAL STRUCT FOR MEDIA DISPLAY & MEDIA PRINTING */}
          <div
            id="printable-receipt"
            className={`w-full ${widthClass} ${paperBg} p-5 md:p-6 rounded-lg transition-all font-mono text-xs select-none`}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              color: '#000000',
              lineHeight: '1.4'
            }}
          >
            {/* Header / Store Info */}
            <div className="text-center mb-3">
              <h2 className="text-base font-bold tracking-tight uppercase" style={{ fontSize: '15px', fontWeight: 'bold' }}>
                {settings.namaToko || 'Maissy Coffee'}
              </h2>
              <p className="text-[10px] mt-0.5 leading-snug">{settings.alamat || ''}</p>
              {settings.telepon && (
                <p className="text-[10px] leading-snug">Telp: {settings.telepon}</p>
              )}
            </div>

            {/* Dash Line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* Metadata (Cashier / Customer / Invoice ID) */}
            <table className="w-full text-[11px] leading-snug mb-1">
              <tbody>
                <tr>
                  <td className="py-0.5 text-left">ID: {tx.ID_Transaksi}</td>
                  <td className="py-0.5 text-right">Kasir: {tx.Kasir || 'Kasir'}</td>
                </tr>
                <tr>
                  <td className="py-0.5 text-left">
                    Tgl: {(() => {
                      try {
                        const d = new Date(tx.Tanggal);
                        return isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
                      } catch (e) {
                        return '-';
                      }
                    })()}
                  </td>
                  <td className="py-0.5 text-right">Pelanggan: {tx.Nama_Pelanggan || '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* Dash Line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* Items List Table */}
            <table className="w-full text-[11px] leading-snug mb-2">
              <tbody>
                {details.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td colSpan={2} className="pt-1.5 font-bold text-left">{item.Nama_Menu}</td>
                    </tr>
                    <tr>
                      <td className="pl-3 text-left">
                        {item.Qty} x Rp {Number(item.Harga_Satuan || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="text-right">
                        Rp {Number(item.Subtotal || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Dash Line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* Transaction Totals summary */}
            <table className="w-full text-[11px] leading-snug">
              <tbody>
                <tr>
                  <td className="py-0.5 text-left">Total Item:</td>
                  <td className="py-0.5 text-right">{tx.Total_Item || 0}</td>
                </tr>
                <tr className="font-bold">
                  <td className="py-0.5 text-left">Grand Total:</td>
                  <td className="py-0.5 text-right">Rp {Number(tx.Total_Harga || 0).toLocaleString('id-ID')}</td>
                </tr>
                <tr>
                  <td className="py-1 text-left">Metode Bayar:</td>
                  <td className="py-1 text-right font-bold">{tx.Metode_Bayar || 'TUNAI'}</td>
                </tr>
                <tr>
                  <td className="py-0.5 text-left">Tunai / Bayar:</td>
                  <td className="py-0.5 text-right">Rp {Number(tx.Bayar || 0).toLocaleString('id-ID')}</td>
                </tr>
                <tr>
                  <td className="py-0.5 text-left">Kembali:</td>
                  <td className="py-0.5 text-right">Rp {Number(tx.Kembali || 0).toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>

            {/* Dash Line */}
            <div className="border-t border-dashed border-black my-2.5" />

            {/* Footer message */}
            <div className="text-center text-[10px] leading-relaxed mt-2">
              <p className="whitespace-pre-line">{settings.pesanFooter || 'Terima kasih telah berbelanja!'}</p>
              <p className="text-[8px] mt-2 opacity-60">support system By PGW</p>
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white dark:bg-[#1a1613] border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer transition text-center"
          >
            Tutup Pratinjau
          </button>
          
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/10 transition"
          >
            <Printer className="h-4 w-4" />
            Cetak Struk (PDF)
          </button>
        </div>

      </div>
    </div>
  );
}
