import { ColumnKind, DimensionBucket } from '../../types/dataset';
import { formatColumnValue, formatPercent } from '../../utils/csvEngine';
import { SERIES_PALETTE } from './chartColors';

interface HorizontalBarChartProps {
  data: DimensionBucket[];
  valueKind: ColumnKind | 'count';
  maxItems?: number;
  selectedKey?: string | null;
  onSelectBucket?: (bucket: DimensionBucket) => void;
  colorByRank?: boolean;
}

export function HorizontalBarChart({
  data,
  valueKind,
  maxItems = 12,
  selectedKey = null,
  onSelectBucket,
  colorByRank = false,
}: HorizontalBarChartProps) {
  const visible = data.slice(0, maxItems);
  const maxVal = Math.max(...visible.map((d) => Math.max(0, d.value)), 1);

  if (visible.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        No records available for this dimension.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((bucket, idx) => {
        const val = Math.max(0, bucket.value);
        const pctWidth = Math.max(2, (val / maxVal) * 100);
        const isSelected = selectedKey === bucket.key;
        const barColor = colorByRank
          ? SERIES_PALETTE[idx % SERIES_PALETTE.length]
          : isSelected
          ? '#1D4ED8'
          : '#2563EB';

        return (
          <button
            key={bucket.key}
            type="button"
            onClick={() => onSelectBucket?.(bucket)}
            className={`group block w-full rounded-md px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-600 ${
              isSelected
                ? 'bg-blue-50/80 dark:bg-blue-950/40'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="truncate text-sm font-medium text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white">
                  {bucket.label}
                </span>
                {bucket.subLabel && (
                  <span className="shrink-0 font-mono text-xs text-slate-400 dark:text-slate-500">
                    {bucket.subLabel}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-baseline gap-2.5 font-mono text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {formatPercent(bucket.shareValue)}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatColumnValue(bucket.value, valueKind)}
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-xs bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-xs transition-all duration-200"
                style={{
                  width: `${pctWidth}%`,
                  backgroundColor: barColor,
                  opacity: selectedKey && !isSelected ? 0.38 : 0.92,
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
