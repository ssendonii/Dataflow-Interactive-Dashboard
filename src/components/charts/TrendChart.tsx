import { useEffect, useMemo, useRef, useState } from 'react';
import { AggregationOp, ColumnKind, DimensionBucket } from '../../types/dataset';
import { formatColumnValue } from '../../utils/csvEngine';
import { getSeriesColor } from './chartColors';

export type TrendMode = 'area' | 'line' | 'bar' | 'cumulative';

interface TrendChartProps {
  data: DimensionBucket[];
  valueKind: ColumnKind | 'count';
  metricLabel: string;
  mode: TrendMode;
  op?: AggregationOp;
  stackKeys?: string[];
  height?: number;
  selectedKey?: string | null;
  onSelectBucket?: (bucket: DimensionBucket) => void;
}

export function TrendChart({
  data,
  valueKind,
  metricLabel,
  mode,
  op = 'sum',
  stackKeys = [],
  height = 310,
  selectedKey = null,
  onSelectBucket,
}: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(el);
    setWidth(Math.floor(el.clientWidth) || 720);
    return () => observer.disconnect();
  }, []);

  const padLeft = 62;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 38;
  const plotW = Math.max(120, width - padLeft - padRight);
  const plotH = Math.max(100, height - padTop - padBottom);

  const series = useMemo(() => {
    let running = 0;
    return data.map((bucket) => {
      running += bucket.value;
      return {
        bucket,
        value: mode === 'cumulative' ? running : bucket.value,
        rawValue: bucket.value,
      };
    });
  }, [data, mode]);

  const maxValue = useMemo(() => {
    const vals = series.map((s) => s.value);
    const m = Math.max(...vals, 0);
    return m <= 0 ? 10 : m * 1.12;
  }, [series]);

  const yTicks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, idx) => {
      const ratio = idx / count;
      const value = maxValue * (1 - ratio);
      const y = padTop + ratio * plotH;
      return { value, y };
    });
  }, [maxValue, plotH]);

  const xLabelStep = useMemo(() => {
    if (series.length <= 8) return 1;
    const maxLabels = Math.max(4, Math.floor(plotW / 80));
    return Math.ceil(series.length / maxLabels);
  }, [series.length, plotW]);

  if (data.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ height }}
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
      >
        No data matches the current filters.
      </div>
    );
  }

  const slotWidth = plotW / Math.max(1, series.length);
  const barWidth = Math.max(4, Math.min(40, slotWidth * 0.64));

  const getX = (idx: number) => {
    if (mode === 'bar') return padLeft + idx * slotWidth + slotWidth / 2;
    if (series.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (series.length - 1)) * plotW;
  };

  const getY = (val: number) =>
    padTop + plotH - (Math.max(0, val) / maxValue) * plotH;

  const linePath = series
    .map(
      (pt, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.value).toFixed(1)}`
    )
    .join(' ');

  const areaPath =
    series.length > 0
      ? `${linePath} L ${getX(series.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const hoveredItem = hoverIndex !== null ? series[hoverIndex] : null;
  const canStack = mode === 'bar' && op !== 'avg' && stackKeys.length > 0;

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg
        width={width}
        height={height}
        className="block overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={tick.y}
              y2={tick.y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1}
              strokeDasharray={idx === yTicks.length - 1 ? undefined : '2 3'}
            />
            <text
              x={padLeft - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[11px]"
            >
              {formatColumnValue(tick.value, valueKind, true)}
            </text>
          </g>
        ))}

        {(mode === 'area' || mode === 'cumulative') && (
          <>
            <defs>
              <linearGradient id="universal-trend-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#universal-trend-grad)" />
          </>
        )}

        {mode !== 'bar' && (
          <path
            d={linePath}
            fill="none"
            stroke="#2563EB"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {mode === 'bar' &&
          series.map((pt, idx) => {
            const cx = getX(idx);
            const x = cx - barWidth / 2;
            const isHovered = hoverIndex === idx;
            const isSelected = selectedKey === pt.bucket.key;
            const dimOthers =
              (selectedKey && !isSelected) || (hoverIndex !== null && !isHovered);

            if (canStack) {
              let currentTopY = padTop + plotH;
              return (
                <g
                  key={pt.bucket.key}
                  className="cursor-pointer transition-opacity duration-150"
                  style={{ opacity: dimOthers ? 0.45 : 1 }}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onClick={() => onSelectBucket?.(pt.bucket)}
                >
                  {stackKeys.map((sk, skIdx) => {
                    const stackEntry = pt.bucket.byStack[sk];
                    const sVal = stackEntry
                      ? op === 'count'
                        ? stackEntry.count
                        : op === 'uniqueEntities'
                        ? stackEntry.uniqueEntities
                        : stackEntry.sum
                      : 0;
                    const segH = (Math.max(0, sVal) / maxValue) * plotH;
                    currentTopY -= segH;
                    return (
                      <rect
                        key={sk}
                        x={x}
                        y={currentTopY}
                        width={barWidth}
                        height={Math.max(0, segH)}
                        fill={getSeriesColor(sk, skIdx)}
                        rx={1}
                      />
                    );
                  })}
                </g>
              );
            }

            const y = getY(pt.value);
            const barH = Math.max(1, padTop + plotH - y);
            return (
              <rect
                key={pt.bucket.key}
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={3}
                fill={isSelected ? '#1D4ED8' : '#2563EB'}
                className="cursor-pointer transition-opacity duration-150"
                style={{ opacity: dimOthers ? 0.42 : isHovered || isSelected ? 1 : 0.88 }}
                onMouseEnter={() => setHoverIndex(idx)}
                onClick={() => onSelectBucket?.(pt.bucket)}
              />
            );
          })}

        {mode !== 'bar' && hoverIndex !== null && hoveredItem && (
          <line
            x1={getX(hoverIndex)}
            x2={getX(hoverIndex)}
            y1={padTop}
            y2={padTop + plotH}
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {mode !== 'bar' &&
          series.map((pt, idx) => {
            const cx = getX(idx);
            const cy = getY(pt.value);
            const isHovered = hoverIndex === idx;
            const isSelected = selectedKey === pt.bucket.key;
            const showPoint = series.length <= 24 || isHovered || isSelected;
            return (
              <g key={pt.bucket.key}>
                {showPoint && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered || isSelected ? 4.5 : 2.5}
                    fill={isHovered || isSelected ? '#1D4ED8' : '#2563EB'}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    className="dark:stroke-slate-900"
                  />
                )}
                <rect
                  x={cx - Math.max(8, slotWidth / 2)}
                  y={padTop}
                  width={Math.max(16, slotWidth)}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(idx)}
                  onClick={() => onSelectBucket?.(pt.bucket)}
                />
              </g>
            );
          })}

        {series.map((pt, idx) => {
          const isLast = idx === series.length - 1;
          const show = idx % xLabelStep === 0 || (isLast && series.length % xLabelStep > 2);
          if (!show) return null;
          const shortLbl =
            pt.bucket.label.length > 14
              ? `${pt.bucket.label.slice(0, 12)}…`
              : pt.bucket.label;
          return (
            <text
              key={pt.bucket.key}
              x={getX(idx)}
              y={height - 12}
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[11px]"
            >
              {shortLbl}
            </text>
          );
        })}
      </svg>

      {hoverIndex !== null && hoveredItem && (
        <div
          className="pointer-events-none absolute top-2 z-20 min-w-[190px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left:
              getX(hoverIndex) > width * 0.62
                ? Math.max(8, getX(hoverIndex) - 208)
                : Math.min(width - 200, getX(hoverIndex) + 12),
          }}
        >
          <div className="border-b border-slate-100 pb-1.5 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
            {hoveredItem.bucket.label}
            {hoveredItem.bucket.subLabel ? ` · ${hoveredItem.bucket.subLabel}` : ''}
          </div>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">
                {mode === 'cumulative' ? `Cumulative ${metricLabel}` : metricLabel}
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatColumnValue(hoveredItem.value, valueKind)}
              </span>
            </div>
            {mode === 'cumulative' && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Period Value</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {formatColumnValue(hoveredItem.rawValue, valueKind)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Rows</span>
              <span className="font-mono">{hoveredItem.bucket.count}</span>
            </div>
            {canStack && (
              <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                {stackKeys.slice(0, 6).map((sk, idx) => {
                  const st = hoveredItem.bucket.byStack[sk];
                  if (!st) return null;
                  const val =
                    op === 'count'
                      ? st.count
                      : op === 'uniqueEntities'
                      ? st.uniqueEntities
                      : st.sum;
                  if (val === 0) return null;
                  return (
                    <div
                      key={sk}
                      className="flex items-center justify-between gap-3 text-[11px]"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <span
                          className="h-2 w-2 shrink-0 rounded-xs"
                          style={{ backgroundColor: getSeriesColor(sk, idx) }}
                        />
                        <span className="truncate">{sk}</span>
                      </span>
                      <span className="shrink-0 font-mono text-slate-900 dark:text-slate-100">
                        {formatColumnValue(val, valueKind)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
