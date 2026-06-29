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
      className="p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer
        light:bg-zinc-100 light:hover:bg-zinc-200 light:text-zinc-800
        dark:bg-[#25201c] dark:hover:bg-[#342d27] dark:text-amber-400 border border-zinc-200 dark:border-zinc-800"
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
