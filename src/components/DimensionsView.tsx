import { useMemo, useState } from 'react';
import {
  ColumnKind,
  ParsedRow,
  UniversalDataset,
  UniversalFilterState,
} from '../types/dataset';
import {
  aggregateUniversal,
  computeCoOccurrences,
  formatColumnValue,
  formatPercent,
} from '../utils/csvEngine';
import { Sparkline } from './charts/Sparkline';

interface DimensionsViewProps {
  dataset: UniversalDataset;
  filteredRows: ParsedRow[];
  filters: UniversalFilterState;
  onUpdateFilters: (next: UniversalFilterState) => void;
  onOverrideColumnKind: (columnName: string, kind: ColumnKind) => void;
}

export function DimensionsView({
  dataset,
  filteredRows,
  filters,
  onUpdateFilters,
  onOverrideColumnKind,
}: DimensionsViewProps) {
  const categoryCols = useMemo(
    () => dataset.columns.filter((c) => c.kind === 'category' && c.uniqueCount >= 2),
    [dataset.columns]
  );

  const [selectedDim, setSelectedDim] = useState<string>(
    dataset.primaryCategoryCol || categoryCols[0]?.name || ''
  );

  const activeDim = categoryCols.some((c) => c.name === selectedDim)
    ? selectedDim
    : dataset.primaryCategoryCol || categoryCols[0]?.name || '';

  const pMetricCol = dataset.primaryMetricCol || '__count';
  const pMetricKind =
    dataset.columns.find((c) => c.name === dataset.primaryMetricCol)?.kind ?? 'count';

  const dimBuckets = useMemo(() => {
    if (!activeDim) return [];
    return aggregateUniversal(
      dataset,
      filteredRows,
      activeDim,
      pMetricCol,
      dataset.primaryMetricCol ? 'sum' : 'count'
    );
  }, [dataset, filteredRows, activeDim, pMetricCol]);

  const sparklineMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    if (!activeDim || !dataset.primaryDateCol) return map;

    const dates = Array.from(
      new Set(
        filteredRows
          .map((r) => r.dates[dataset.primaryDateCol!])
          .filter((d): d is string => Boolean(d))
      )
    ).sort();
    if (dates.length < 2) return map;

    const bucketCount = Math.min(8, dates.length);
    const chunkSize = Math.max(1, Math.ceil(dates.length / bucketCount));

    for (const b of dimBuckets.slice(0, 25)) {
      const byDate = new Map<string, number>();
      for (const r of filteredRows) {
        const val = r.raw[activeDim] || '(Empty)';
        if (val !== b.key) continue;
        const d = r.dates[dataset.primaryDateCol!];
        if (!d) continue;
        const mVal = dataset.primaryMetricCol
          ? r.numbers[dataset.primaryMetricCol] ?? 0
          : 1;
        byDate.set(d, (byDate.get(d) || 0) + mVal);
      }

      const series: number[] = [];
      for (let i = 0; i < dates.length; i += chunkSize) {
        const slice = dates.slice(i, i + chunkSize);
        series.push(slice.reduce((s, d) => s + (byDate.get(d) || 0), 0));
      }
      map[b.key] = series;
    }
    return map;
  }, [activeDim, dataset.primaryDateCol, dataset.primaryMetricCol, dimBuckets, filteredRows]);

  const coOccurrences = useMemo(() => {
    if (!activeDim || !dataset.hasMultiRowEntities) return [];
    return computeCoOccurrences(dataset, filteredRows, activeDim);
  }, [dataset, filteredRows, activeDim]);

  const toggleFilterValue = (val: string) => {
    if (!activeDim) return;
    const current = filters.categoryFilters[activeDim] || [];
    const exists = current.includes(val);
    onUpdateFilters({
      ...filters,
      categoryFilters: {
        ...filters.categoryFilters,
        [activeDim]: exists ? [] : [val],
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Schema & Column Type Inspector */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Detected CSV Schema & Column Summary
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Override any inferred column type to adjust how charts and metrics interpret your CSV
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {dataset.columns.length} columns · {dataset.rows.length} rows
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
                <th className="py-3 pr-4 pl-6 font-medium text-slate-600 dark:text-slate-300">
                  Column Name
                </th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  Type
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  Unique
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  Missing
                </th>
                <th className="py-3 pr-6 pl-4 font-medium text-slate-600 dark:text-slate-300">
                  Distribution / Range Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dataset.columns.map((col) => {
                let summaryText = col.sampleValues.slice(0, 3).join(' · ') || '—';
                if (
                  (col.kind === 'currency' || col.kind === 'number' || col.kind === 'percent') &&
                  col.minNumber !== undefined &&
                  col.maxNumber !== undefined &&
                  col.avgNumber !== undefined
                ) {
                  summaryText = `Min ${formatColumnValue(col.minNumber, col.kind)} · Avg ${formatColumnValue(
                    col.avgNumber,
                    col.kind
                  )} · Max ${formatColumnValue(col.maxNumber, col.kind)}`;
                } else if (col.kind === 'date' && col.minDate && col.maxDate) {
                  summaryText = `${col.minDate} to ${col.maxDate}`;
                }

                return (
                  <tr key={col.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 pl-6 font-medium text-slate-900 dark:text-slate-100">
                      {col.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        aria-label={`Column type for ${col.name}`}
                        value={col.kind}
                        onChange={(e) =>
                          onOverrideColumnKind(col.name, e.target.value as ColumnKind)
                        }
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="currency">currency</option>
                        <option value="number">number</option>
                        <option value="percent">percent</option>
                        <option value="date">date</option>
                        <option value="category">category</option>
                        <option value="id">id</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                      {col.uniqueCount}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                      {col.nullCount}
                    </td>
                    <td className="py-2.5 pr-6 pl-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {summaryText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dimension Breakdown & Co-Occurrence */}
      {activeDim && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section
            className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
              coOccurrences.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  {activeDim} Breakdown
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Click any row to filter dashboard by that value
                </p>
              </div>
              {categoryCols.length > 1 && (
                <select
                  aria-label="Select category dimension"
                  value={activeDim}
                  onChange={(e) => setSelectedDim(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {categoryCols.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.uniqueCount})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
                    <th className="py-3 pr-4 pl-6 font-medium text-slate-600 dark:text-slate-300">
                      {activeDim}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                      Rows
                    </th>
                    {dataset.primaryMetricCol && (
                      <>
                        <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                          Total {dataset.primaryMetricCol}
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                          Avg
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                      Share
                    </th>
                    {dataset.primaryDateCol && (
                      <th className="py-3 pr-6 pl-4 text-right font-medium text-slate-600 dark:text-slate-300">
                        Trend
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dimBuckets.slice(0, 30).map((b) => {
                    const isSelected = (filters.categoryFilters[activeDim] || []).includes(
                      b.key
                    );
                    return (
                      <tr
                        key={b.key}
                        onClick={() => toggleFilterValue(b.key)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/30'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2.5 pr-4 pl-6 font-medium text-slate-900 dark:text-slate-100">
                          {b.label}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {b.count}
                        </td>
                        {dataset.primaryMetricCol && (
                          <>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {formatColumnValue(b.sumPrimary, pMetricKind)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                              {formatColumnValue(b.avgPrimary, pMetricKind)}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                          {formatPercent(b.shareValue)}
                        </td>
                        {dataset.primaryDateCol && (
                          <td className="py-2.5 pr-6 pl-4">
                            <div className="flex justify-end">
                              <Sparkline values={sparklineMap[b.key] || []} />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {coOccurrences.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Co-Occurrence Pairings
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {activeDim} values appearing together under the same {dataset.entityIdCol}
                </p>
              </div>
              <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                {coOccurrences.slice(0, 20).map((pair, idx) => (
                  <div
                    key={`${pair.itemA}-${pair.itemB}`}
                    className="flex items-start justify-between gap-3 py-3 first:pt-1"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        <span className="mr-2 font-mono text-slate-400">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        {pair.itemA}
                      </div>
                      <div className="mt-0.5 pl-6 text-xs text-slate-500 dark:text-slate-400">
                        + {pair.itemB}
                      </div>
                      <div className="mt-1 pl-6 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                        {pair.entityIds.slice(0, 4).join(', ')}
                        {pair.entityIds.length > 4 ? ` +${pair.entityIds.length - 4}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {formatColumnValue(pair.combinedMetric, pMetricKind)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {pair.occurrences} {pair.occurrences === 1 ? 'group' : 'groups'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
