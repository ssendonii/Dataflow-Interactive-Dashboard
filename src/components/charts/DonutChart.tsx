import { useState } from 'react';
import { ColumnKind, DimensionBucket } from '../../types/dataset';
import { formatColumnValue, formatPercent } from '../../utils/csvEngine';
import { getSeriesColor } from './chartColors';

interface DonutChartProps {
  data: DimensionBucket[];
  valueKind: ColumnKind | 'count';
  metricLabel: string;
  selectedKey?: string | null;
  onSelectBucket?: (bucket: DimensionBucket) => void;
}

export function DonutChart({
  data,
  valueKind,
  metricLabel,
  selectedKey = null,
  onSelectBucket,
}: DonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const topBuckets = data.filter((d) => d.value > 0).slice(0, 8);
  const total = topBuckets.reduce((sum, d) => sum + d.value, 0);

  if (topBuckets.length === 0 || total <= 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
        No positive values available for donut breakdown.
      </div>
    );
  }

  const size = 216;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const slices = topBuckets.map((bucket, idx) => {
    const share = bucket.value / total;
    const dashLength = share * circumference;
    const offset = -cumulativeOffset;
    cumulativeOffset += dashLength;
    return {
      bucket,
      share,
      dashLength,
      offset,
      color: getSeriesColor(bucket.key, idx),
    };
  });

  const activeSlice =
    slices.find((s) => s.bucket.key === hoveredKey) ||
    slices.find((s) => s.bucket.key === selectedKey) ||
    null;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth={strokeWidth}
          />
          {slices.map((s) => {
            const isHovered = hoveredKey === s.bucket.key;
            const isSelected = selectedKey === s.bucket.key;
            const dimmed =
              (hoveredKey && !isHovered) ||
              (!hoveredKey && selectedKey && !isSelected);
            return (
              <circle
                key={s.bucket.key}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={isHovered || isSelected ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${Math.max(0, s.dashLength - 1.5)} ${circumference}`}
                strokeDashoffset={s.offset}
                className="cursor-pointer transition-all duration-150"
                style={{ opacity: dimmed ? 0.35 : 1 }}
                onMouseEnter={() => setHoveredKey(s.bucket.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => onSelectBucket?.(s.bucket)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="max-w-full truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {activeSlice ? activeSlice.bucket.label : metricLabel}
          </span>
          <span className="mt-0.5 font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
            {activeSlice
              ? formatColumnValue(activeSlice.bucket.value, valueKind, true)
              : formatColumnValue(total, valueKind, true)}
          </span>
          {activeSlice && (
            <span className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {formatPercent(activeSlice.share)}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
        {slices.map((s) => {
          const isSelected = selectedKey === s.bucket.key;
          const isHovered = hoveredKey === s.bucket.key;
          return (
            <button
              key={s.bucket.key}
              type="button"
              onMouseEnter={() => setHoveredKey(s.bucket.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => onSelectBucket?.(s.bucket)}
              className={`flex w-full items-center justify-between gap-3 px-2 py-2 text-left transition-colors duration-150 first:pt-1.5 last:pb-1.5 ${
                isSelected || isHovered
                  ? 'bg-slate-50 dark:bg-slate-800/60'
                  : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {s.bucket.label}
                </span>
              </div>
              <div className="flex shrink-0 items-baseline gap-3 font-mono text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {formatPercent(s.share)}
                </span>
                <span className="min-w-[68px] text-right font-semibold text-slate-900 dark:text-slate-100">
                  {formatColumnValue(s.bucket.value, valueKind)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
