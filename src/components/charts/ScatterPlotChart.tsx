import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnKind } from '../../types/dataset';
import { formatColumnValue, formatPercent, ScatterPoint } from '../../utils/csvEngine';
import { SERIES_PALETTE } from './chartColors';

interface ScatterPlotChartProps {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xKind: ColumnKind | 'count';
  yKind: ColumnKind | 'count';
  height?: number;
  selectedLabel?: string | null;
  onSelectLabel?: (label: string) => void;
}

export function ScatterPlotChart({
  points,
  xLabel,
  yLabel,
  xKind,
  yKind,
  height = 330,
  selectedLabel = null,
  onSelectLabel,
}: ScatterPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(680);
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);

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
    setWidth(Math.floor(el.clientWidth) || 680);
    return () => observer.disconnect();
  }, []);

  const padLeft = 54;
  const padRight = 28;
  const padTop = 24;
  const padBottom = 42;
  const plotW = Math.max(160, width - padLeft - padRight);
  const plotH = Math.max(140, height - padTop - padBottom);

  const bounds = useMemo(() => {
    if (points.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 20, maxSize: 1, avgX: 50, avgY: 10 };
    }
    const xs = points.map((p) => p.xValue);
    const ys = points.map((p) => p.yValue);
    const sizes = points.map((p) => p.sizeValue);
    const minXRaw = Math.min(...xs);
    const maxXRaw = Math.max(...xs);
    const minYRaw = Math.min(...ys);
    const maxYRaw = Math.max(...ys);

    const xPad = Math.max((maxXRaw - minXRaw) * 0.12, 1);
    const yPad = Math.max((maxYRaw - minYRaw) * 0.15, 1);

    return {
      minX: minXRaw >= 0 ? Math.max(0, minXRaw - xPad) : minXRaw - xPad,
      maxX: maxXRaw + xPad,
      minY: minYRaw >= 0 ? Math.max(0, minYRaw - yPad) : minYRaw - yPad,
      maxY: maxYRaw + yPad,
      maxSize: Math.max(...sizes, 1),
      avgX: xs.reduce((a, b) => a + b, 0) / xs.length,
      avgY: ys.reduce((a, b) => a + b, 0) / ys.length,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ height }}
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
      >
        Numeric and categorical columns are required to render the scatter plot.
      </div>
    );
  }

  const getX = (x: number) =>
    padLeft + ((x - bounds.minX) / Math.max(1e-6, bounds.maxX - bounds.minX)) * plotW;

  const getY = (y: number) =>
    padTop + plotH - ((y - bounds.minY) / Math.max(1e-6, bounds.maxY - bounds.minY)) * plotH;

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg
        width={width}
        height={height}
        className="block overflow-visible"
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const val = bounds.minY + ((bounds.maxY - bounds.minY) * i) / 4;
          const y = getY(val);
          return (
            <g key={`y-${i}`}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeDasharray={i === 0 ? undefined : '2 3'}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 font-mono text-[11px]"
              >
                {formatColumnValue(val, yKind, true)}
              </text>
            </g>
          );
        })}

        {Array.from({ length: 6 }, (_, i) => {
          const val = bounds.minX + ((bounds.maxX - bounds.minX) * i) / 5;
          const x = getX(val);
          return (
            <g key={`x-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={padTop}
                y2={padTop + plotH}
                className="stroke-slate-100 dark:stroke-slate-800/70"
              />
              <text
                x={x}
                y={height - 14}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 font-mono text-[11px]"
              >
                {formatColumnValue(val, xKind, true)}
              </text>
            </g>
          );
        })}

        <line
          x1={getX(bounds.avgX)}
          x2={getX(bounds.avgX)}
          y1={padTop}
          y2={padTop + plotH}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeDasharray="4 4"
        />
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={getY(bounds.avgY)}
          y2={getY(bounds.avgY)}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeDasharray="4 4"
        />

        <text
          x={padLeft + plotW / 2}
          y={height - 1}
          textAnchor="middle"
          className="fill-slate-400 dark:fill-slate-500 text-[11px]"
        >
          {xLabel}
        </text>
        <text
          x={14}
          y={padTop + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${padTop + plotH / 2})`}
          className="fill-slate-400 dark:fill-slate-500 text-[11px]"
        >
          {yLabel}
        </text>

        {points.map((pt, idx) => {
          const cx = getX(pt.xValue);
          const cy = getY(pt.yValue);
          const r = 7 + Math.sqrt(Math.max(0, pt.sizeValue) / bounds.maxSize) * 16;
          const color = SERIES_PALETTE[idx % SERIES_PALETTE.length];
          const isHovered = hovered?.label === pt.label;
          const isSelected = selectedLabel === pt.label;
          const dimmed =
            (hovered && !isHovered) ||
            (!hovered && selectedLabel && !isSelected);

          return (
            <g
              key={pt.label}
              className="cursor-pointer transition-opacity duration-150"
              style={{ opacity: dimmed ? 0.35 : 0.9 }}
              onMouseEnter={() => setHovered(pt)}
              onClick={() => onSelectLabel?.(pt.label)}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                fillOpacity={0.28}
                stroke={color}
                strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
              />
              <circle cx={cx} cy={cy} r={3} fill={color} />
              {(isHovered || isSelected || points.length <= 14) && (
                <text
                  x={cx}
                  y={cy - r - 5}
                  textAnchor="middle"
                  className="pointer-events-none fill-slate-700 dark:fill-slate-300 text-[10px] font-medium"
                >
                  {pt.label.length > 20 ? `${pt.label.slice(0, 18)}…` : pt.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-20 min-w-[204px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left:
              getX(hovered.xValue) > width * 0.6
                ? Math.max(8, getX(hovered.xValue) - 220)
                : Math.min(width - 214, getX(hovered.xValue) + 16),
          }}
        >
          <div className="border-b border-slate-100 pb-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
            {hovered.label}
          </div>
          <div className="mt-1.5 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between gap-4">
              <span className="font-sans text-slate-500 dark:text-slate-400">{xLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatColumnValue(hovered.xValue, xKind)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-sans text-slate-500 dark:text-slate-400">{yLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatColumnValue(hovered.yValue, yKind)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-sans text-slate-500 dark:text-slate-400">Rows Share</span>
              <span className="text-slate-700 dark:text-slate-300">
                {hovered.count} ({formatPercent(hovered.shareCount)})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
