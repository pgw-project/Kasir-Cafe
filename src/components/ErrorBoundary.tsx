import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught React rendering error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAll = () => {
    if (confirm('Apakah Anda yakin ingin menyetel ulang seluruh sesi dan penyimpanan lokal? Ini dapat membantu menyelesaikan masalah layar putih.')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-zinc-50 dark:bg-[#1a1613] text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
          <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-[#25201c] border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl shadow-zinc-200/40 dark:shadow-none space-y-6 text-center">
            {/* Warning Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-500 shadow-inner">
              <AlertCircle className="w-8 h-8 animate-pulse" />
            </div>

            {/* Title & Copy */}
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Sistem Mengalami Kendala
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                Terjadi kesalahan tampilan saat memuat komponen halaman ini. Jangan khawatir, data transaksi Anda tetap aman di server.
              </p>
            </div>

            {/* Error Message Details (Collapsible/Debug) */}
            {this.state.error && (
              <div className="p-3 bg-zinc-50 dark:bg-[#15110e] rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 text-left">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Detail Teknis:
                </p>
                <p className="text-[11px] font-mono font-medium text-amber-700 dark:text-amber-400 break-all leading-normal max-h-24 overflow-y-auto">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-lg shadow-amber-600/15 hover:shadow-amber-600/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Segarkan & Muat Ulang Halaman
              </button>

              <button
                onClick={this.handleResetAll}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-zinc-400" />
                Sapu Bersih Cache & Sesi Lokal
              </button>
            </div>

            {/* Footer info */}
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold pt-2">
              Sistem POS Kasir Maissy &bull; Versi 2.1.0
            </p>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
