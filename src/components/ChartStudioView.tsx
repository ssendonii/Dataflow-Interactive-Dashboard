import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  AggregationOp,
  ChartKind,
  DimensionBucket,
  ParsedRow,
  UniversalDataset,
  UniversalFilterState,
} from '../types/dataset';
import {
  aggregateUniversal,
  buildScatterPoints,
  formatColumnValue,
  formatPercent,
} from '../utils/csvEngine';
import { CalendarHeatmap } from './charts/CalendarHeatmap';
import { getSeriesColor } from './charts/chartColors';
import { DonutChart } from './charts/DonutChart';
import { HeatmapMatrix } from './charts/HeatmapMatrix';
import { HorizontalBarChart } from './charts/HorizontalBarChart';
import { ScatterPlotChart } from './charts/ScatterPlotChart';
import { TrendChart } from './charts/TrendChart';

export interface StudioExternalConfig {
  chartKind: ChartKind;
  dimension: string;
  metricCol: string;
  op: AggregationOp;
  stackCol?: string | null;
}

interface ChartStudioViewProps {
  dataset: UniversalDataset;
  filteredRows: ParsedRow[];
  filters: UniversalFilterState;
  onUpdateFilters: (next: UniversalFilterState) => void;
  externalConfig?: StudioExternalConfig | null;
}

