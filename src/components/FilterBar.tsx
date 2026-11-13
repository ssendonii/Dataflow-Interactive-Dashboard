import { useMemo } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { UniversalDataset, UniversalFilterState } from '../types/dataset';

interface FilterBarProps {
  dataset: UniversalDataset;
  filters: UniversalFilterState;
  onChange: (next: UniversalFilterState) => void;
  onReset: () => void;
  filteredCount: number;
}

export function FilterBar({
  dataset,
  filters,
  onChange,
  onReset,
  filteredCount,
}: FilterBarProps) {
  const categoryCols = useMemo(
    () => dataset.columns.filter((c) => c.kind === 'category' && c.uniqueCount >= 2),
    [dataset.columns]
  );

  // Pick a compact segmented column (2..6 unique values, prefer secondaryCategoryCol)
  const segmentedCol = useMemo(() => {
    const sec = categoryCols.find((c) => c.name === dataset.secondaryCategoryCol);
    if (sec && sec.uniqueCount <= 6) return sec;
    return categoryCols.find((c) => c.uniqueCount <= 6) || null;
  }, [categoryCols, dataset.secondaryCategoryCol]);

  // Pick up to 2 dropdown category columns excluding the segmented one
  const dropdownCols = useMemo(() => {
    return categoryCols
      .filter((c) => c.name !== segmentedCol?.name)
      .slice(0, 2);
  }, [categoryCols, segmentedCol]);

  const segmentedValues = useMemo(() => {
    if (!segmentedCol) return [];
    const vals = new Set<string>();
    for (const r of dataset.rows) {
      vals.add(r.raw[segmentedCol.name] || '(Empty)');
    }
    return Array.from(vals).sort();
  }, [dataset.rows, segmentedCol]);

  const dropdownOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of dropdownCols) {
      const vals = new Set<string>();
      for (const r of dataset.rows) {
        vals.add(r.raw[col.name] || '(Empty)');
      }
      map[col.name] = Array.from(vals).sort();
    }
    return map;
  }, [dataset.rows, dropdownCols]);

  const hasActiveFilters =
    (dataset.primaryDateCol &&
      (filters.dateStart !== dataset.minDate || filters.dateEnd !== dataset.maxDate)) ||
    Object.values(filters.categoryFilters).some((arr) => arr.length > 0) ||
    filters.searchQuery.trim() !== '';

  const toggleSegmentedValue = (colName: string, val: string) => {
    const current = filters.categoryFilters[colName] || [];
    const exists = current.includes(val);
    const next = exists ? current.filter((v) => v !== val) : [...current, val];
    onChange({
      ...filters,
      categoryFilters: { ...filters.categoryFilters, [colName]: next },
    });
  };

  return (
    <section
      aria-label="Global dataset filters"
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {segmentedCol && segmentedValues.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    categoryFilters: {
                      ...filters.categoryFilters,
                      [segmentedCol.name]: [],
                    },
                  })
                }
                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  (filters.categoryFilters[segmentedCol.name] || []).length === 0
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                All {segmentedCol.name}
              </button>
              {segmentedValues.map((val) => {
                const active = (filters.categoryFilters[segmentedCol.name] || []).includes(val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => toggleSegmentedValue(segmentedCol.name, val)}
                    className={`h-8 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-blue-700 shadow-xs dark:bg-blue-600 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          )}

          {dataset.primaryDateCol && dataset.minDate && dataset.maxDate && (
            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="filter-date-start">
                Start date
              </label>
              <input
                id="filter-date-start"
                type="date"
                value={filters.dateStart}
                min={dataset.minDate}
                max={filters.dateEnd || dataset.maxDate}
                onChange={(e) => onChange({ ...filters, dateStart: e.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span className="text-xs text-slate-400">–</span>
              <label className="sr-only" htmlFor="filter-date-end">
                End date
              </label>
              <input
                id="filter-date-end"
                type="date"
                value={filters.dateEnd}
                min={filters.dateStart || dataset.minDate}
                max={dataset.maxDate}
                onChange={(e) => onChange({ ...filters, dateEnd: e.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {dropdownCols.map((col) => {
            const selected = (filters.categoryFilters[col.name] || [])[0] || '';
            const opts = dropdownOptions[col.name] || [];
            return (
              <select
                key={col.name}
                aria-label={`Filter by ${col.name}`}
                value={selected}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    categoryFilters: {
                      ...filters.categoryFilters,
                      [col.name]: e.target.value ? [e.target.value] : [],
                    },
                  })
                }
                className="h-10 max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">
                  All {col.name} ({opts.length})
                </option>
                {opts.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            );
          })}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filters.searchQuery}
              onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
              placeholder="Search all columns..."
              aria-label="Search CSV records"
              className="h-10 w-44 rounded-lg border border-slate-200 bg-white pr-3 pl-8 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:w-52 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset ({filteredCount}/{dataset.rows.length})
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
