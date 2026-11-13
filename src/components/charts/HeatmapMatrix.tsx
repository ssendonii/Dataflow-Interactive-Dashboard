import { useMemo, useState } from 'react';
import { AggregationOp, ColumnKind, ParsedRow, UniversalDataset } from '../../types/dataset';
import { formatColumnValue } from '../../utils/csvEngine';

interface HeatmapMatrixProps {
  dataset: UniversalDataset;
  rows: ParsedRow[];
  rowCol: string;
  colCol: string;
  metricCol: string;
  op: AggregationOp;
  valueKind: ColumnKind | 'count';
  onSelectCell?: (rowValue: string, colValue: string) => void;
}

export function HeatmapMatrix({
  dataset,
  rows,
  rowCol,
  colCol,
  metricCol,
  op,
  valueKind,
  onSelectCell,
}: HeatmapMatrixProps) {
  const [hovered, setHovered] = useState<{
    rowVal: string;
    colVal: string;
    value: number;
    count: number;
  } | null>(null);

  const { rowKeys, colKeys, matrix, maxCell } = useMemo(() => {
    const rowTotals = new Map<string, number>();
    const colTotals = new Map<string, number>();
    const cellMap = new Map<
      string,
      { sum: number; count: number; entities: Set<string> }
    >();
    const idCol = dataset.entityIdCol;

    for (const r of rows) {
      const rv = r.raw[rowCol] || '(Empty)';
      const cv = r.raw[colCol] || '(Empty)';
      const numVal = metricCol === '__count' ? 1 : r.numbers[metricCol] ?? 0;

      rowTotals.set(rv, (rowTotals.get(rv) || 0) + numVal);
      colTotals.set(cv, (colTotals.get(cv) || 0) + numVal);

      const k = `${rv}|||${cv}`;
      const cell = cellMap.get(k) || { sum: 0, count: 0, entities: new Set() };
      cell.sum += numVal;
      cell.count += 1;
      cell.entities.add(idCol ? r.raw[idCol] || String(r.rowIndex) : String(r.rowIndex));
      cellMap.set(k, cell);
    }

    const sortedRows = Array.from(rowTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k]) => k);

    const sortedCols = Array.from(colTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    let maxVal = 0;
    const grid: Record<string, Record<string, { value: number; count: number }>> = {};

    for (const rv of sortedRows) {
      grid[rv] = {};
      for (const cv of sortedCols) {
        const c = cellMap.get(`${rv}|||${cv}`);
        const count = c?.count ?? 0;
        const sum = c?.sum ?? 0;
        const entities = c?.entities.size ?? 0;
        const val =
          op === 'count'
            ? count
            : op === 'uniqueEntities'
            ? entities
            : op === 'avg'
            ? count > 0
              ? sum / count
              : 0
            : sum;
        if (val > maxVal) maxVal = val;
        grid[rv][cv] = { value: val, count };
      }
    }

    return {
      rowKeys: sortedRows,
      colKeys: sortedCols,
      matrix: grid,
      maxCell: maxVal || 1,
    };
  }, [dataset.entityIdCol, rows, rowCol, colCol, metricCol, op]);

  if (rowKeys.length === 0 || colKeys.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        Select two categorical dimensions with matching rows to render the heatmap matrix.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {hovered
            ? `${hovered.rowVal} × ${hovered.colVal}: ${formatColumnValue(hovered.value, valueKind)} (${hovered.count} rows)`
            : `${rowCol} × ${colCol} · Click any cell to filter`}
        </span>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span>Low</span>
          <div className="flex items-center gap-0.5">
            {[0.12, 0.3, 0.52, 0.75, 0.95].map((alpha) => (
              <span
                key={alpha}
                className="h-3 w-4 rounded-xs"
                style={{ backgroundColor: `rgba(37, 99, 235, ${alpha})` }}
              />
            ))}
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">
                {rowCol}
              </th>
              {colKeys.map((ck) => (
                <th
                  key={ck}
                  className="px-2 py-2 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap"
                >
                  {ck}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {rowKeys.map((rk) => (
              <tr key={rk}>
                <td className="max-w-[240px] truncate py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">
                  {rk}
                </td>
                {colKeys.map((ck) => {
                  const cell = matrix[rk][ck];
                  const intensity = cell.value > 0 ? Math.max(0.1, cell.value / maxCell) : 0;
                  const highContrast = intensity > 0.56;

                  return (
                    <td key={ck} className="p-1">
                      <button
                        type="button"
                        onClick={() => onSelectCell?.(rk, ck)}
                        onMouseEnter={() =>
                          setHovered({
                            rowVal: rk,
                            colVal: ck,
                            value: cell.value,
                            count: cell.count,
                          })
                        }
                        onMouseLeave={() => setHovered(null)}
                        className={`flex h-9 w-full items-center justify-end rounded-xs px-2.5 font-mono text-xs transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-blue-600 ${
                          cell.value === 0
                            ? 'bg-slate-50 text-slate-300 dark:bg-slate-900/50 dark:text-slate-700'
                            : highContrast
                            ? 'font-semibold text-white'
                            : 'font-medium text-slate-900 dark:text-slate-100'
                        }`}
                        style={
                          cell.value > 0
                            ? {
                                backgroundColor: `rgba(37, 99, 235, ${(0.1 + intensity * 0.85).toFixed(2)})`,
                              }
                            : undefined
                        }
                      >
                        {cell.value === 0
                          ? '—'
                          : formatColumnValue(cell.value, valueKind, true)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