export function ChartStudioView({
  dataset,
  filteredRows,
  filters,
  onUpdateFilters,
  externalConfig,
}: ChartStudioViewProps) {
  const dimensionOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [];
    if (dataset.primaryDateCol) {
      opts.push(
        { id: '__date_day', label: `${dataset.primaryDateCol} (Daily)` },
        { id: '__date_week', label: `${dataset.primaryDateCol} (Weekly)` },
        { id: '__date_month', label: `${dataset.primaryDateCol} (Monthly)` },
        { id: '__date_weekday', label: `${dataset.primaryDateCol} (Weekday)` }
      );
    }
    for (const c of dataset.columns) {
      if (c.kind === 'category' || c.kind === 'id') {
        opts.push({ id: c.name, label: c.name });
      }
    }
    if (dataset.primaryMetricCol) {
      opts.push({
        id: '__metric_tier',
        label: `${dataset.primaryMetricCol} Tiers`,
      });
    }
    return opts;
  }, [dataset]);

  const categoryCols = useMemo(
    () => dataset.columns.filter((c) => c.kind === 'category' && c.uniqueCount >= 2),
    [dataset.columns]
  );

  const numericCols = useMemo(
    () =>
      dataset.columns.filter(
        (c) => c.kind === 'currency' || c.kind === 'number' || c.kind === 'percent'
      ),
    [dataset.columns]
  );

  const defaultDim =
    (dataset.primaryDateCol ? '__date_week' : null) ||
    dataset.primaryCategoryCol ||
    dimensionOptions[0]?.id ||
    '';

  const [chartKind, setChartKind] = useState<ChartKind>(
    dataset.primaryDateCol ? 'bar' : 'horizontalBar'
  );
  const [dimension, setDimension] = useState<string>(defaultDim);
  const [metricCol, setMetricCol] = useState<string>(
    dataset.primaryMetricCol || '__count'
  );
  const [op, setOp] = useState<AggregationOp>(
    dataset.primaryMetricCol ? 'sum' : 'count'
  );
  const [stackCol, setStackCol] = useState<string>(
    dataset.secondaryCategoryCol || ''
  );
  const [heatmapColDim, setHeatmapColDim] = useState<string>(
    dataset.secondaryCategoryCol || categoryCols[1]?.name || categoryCols[0]?.name || ''
  );

  // Sync defaults when a brand-new CSV is uploaded
  useEffect(() => {
    setDimension(defaultDim);
    setMetricCol(dataset.primaryMetricCol || '__count');
    setOp(dataset.primaryMetricCol ? 'sum' : 'count');
    setChartKind(dataset.primaryDateCol ? 'bar' : 'horizontalBar');
    setStackCol(dataset.secondaryCategoryCol || '');
    setHeatmapColDim(
      dataset.secondaryCategoryCol || categoryCols[1]?.name || categoryCols[0]?.name || ''
    );
  }, [dataset.name]);

  // Apply external configuration (e.g. from AI Analyst recommendation)
  useEffect(() => {
    if (!externalConfig) return;
    setChartKind(externalConfig.chartKind);
    if (externalConfig.dimension) setDimension(externalConfig.dimension);
    if (externalConfig.metricCol) setMetricCol(externalConfig.metricCol);
    setOp(externalConfig.op);
    if (externalConfig.stackCol !== undefined) {
      setStackCol(externalConfig.stackCol || '');
    }
  }, [externalConfig]);

  const activeMetricCol =
    metricCol === '__count' || numericCols.some((c) => c.name === metricCol)
      ? metricCol
      : '__count';
  const activeOp: AggregationOp = activeMetricCol === '__count' ? 'count' : op;
  const activeMetricSchema = dataset.columns.find((c) => c.name === activeMetricCol);
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

  const presets = useMemo(() => {
    const list: {
      id: string;
      title: string;
      description: string;
      config: StudioExternalConfig;
    }[] = [];

    if (dataset.primaryDateCol) {
      list.push({
        id: 'cumulative',
        title: `Cumulative ${dataset.primaryMetricCol || 'Rows'}`,
        description: 'Running total trajectory across the active timeline',
        config: {
          chartKind: 'cumulative',
          dimension: '__date_day',
          metricCol: dataset.primaryMetricCol || '__count',
          op: dataset.primaryMetricCol ? 'sum' : 'count',
        },
      });
    }
    if (dataset.primaryDateCol && dataset.secondaryCategoryCol) {
      list.push({
        id: 'weekly-stack',
        title: `Weekly ${dataset.secondaryCategoryCol} Stack`,
        description: `Weekly breakdown segmented by ${dataset.secondaryCategoryCol}`,
        config: {
          chartKind: 'bar',
          dimension: '__date_week',
          metricCol: dataset.primaryMetricCol || '__count',
          op: dataset.primaryMetricCol ? 'sum' : 'count',
          stackCol: dataset.secondaryCategoryCol,
        },
      });
    }
    if (dataset.primaryCategoryCol && dataset.secondaryCategoryCol) {
      list.push({
        id: 'cross-matrix',
        title: `${dataset.primaryCategoryCol} × ${dataset.secondaryCategoryCol}`,
        description: 'Cross-tabulated intensity matrix between two categories',
        config: {
          chartKind: 'heatmap',
          dimension: dataset.primaryCategoryCol,
          metricCol: dataset.primaryMetricCol || '__count',
          op: dataset.primaryMetricCol ? 'sum' : 'count',
        },
      });
    }
    if (dataset.primaryCategoryCol && dataset.primaryMetricCol) {
      list.push({
        id: 'scatter',
        title: `${dataset.primaryMetricCol} vs. Frequency`,
        description: 'Value distribution against volume per category group',
        config: {
          chartKind: 'scatter',
          dimension: dataset.primaryCategoryCol,
          metricCol: dataset.primaryMetricCol,
          op: 'sum',
        },
      });
    }
    if (dataset.primaryDateCol) {
      list.push({
        id: 'weekday-avg',
        title: 'Weekday Pattern',
        description: 'Performance comparison Monday through Sunday',
        config: {
          chartKind: 'bar',
          dimension: '__date_weekday',
          metricCol: dataset.primaryMetricCol || '__count',
          op: dataset.primaryMetricCol ? 'avg' : 'count',
        },
      });
    }
    if (dataset.primaryMetricCol) {
      list.push({
        id: 'tier-donut',
        title: `${dataset.primaryMetricCol} Tiers`,
        description: 'Share distribution across Low, Mid, and High brackets',
        config: {
          chartKind: 'donut',
          dimension: '__metric_tier',
          metricCol: dataset.primaryMetricCol,
          op: 'sum',
        },
      });
    }
    return list;
  }, [dataset]);

  const effectiveStackCol =
    chartKind === 'bar' && activeOp !== 'avg' && stackCol ? stackCol : null;

  const buckets = useMemo(
    () =>
      dimension
        ? aggregateUniversal(
            dataset,
            filteredRows,
            dimension,
            activeMetricCol,
            activeOp,
            effectiveStackCol
          )
        : [],
    [dataset, filteredRows, dimension, activeMetricCol, activeOp, effectiveStackCol]
  );

  const stackKeys = useMemo(() => {
    if (!effectiveStackCol) return [];
    const set = new Set<string>();
    for (const b of buckets) {
      for (const k of Object.keys(b.byStack)) set.add(k);
    }
    return Array.from(set).sort();
  }, [buckets, effectiveStackCol]);

  const scatterGroupCol =
    categoryCols.find((c) => c.name === dimension)?.name ||
    dataset.primaryCategoryCol ||
    categoryCols[0]?.name ||
    '';

  const scatterXCol =
    activeMetricCol !== '__count'
      ? activeMetricCol
      : dataset.primaryMetricCol || numericCols[0]?.name || '';

  const scatterYCol =
    numericCols.find((c) => c.name !== scatterXCol)?.name || 'count';

  const scatterPoints = useMemo(() => {
    if (!scatterGroupCol || !scatterXCol) return [];
    return buildScatterPoints(
      dataset,
      filteredRows,
      scatterGroupCol,
      scatterXCol,
      scatterYCol
    );
  }, [dataset, filteredRows, scatterGroupCol, scatterXCol, scatterYCol]);

  const heatmapRowCol =
    categoryCols.find((c) => c.name === dimension)?.name ||
    dataset.primaryCategoryCol ||
    categoryCols[0]?.name ||
    '';

  const handleBucketSelect = (bucket: DimensionBucket) => {
    if (dimension === '__date_day' && dataset.primaryDateCol) {
      const isExact =
        filters.dateStart === bucket.key && filters.dateEnd === bucket.key;
      onUpdateFilters({
        ...filters,
        dateStart: isExact ? dataset.minDate : bucket.key,
        dateEnd: isExact ? dataset.maxDate : bucket.key,
      });
    } else if (dataset.columns.some((c) => c.name === dimension && c.kind === 'category')) {
      const current = filters.categoryFilters[dimension] || [];
      const active = current.includes(bucket.key);
      onUpdateFilters({
        ...filters,
        categoryFilters: {
          ...filters.categoryFilters,
          [dimension]: active ? [] : [bucket.key],
        },
      });
    }
  };

  const exportPivotCsv = () => {
    const headers = ['Group', metricLabel, 'Share %', 'Row Count'];
    const lines = [
      headers.join(','),
      ...buckets.map((b) =>
        [
          `"${b.label.replace(/"/g, '""')}"`,
          b.value.toFixed(2),
          `${(b.shareValue * 100).toFixed(1)}%`,
          b.count,
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pivot-${dimension || 'summary'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {presets.length > 0 && (
        <section aria-label="Recommended chart presets">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Recommended Perspectives
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Auto-configured for {dataset.name}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setChartKind(p.config.chartKind);
                  setDimension(p.config.dimension);
                  setMetricCol(p.config.metricCol);
                  setOp(p.config.op);
                  setStackCol(p.config.stackCol || '');
                }}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {p.title}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {p.description}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Chart Builder */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="studio-chart-kind"
                className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Chart Type
              </label>
              <select
                id="studio-chart-kind"
                value={chartKind}
                onChange={(e) => setChartKind(e.target.value as ChartKind)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="bar">Vertical Bar</option>
                <option value="area">Area Chart</option>
                <option value="line">Line Chart</option>
                <option value="cumulative">Cumulative Curve</option>
                <option value="horizontalBar">Ranked Horizontal Bars</option>
                <option value="donut">Donut Breakdown</option>
                <option value="heatmap">Cross-Tab Heatmap</option>
                <option value="scatter">Scatter Plot</option>
                {dataset.primaryDateCol && (
                  <option value="calendar">Daily Calendar Grid</option>
                )}
              </select>
            </div>

            {chartKind !== 'calendar' && (
              <div>
                <label
                  htmlFor="studio-dimension"
                  className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  {chartKind === 'heatmap'
                    ? 'Row Dimension'
                    : chartKind === 'scatter'
                    ? 'Bubble Group'
                    : 'Group By (X-Axis)'}
                </label>
                <select
                  id="studio-dimension"
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value)}
                  className="h-10 max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {dimensionOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {chartKind === 'heatmap' && categoryCols.length > 0 && (
              <div>
                <label
                  htmlFor="studio-heatmap-col"
                  className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  Column Dimension
                </label>
                <select
                  id="studio-heatmap-col"
                  value={heatmapColDim}
                  onChange={(e) => setHeatmapColDim(e.target.value)}
                  className="h-10 max-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {categoryCols.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="studio-metric"
                className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Metric Column
              </label>
              <select
                id="studio-metric"
                value={activeMetricCol}
                onChange={(e) => setMetricCol(e.target.value)}
                className="h-10 max-w-[190px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {numericCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="__count">Row Count</option>
              </select>
            </div>

            {chartKind !== 'scatter' && activeMetricCol !== '__count' && (
              <div>
                <label
                  htmlFor="studio-op"
                  className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  Aggregation
                </label>
                <select
                  id="studio-op"
                  value={activeOp}
                  onChange={(e) => setOp(e.target.value as AggregationOp)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="count">Row Count</option>
                  {dataset.entityIdCol && (
                    <option value="uniqueEntities">
                      Unique {dataset.entityIdCol}
                    </option>
                  )}
                </select>
              </div>
            )}

            {chartKind === 'bar' && categoryCols.length > 0 && activeOp !== 'avg' && (
              <div>
                <label
                  htmlFor="studio-stack"
                  className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  Stack By
                </label>
                <select
                  id="studio-stack"
                  value={stackCol}
                  onChange={(e) => setStackCol(e.target.value)}
                  className="h-10 max-w-[170px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {categoryCols
                    .filter((c) => c.name !== dimension && c.uniqueCount <= 12)
                    .map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={exportPivotCsv}
            className="inline-flex h-10 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 lg:self-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export Pivot CSV
          </button>
        </div>

        {effectiveStackCol && stackKeys.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
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

        <div className="min-h-[310px]">
          {(chartKind === 'bar' ||
            chartKind === 'line' ||
            chartKind === 'area' ||
            chartKind === 'cumulative') && (
            <TrendChart
              data={buckets}
              valueKind={valueKind}
              metricLabel={metricLabel}
              mode={chartKind}
              op={activeOp}
              stackKeys={stackKeys}
              height={360}
              onSelectBucket={handleBucketSelect}
            />
          )}

          {chartKind === 'horizontalBar' && (
            <HorizontalBarChart
              data={buckets}
              valueKind={valueKind}
              maxItems={20}
              colorByRank
              onSelectBucket={handleBucketSelect}
            />
          )}

          {chartKind === 'donut' && (
            <DonutChart
              data={buckets}
              valueKind={valueKind}
              metricLabel={metricLabel}
              onSelectBucket={handleBucketSelect}
            />
          )}

          {chartKind === 'heatmap' && (
            <HeatmapMatrix
              dataset={dataset}
              rows={filteredRows}
              rowCol={heatmapRowCol}
              colCol={heatmapColDim}
              metricCol={activeMetricCol}
              op={activeOp}
              valueKind={valueKind}
              onSelectCell={(rv, cv) => {
                onUpdateFilters({
                  ...filters,
                  categoryFilters: {
                    ...filters.categoryFilters,
                    [heatmapRowCol]: [rv],
                    [heatmapColDim]: [cv],
                  },
                });
              }}
            />
          )}

          {chartKind === 'scatter' && (
            <ScatterPlotChart
              points={scatterPoints}
              xLabel={scatterXCol ? `Avg ${scatterXCol}` : 'Metric'}
              yLabel={scatterYCol === 'count' ? 'Row Frequency' : scatterYCol}
              xKind={
                dataset.columns.find((c) => c.name === scatterXCol)?.kind ?? 'number'
              }
              yKind={
                scatterYCol === 'count'
                  ? 'count'
                  : dataset.columns.find((c) => c.name === scatterYCol)?.kind ?? 'number'
              }
              height={370}
              selectedLabel={(filters.categoryFilters[scatterGroupCol] || [])[0] || null}
              onSelectLabel={(lbl) => {
                if (!scatterGroupCol) return;
                const active = (filters.categoryFilters[scatterGroupCol] || []).includes(lbl);
                onUpdateFilters({
                  ...filters,
                  categoryFilters: {
                    ...filters.categoryFilters,
                    [scatterGroupCol]: active ? [] : [lbl],
                  },
                });
              }}
            />
          )}

          {chartKind === 'calendar' && (
            <CalendarHeatmap
              dataset={dataset}
              rows={filteredRows}
              metricCol={activeMetricCol}
              op={activeOp}
              valueKind={valueKind}
              selectedDate={
                filters.dateStart === filters.dateEnd ? filters.dateStart : null
              }
              onSelectDate={(date) => {
                const isExact =
                  filters.dateStart === date && filters.dateEnd === date;
                onUpdateFilters({
                  ...filters,
                  dateStart: isExact ? dataset.minDate : date,
                  dateEnd: isExact ? dataset.maxDate : date,
                });
              }}
            />
          )}
        </div>
      </section>

      {/* Live Aggregated Pivot Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Aggregated Pivot Table
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {buckets.length} groups · Measuring {metricLabel}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
                <th className="py-3 pr-4 pl-6 font-medium text-slate-600 dark:text-slate-300">
                  Group
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  {metricLabel}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  Share
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  Rows
                </th>
                {dataset.entityIdCol && (
                  <th className="py-3 pr-6 pl-4 text-right font-medium text-slate-600 dark:text-slate-300">
                    Unique {dataset.entityIdCol}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {buckets.slice(0, 60).map((b) => (
                <tr key={b.key} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-4 pl-6 font-medium text-slate-900 dark:text-slate-100">
                    {b.label}
                    {b.subLabel ? (
                      <span className="ml-2 font-mono text-[11px] text-slate-400">
                        {b.subLabel}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {formatColumnValue(b.value, valueKind)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                    {formatPercent(b.shareValue)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                    {b.count}
                  </td>
                  {dataset.entityIdCol && (
                    <td className="py-2.5 pr-6 pl-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {b.uniqueEntities}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
