import { useMemo, useState } from 'react';
import { ArrowUpRight, Upload } from 'lucide-react';
import {
  AggregationOp,
  NavSection,
  ParsedRow,
  UniversalDataset,
  UniversalFilterState,
} from '../types/dataset';
import {
  aggregateUniversal,
  computeUniversalKpis,
  formatColumnValue,
  formatPercent,
} from '../utils/csvEngine';
import { CalendarHeatmap } from './charts/CalendarHeatmap';
import { getSeriesColor } from './charts/chartColors';
import { DonutChart } from './charts/DonutChart';
import { HorizontalBarChart } from './charts/HorizontalBarChart';
import { TrendChart, TrendMode } from './charts/TrendChart';

interface OverviewViewProps {
  dataset: UniversalDataset;
  filteredRows: ParsedRow[];
  filters: UniversalFilterState;
  onUpdateFilters: (next: UniversalFilterState) => void;
  onNavigate: (section: NavSection) => void;
  onUploadFile: (file: File) => void;
}

export function OverviewView({
  dataset,
  filteredRows,
  filters,
  onUpdateFilters,
  onNavigate,
  onUploadFile,
}: OverviewViewProps) {
  const [granularity, setGranularity] = useState<'__date_day' | '__date_week' | '__date_month'>(
    '__date_day'
  );
  const [trendMode, setTrendMode] = useState<TrendMode>('area');
  const [op, setOp] = useState<AggregationOp>(
    dataset.primaryMetricCol ? 'sum' : 'count'
  );
  const [stackBySecondary, setStackBySecondary] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const numericCols = useMemo(
    () =>
      dataset.columns.filter(
        (c) => c.kind === 'currency' || c.kind === 'number' || c.kind === 'percent'
      ),
    [dataset.columns]
  );

  const [selectedMetricCol, setSelectedMetricCol] = useState<string>(
    dataset.primaryMetricCol || '__count'
  );

  const activeMetricCol =
    selectedMetricCol === '__count' ||
    numericCols.some((c) => c.name === selectedMetricCol)
      ? selectedMetricCol
      : dataset.primaryMetricCol || '__count';

  const activeMetricSchema = dataset.columns.find((c) => c.name === activeMetricCol);
  const activeOp: AggregationOp = activeMetricCol === '__count' ? 'count' : op;
  const valueKind =
    activeOp === 'count' || activeOp === 'uniqueEntities'
      ? 'count'
      : activeMetricSchema?.kind ?? 'count';

  const metricLabel =
    activeOp === 'count'
      ? 'Row Count'
      : activeOp === 'uniqueEntities'
      ? `Unique ${dataset.entityIdCol || 'Records'}`
      : `${activeOp === 'avg' ? 'Avg ' : ''}${activeMetricCol}`;

  const kpis = useMemo(
    () => computeUniversalKpis(dataset, filteredRows),
    [dataset, filteredRows]
  );

  const primaryKind =
    dataset.columns.find((c) => c.name === dataset.primaryMetricCol)?.kind ?? 'number';

  const hasDate = Boolean(dataset.primaryDateCol);
  const focalDimension = hasDate
    ? granularity
    : dataset.primaryCategoryCol || dataset.columns[0]?.name || '';

  const stackCol =
    stackBySecondary && dataset.secondaryCategoryCol ? dataset.secondaryCategoryCol : null;

  const focalBuckets = useMemo(
    () =>
      focalDimension
        ? aggregateUniversal(
            dataset,
            filteredRows,
            focalDimension,
            activeMetricCol,
            activeOp,
            stackCol
          )
        : [],
    [dataset, filteredRows, focalDimension, activeMetricCol, activeOp, stackCol]
  );

  const stackKeys = useMemo(() => {
    if (!stackCol) return [];
    const set = new Set<string>();
    for (const b of focalBuckets) {
      for (const k of Object.keys(b.byStack)) set.add(k);
    }
    return Array.from(set).sort();
  }, [focalBuckets, stackCol]);

  const primaryCatBuckets = useMemo(
    () =>
      dataset.primaryCategoryCol
        ? aggregateUniversal(
            dataset,
            filteredRows,
            dataset.primaryCategoryCol,
            activeMetricCol,
            activeOp
          )
        : [],
    [dataset, filteredRows, dataset.primaryCategoryCol, activeMetricCol, activeOp]
  );

  const secondaryCatBuckets = useMemo(
    () =>
      dataset.secondaryCategoryCol
        ? aggregateUniversal(
            dataset,
            filteredRows,
            dataset.secondaryCategoryCol,
            activeMetricCol,
            activeOp
          )
        : [],
    [dataset, filteredRows, dataset.secondaryCategoryCol, activeMetricCol, activeOp]
  );

  const weekdayBuckets = useMemo(
    () =>
      hasDate
        ? aggregateUniversal(
            dataset,
            filteredRows,
            '__date_weekday',
            activeMetricCol,
            activeOp
          )
        : [],
    [dataset, filteredRows, hasDate, activeMetricCol, activeOp]
  );

  const toggleCategoryFilter = (colName: string, value: string) => {
    const current = filters.categoryFilters[colName] || [];
    const active = current.includes(value);
    onUpdateFilters({
      ...filters,
      categoryFilters: {
        ...filters.categoryFilters,
        [colName]: active ? [] : [value],
      },
    });
  };

  const toggleDateFilter = (isoDate: string) => {
    const isExact = filters.dateStart === isoDate && filters.dateEnd === isoDate;
    onUpdateFilters({
      ...filters,
      dateStart: isExact ? dataset.minDate : isoDate,
      dateEnd: isExact ? dataset.maxDate : isoDate,
    });
  };

  return (
    <div className="space-y-6">
      {/* Compact Dropzone Banner for Arbitrary CSV Upload */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onUploadFile(file);
        }}
        className={`flex flex-col gap-3 rounded-xl border border-dashed px-5 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
        }`}
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Active Dataset: {dataset.name}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Drop any CSV file here to auto-detect columns, metrics, dates, and categories.
          </div>
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 self-start rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:self-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0">
          <Upload className="h-3.5 w-3.5" />
          <span>Choose CSV File</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUploadFile(file);
                e.target.value = '';
              }
            }}
          />
        </label>
      </div>

      {/* Adaptive KPI Strip */}
      <section
        aria-label="Key dataset metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {dataset.primaryMetricCol && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              Total {dataset.primaryMetricCol}
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {formatColumnValue(kpis.primarySum, primaryKind)}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {kpis.dateSpanDays > 0
                ? `Across ${kpis.dateSpanDays} ${kpis.dateSpanDays === 1 ? 'day' : 'days'}`
                : `${kpis.rowCount} records`}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {dataset.entityIdCol ? `Unique ${dataset.entityIdCol}` : 'Total Records'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {formatColumnValue(
              dataset.entityIdCol ? kpis.uniqueEntities : kpis.rowCount,
              'count'
            )}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {dataset.entityIdCol && kpis.multiRowEntities > 0
              ? `${kpis.multiRowEntities} multi-row groups`
              : `${dataset.columns.length} detected columns`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Filtered Rows
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {formatColumnValue(kpis.rowCount, 'count')}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {dataset.entityIdCol && kpis.uniqueEntities > 0
              ? `${(kpis.rowCount / kpis.uniqueEntities).toFixed(2)} rows per ${dataset.entityIdCol}`
              : `${formatPercent(
                  dataset.rows.length > 0 ? kpis.rowCount / dataset.rows.length : 0
                )} of dataset`}
          </div>
        </div>

        {dataset.primaryMetricCol && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              {dataset.hasMultiRowEntities
                ? `Avg per ${dataset.entityIdCol}`
                : `Avg ${dataset.primaryMetricCol}`}
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {formatColumnValue(
                dataset.hasMultiRowEntities ? kpis.primaryAvgEntity : kpis.primaryAvgRow,
                primaryKind
              )}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Avg row {formatColumnValue(kpis.primaryAvgRow, primaryKind)}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {dataset.primaryCategoryCol ? `Top ${dataset.primaryCategoryCol}` : 'Dataset Fields'}
          </div>
          <div className="mt-2 truncate font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {kpis.topCategory ? kpis.topCategory.name : `${dataset.columns.length} columns`}
          </div>
          <div className="mt-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
            {kpis.topCategory
              ? `${formatPercent(kpis.topCategory.share)} · ${formatColumnValue(
                  kpis.topCategory.value,
                  dataset.primaryMetricCol ? primaryKind : 'count'
                )}`
              : 'Inspect schema'}
          </div>
        </div>
      </section>

      {/* Primary Focal Chart */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {hasDate
                ? `${metricLabel} Over Time`
                : `${metricLabel} by ${focalDimension || 'Category'}`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {focalBuckets.length} groups · Click any element to cross-filter
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Selector */}
            {numericCols.length > 0 && (
              <select
                aria-label="Select metric column"
                value={activeMetricCol}
                onChange={(e) => setSelectedMetricCol(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {numericCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="__count">Row Count</option>
              </select>
            )}

            {/* Aggregation Op */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  ...(activeMetricCol !== '__count'
                    ? [
                        { id: 'sum' as const, label: 'Sum' },
                        { id: 'avg' as const, label: 'Avg' },
                      ]
                    : []),
                  { id: 'count' as const, label: 'Rows' },
                  ...(dataset.entityIdCol
                    ? [{ id: 'uniqueEntities' as const, label: 'Unique' }]
                    : []),
                ]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOp(item.id)}
                  className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeOp === item.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {hasDate && (
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {(
                  [
                    { id: '__date_day', label: 'Day' },
                    { id: '__date_week', label: 'Week' },
                    { id: '__date_month', label: 'Month' },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGranularity(g.id)}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      granularity === g.id
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  { id: 'area', label: 'Area' },
                  { id: 'bar', label: 'Bar' },
                  { id: 'line', label: 'Line' },
                  { id: 'cumulative', label: 'Cumulative' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setTrendMode(mode.id)}
                  className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    trendMode === mode.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {trendMode === 'bar' && dataset.secondaryCategoryCol && activeOp !== 'avg' && (
              <button
                type="button"
                onClick={() => setStackBySecondary((v) => !v)}
                className={`h-9 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  stackBySecondary
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Stack {dataset.secondaryCategoryCol}
              </button>
            )}
          </div>
        </div>

        {trendMode === 'bar' && stackBySecondary && stackKeys.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            {stackKeys.slice(0, 8).map((sk, idx) => (
              <span key={sk} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-xs"
                  style={{ backgroundColor: getSeriesColor(sk, idx) }}
                />
                {sk}
              </span>
            ))}
          </div>
        )}

        <TrendChart
          data={focalBuckets}
          valueKind={valueKind}
          metricLabel={metricLabel}
          mode={trendMode}
          op={activeOp}
          stackKeys={stackKeys}
          selectedKey={
            hasDate && granularity === '__date_day' && filters.dateStart === filters.dateEnd
              ? filters.dateStart
              : null
          }
          onSelectBucket={(b) => {
            if (hasDate && granularity === '__date_day') {
              toggleDateFilter(b.key);
            } else if (!hasDate && dataset.primaryCategoryCol) {
              toggleCategoryFilter(dataset.primaryCategoryCol, b.key);
            }
          }}
        />
      </section>

      {/* Secondary Category Splits */}
      {(dataset.secondaryCategoryCol || dataset.primaryCategoryCol) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {dataset.secondaryCategoryCol && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    {dataset.secondaryCategoryCol} Mix
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Click any slice to filter dashboard
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('studio')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
                >
                  Chart Studio
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <DonutChart
                data={secondaryCatBuckets}
                valueKind={valueKind}
                metricLabel={metricLabel}
                selectedKey={
                  (filters.categoryFilters[dataset.secondaryCategoryCol] || []).length === 1
                    ? filters.categoryFilters[dataset.secondaryCategoryCol][0]
                    : null
                }
                onSelectBucket={(b) =>
                  toggleCategoryFilter(dataset.secondaryCategoryCol!, b.key)
                }
              />
            </section>
          )}

          {dataset.primaryCategoryCol && (
            <section
              className={`rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${
                dataset.secondaryCategoryCol ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    {dataset.primaryCategoryCol} Ranking
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Top groups by {metricLabel} · Click to isolate
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('dimensions')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
                >
                  All Dimensions
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <HorizontalBarChart
                data={primaryCatBuckets}
                valueKind={valueKind}
                maxItems={8}
                selectedKey={(filters.categoryFilters[dataset.primaryCategoryCol] || [])[0] || null}
                onSelectBucket={(b) =>
                  toggleCategoryFilter(dataset.primaryCategoryCol!, b.key)
                }
              />
            </section>
          )}
        </div>
      )}

      {/* Time Cadence Row (shown when CSV has a date column) */}
      {hasDate && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Day-of-Week Cadence
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {metricLabel} aggregated Monday through Sunday
              </p>
            </div>

            <HorizontalBarChart data={weekdayBuckets} valueKind={valueKind} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Daily Intensity Calendar
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Click any date cell to filter records to that day
              </p>
            </div>

            <CalendarHeatmap
              dataset={dataset}
              rows={filteredRows}
              metricCol={activeMetricCol}
              op={activeOp}
              valueKind={valueKind}
              selectedDate={
                filters.dateStart === filters.dateEnd ? filters.dateStart : null
              }
              onSelectDate={toggleDateFilter}
            />
          </section>
        </div>
      )}
    </div>
  );
}
