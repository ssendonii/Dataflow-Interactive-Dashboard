import { useRef } from 'react';
import { Download, FileText, Menu, Moon, Sun, Upload } from 'lucide-react';
import { NavSection } from '../types/dataset';

interface TopBarProps {
  activeSection: NavSection;
  appVersion: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onImportCsvFile: (file: File) => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Overview',
  studio: 'Chart Studio',
  dimensions: 'Dimensions & Schema',
  ledger: 'Data Ledger',
  ai: 'AI Dataset Analyst',
};

export function TopBar({
  activeSection,
  appVersion,
  isDark,
  onToggleTheme,
  onOpenMobileNav,
  onExportCsv,
  onExportPdf,
  onImportCsvFile,
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
          <span className="hidden text-slate-400 sm:inline dark:text-slate-500 whitespace-nowrap">
            CSV Analytics
          </span>
          <span className="hidden text-slate-300 sm:inline dark:text-slate-700">/</span>
          <span className="truncate font-display font-semibold text-slate-900 dark:text-slate-100">
            {SECTION_TITLES[activeSection]}
          </span>
          <span className="hidden text-slate-300 md:inline dark:text-slate-700">·</span>
          <span className="hidden font-mono text-xs text-slate-500 md:inline dark:text-slate-400 whitespace-nowrap">
            v{appVersion}
          </span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportCsvFile(file);
              e.target.value = '';
            }
          }}
        />

        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Upload CSV</span>
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Print / PDF</span>
        </button>

        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Export CSV</span>
        </button>
      </div>
    </header>
  );
}
