import { X } from 'lucide-react';
import { EntityGroup, ParsedRow, UniversalDataset } from '../types/dataset';
import { formatColumnValue, formatFullDate } from '../utils/csvEngine';

interface RowDetailDrawerProps {
  dataset: UniversalDataset;
  selectedEntity: EntityGroup | null;
  selectedRow: ParsedRow | null;
  onClose: () => void;
  onFilterCategory?: (colName: string, value: string) => void;
}

export function RowDetailDrawer({
  dataset,
  selectedEntity,
  selectedRow,
  onClose,
  onFilterCategory,
}: RowDetailDrawerProps) {
  if (!selectedEntity && !selectedRow) return null;

  const pMetricCol = dataset.primaryMetricCol;
  const pMetricKind =
    dataset.columns.find((c) => c.name === pMetricCol)?.kind ?? 'number';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/35 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Record details"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {selectedEntity
                ? `${dataset.entityIdCol}: ${selectedEntity.entityId}`
                : `Row #${selectedRow?.rowIndex}`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selectedEntity
                ? `${selectedEntity.date ? formatFullDate(selectedEntity.date) + ' · ' : ''}${
                    selectedEntity.rowCount
                  } ${selectedEntity.rowCount === 1 ? 'record' : 'records'}`
                : `${dataset.columns.length} fields`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close detail drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {selectedEntity ? (
            <>
              {pMetricCol && (
                <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Total {pMetricCol}
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {formatColumnValue(selectedEntity.primaryMetricTotal, pMetricKind)}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Line Records
                </h3>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedEntity.rows.map((r) => (
                    <div key={r.rowIndex} className="space-y-2 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {dataset.primaryCategoryCol
                              ? r.raw[dataset.primaryCategoryCol] || `Row #${r.rowIndex}`
                              : `Row #${r.rowIndex}`}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {dataset.columns
                              .filter(
                                (c) =>
                                  c.name !== dataset.entityIdCol &&
                                  c.name !== dataset.primaryCategoryCol &&
                                  c.name !== pMetricCol
                              )
                              .slice(0, 3)
                              .map((c) => r.raw[c.name])
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                        {pMetricCol && r.numbers[pMetricCol] !== null && (
                          <div className="shrink-0 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {formatColumnValue(r.numbers[pMetricCol] ?? 0, pMetricKind)}
                          </div>
                        )}
                      </div>
                      {onFilterCategory &&
                        dataset.primaryCategoryCol &&
                        r.raw[dataset.primaryCategoryCol] && (
                          <button
                            type="button"
                            onClick={() => {
                              onFilterCategory(
                                dataset.primaryCategoryCol!,
                                r.raw[dataset.primaryCategoryCol!]
                              );
                              onClose();
                            }}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            Filter dashboard by {r.raw[dataset.primaryCategoryCol]}
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : selectedRow ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {dataset.columns.map((col) => {
                const rawVal = selectedRow.raw[col.name] || '—';
                return (
                  <div
                    key={col.name}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {col.name}
                    </span>
                    <div className="text-right">
                      <span
                        className={`text-sm text-slate-900 dark:text-slate-100 ${
                          col.kind === 'currency' ||
                          col.kind === 'number' ||
                          col.kind === 'percent' ||
                          col.kind === 'date'
                            ? 'font-mono font-medium'
                            : 'font-medium'
                        }`}
                      >
                        {rawVal}
                      </span>
                      {col.kind === 'category' &&
                        onFilterCategory &&
                        rawVal !== '—' && (
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                onFilterCategory(col.name, rawVal);
                                onClose();
                              }}
                              className="mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              Filter by this value
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
