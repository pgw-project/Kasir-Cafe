/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ isDarkMode, onToggle }: ThemeToggleProps) {
  return (
    <button
      id="theme-toggle-btn"
      onClick={onToggle}
      className="p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer
        bg-zinc-100 hover:bg-zinc-200 text-zinc-800 hover:scale-105 active:scale-95
        dark:bg-[#25201c] dark:hover:bg-[#342d27] dark:text-amber-400 border border-zinc-200/60 dark:border-zinc-800/60 dark:shadow-[0_0_12px_rgba(245,158,11,0.2)]"
      title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {isDarkMode ? (
        <>
          <Sun className="h-5 w-5 text-amber-400" />
          <span className="text-xs font-medium md:hidden text-amber-300">Mode Terang</span>
        </>
      ) : (
        <>
          <Moon className="h-5 w-5 text-zinc-600" />
          <span className="text-xs font-medium md:hidden text-zinc-600">Mode Gelap</span>
        </>
      )}
    </button>
  );
}
