import { useMemo, useState } from 'react';
import { AggregationOp, ColumnKind, ParsedRow, UniversalDataset } from '../../types/dataset';
import {
  buildUniversalCalendar,
  CalendarCell,
  formatColumnValue,
  formatFullDate,
} from '../../utils/csvEngine';

interface CalendarHeatmapProps {
  dataset: UniversalDataset;
  rows: ParsedRow[];
  metricCol: string;
  op: AggregationOp;
  valueKind: ColumnKind | 'count';
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}

const WEEKDAY_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarHeatmap({
  dataset,
  rows,
  metricCol,
  op,
  valueKind,
  selectedDate = null,
  onSelectDate,
}: CalendarHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<CalendarCell | null>(null);

  const cells = useMemo(
    () => buildUniversalCalendar(dataset, rows, metricCol, op),
    [dataset, rows, metricCol, op]
  );

  const maxVal = useMemo(() => {
    const m = Math.max(...cells.map((c) => c.value), 0);
    return m || 1;
  }, [cells]);

  const weekColumns = useMemo(() => {
    const maxWeek = Math.max(...cells.map((c) => c.weekIndex), 0);
    const cols: (CalendarCell | null)[][] = Array.from(
      { length: maxWeek + 1 },
      () => Array(7).fill(null)
    );
    for (const c of cells) {
      if (cols[c.weekIndex]) {
        cols[c.weekIndex][c.weekdayIndex] = c;
      }
    }
    return cols;
  }, [cells]);

  if (!dataset.primaryDateCol || cells.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Upload a CSV with a Date column to view the daily calendar grid.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="min-h-[18px]">
          {hoveredCell ? (
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {formatFullDate(hoveredCell.date)} ·{' '}
              <span className="font-mono">
                {formatColumnValue(hoveredCell.value, valueKind)} ({hoveredCell.count} rows)
              </span>
            </span>
          ) : (
            <span>
              Daily intensity from {formatFullDate(dataset.minDate)} to{' '}
              {formatFullDate(dataset.maxDate)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span>0</span>
          {[0.15, 0.35, 0.58, 0.85].map((alpha) => (
            <span
              key={alpha}
              className="h-3 w-3 rounded-xs"
              style={{ backgroundColor: `rgba(37, 99, 235, ${alpha})` }}
            />
          ))}
          <span>Peak</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-2">
          <div className="flex flex-col gap-1.5 pt-5 pr-1">
            {WEEKDAY_ROWS.map((day) => (
              <div
                key={day}
                className="flex h-8 items-center font-mono text-[11px] text-slate-400 dark:text-slate-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            {weekColumns.map((col, wIdx) => {
              const firstValid = col.find((c) => c !== null);
              return (
                <div key={wIdx} className="flex flex-col gap-1.5">
                  <div className="h-4 text-center font-mono text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {firstValid ? firstValid.shortLabel : ''}
                  </div>
                  {col.map((cell, dIdx) => {
                    if (!cell) {
                      return <div key={dIdx} className="h-8 w-12 rounded-xs" />;
                    }
                    const ratio = cell.value > 0 ? cell.value / maxVal : 0;
                    const isSelected = selectedDate === cell.date;
                    const highContrast = ratio > 0.55;

                    return (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => onSelectDate?.(cell.date)}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`${formatFullDate(cell.date)}: ${formatColumnValue(cell.value, valueKind)}`}
                        className={`flex h-8 w-12 flex-col items-center justify-center rounded-xs font-mono text-[10px] transition-transform duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                          isSelected ? 'ring-2 ring-slate-900 dark:ring-white' : ''
                        } ${
                          cell.value === 0
                            ? 'border border-slate-200/80 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-700'
                            : highContrast
                            ? 'font-semibold text-white'
                            : 'font-medium text-slate-900 dark:text-slate-100'
                        }`}
                        style={
                          cell.value > 0
                            ? {
                                backgroundColor: `rgba(37, 99, 235, ${(0.14 + ratio * 0.82).toFixed(2)})`,
                              }
                            : undefined
                        }
                      >
                        {cell.value > 0
                          ? formatColumnValue(cell.value, valueKind, true)
                          : '0'}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
