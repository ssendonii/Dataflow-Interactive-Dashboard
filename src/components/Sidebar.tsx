import {
  BarChart3,
  Layers,
  LayoutDashboard,
  RotateCcw,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import { NavSection } from '../types/dataset';
import { formatFullDate } from '../utils/csvEngine';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  datasetName: string;
  rowCount: number;
  columnCount: number;
  uniqueEntityCount: number | null;
  entityColName: string | null;
  minDate: string;
  maxDate: string;
  isDefaultDataset: boolean;
  onResetToDefault: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'studio', label: 'Chart Studio', icon: BarChart3 },
  { id: 'dimensions', label: 'Dimensions & Schema', icon: Layers },
  { id: 'ledger', label: 'Data Ledger', icon: Table2 },
  { id: 'ai', label: 'AI Analyst', icon: Sparkles },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  datasetName,
  rowCount,
  columnCount,
  uniqueEntityCount,
  entityColName,
  minDate,
  maxDate,
  isDefaultDataset,
  onResetToDefault,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white px-4 py-5 dark:bg-slate-900">
      <div>
        <div className="flex items-center justify-between px-2 pb-6">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            DataPrism
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 px-2 pt-4 dark:border-slate-800">
        <div
          className="truncate text-xs font-medium text-slate-900 dark:text-slate-100"
          title={datasetName}
        >
          {datasetName}
        </div>
        <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
          {rowCount} rows · {columnCount} cols
        </div>
        {entityColName && uniqueEntityCount !== null && (
          <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
            {uniqueEntityCount} unique {entityColName}
          </div>
        )}
        {minDate && maxDate && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatFullDate(minDate)} – {formatFullDate(maxDate)}
          </div>
        )}
        {!isDefaultDataset && (
          <button
            type="button"
            onClick={onResetToDefault}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Load Sample Sales CSV
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 lg:block dark:border-slate-800">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 h-full w-64 border-r border-slate-200 dark:border-slate-800">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
