import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { EntityGroup, ParsedRow, UniversalDataset } from '../types/dataset';
import { formatColumnValue, formatFullDate, groupRowsByEntity } from '../utils/csvEngine';

interface LedgerViewProps {
  dataset: UniversalDataset;
  filteredRows: ParsedRow[];
  onInspectEntity: (entity: EntityGroup) => void;
  onInspectRow: (row: ParsedRow) => void;
}

export function LedgerView({
  dataset,
  filteredRows,
  onInspectEntity,
  onInspectRow,
}: LedgerViewProps) {
  const canGroupEntities = Boolean(dataset.entityIdCol && dataset.hasMultiRowEntities);
  const [viewMode, setViewMode] = useState<'entities' | 'rows'>(
    canGroupEntities ? 'entities' : 'rows'
  );
  const [onlyMultiRow, setOnlyMultiRow] = useState(false);
  const [rowSortCol, setRowSortCol] = useState<string>(
    dataset.primaryDateCol || dataset.columns[0]?.name || ''
  );
  const [rowSortDir, setRowSortDir] = useState<'asc' | 'desc'>('desc');
  const [entitySortKey, setEntitySortKey] = useState<
    'entityId' | 'date' | 'rowCount' | 'primaryMetricTotal'
  >('date');
  const [entitySortDir, setEntitySortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const activeMode = canGroupEntities ? viewMode : 'rows';
  const grouped = useMemo(
    () => (canGroupEntities ? groupRowsByEntity(dataset, filteredRows) : []),
    [canGroupEntities, dataset, filteredRows]
  );

  const sortedEntities = useMemo(() => {
    const base = onlyMultiRow ? grouped.filter((g) => g.rowCount > 1) : grouped;
    const copy = [...base];
    copy.sort((a, b) => {
      let va: string | number = a[entitySortKey] ?? '';
      let vb: string | number = b[entitySortKey] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return entitySortDir === 'asc' ? va - vb : vb - va;
      }
      return entitySortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return copy;
  }, [grouped, onlyMultiRow, entitySortKey, entitySortDir]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const colSchema = dataset.columns.find((c) => c.name === rowSortCol);
    copy.sort((a, b) => {
      if (!colSchema) return 0;
      if (
        colSchema.kind === 'currency' ||
        colSchema.kind === 'number' ||
        colSchema.kind === 'percent'
      ) {
        const na = a.numbers[colSchema.name] ?? Number.NEGATIVE_INFINITY;
        const nb = b.numbers[colSchema.name] ?? Number.NEGATIVE_INFINITY;
        return rowSortDir === 'asc' ? na - nb : nb - na;
      }
      if (colSchema.kind === 'date') {
        const da = a.dates[colSchema.name] || '';
        const db = b.dates[colSchema.name] || '';
        return rowSortDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
      }
      const sa = a.raw[colSchema.name] || '';
      const sb = b.raw[colSchema.name] || '';
      return rowSortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return copy;
  }, [filteredRows, dataset.columns, rowSortCol, rowSortDir]);

  const totalCount =
    activeMode === 'entities' ? sortedEntities.length : sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;

  const pMetricKind =
    dataset.columns.find((c) => c.name === dataset.primaryMetricCol)?.kind ?? 'number';

  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return dir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600 dark:text-blue-400" />
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            CSV Data Ledger
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Click any row to inspect full record details
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeMode === 'entities' && (
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setOnlyMultiRow((v) => !v);
              }}
              className={`h-9 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                onlyMultiRow
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Multi-Row Only
            </button>
          )}

          {canGroupEntities && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setViewMode('entities');
                }}
                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeMode === 'entities'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Grouped ({grouped.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setViewMode('rows');
                }}
                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeMode === 'rows'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                All Rows ({filteredRows.length})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {activeMode === 'entities' ? (
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
                <th className="py-3 pr-4 pl-6 font-medium text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    onClick={() => {
                      setEntitySortKey('entityId');
                      setEntitySortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                    }}
                    className="inline-flex items-center gap-1.5"
                  >
                    {dataset.entityIdCol}
                    <SortIcon
                      active={entitySortKey === 'entityId'}
                      dir={entitySortDir}
                    />
                  </button>
                </th>
                {dataset.primaryDateCol && (
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                    <button
                      type="button"
                      onClick={() => {
                        setEntitySortKey('date');
                        setEntitySortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      }}
                      className="inline-flex items-center gap-1.5"
                    >
                      {dataset.primaryDateCol}
                      <SortIcon active={entitySortKey === 'date'} dir={entitySortDir} />
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {dataset.primaryCategoryCol || 'Items'}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    onClick={() => {
                      setEntitySortKey('rowCount');
                      setEntitySortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                    }}
                    className="inline-flex items-center justify-end gap-1.5"
                  >
                    Rows
                    <SortIcon
                      active={entitySortKey === 'rowCount'}
                      dir={entitySortDir}
                    />
                  </button>
                </th>
                {dataset.secondaryCategoryCol && (
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                    {dataset.secondaryCategoryCol}
                  </th>
                )}
                {dataset.primaryMetricCol && (
                  <th className="py-3 pr-6 pl-4 text-right font-medium text-slate-600 dark:text-slate-300">
                    <button
                      type="button"
                      onClick={() => {
                        setEntitySortKey('primaryMetricTotal');
                        setEntitySortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      }}
                      className="inline-flex items-center justify-end gap-1.5"
                    >
                      Total {dataset.primaryMetricCol}
                      <SortIcon
                        active={entitySortKey === 'primaryMetricTotal'}
                        dir={entitySortDir}
                      />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedEntities.slice(startIdx, startIdx + pageSize).map((ent) => {
                const primaryVals = dataset.primaryCategoryCol
                  ? ent.categorySummary[dataset.primaryCategoryCol] || []
                  : [];
                const secVals = dataset.secondaryCategoryCol
                  ? ent.categorySummary[dataset.secondaryCategoryCol] || []
                  : [];

                return (
                  <tr
                    key={ent.entityId}
                    onClick={() => onInspectEntity(ent)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 pr-4 pl-6 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {ent.entityId}
                    </td>
                    {dataset.primaryDateCol && (
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {ent.date ? formatFullDate(ent.date) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {primaryVals.join(' · ') || `${ent.rowCount} records`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {ent.rowCount}
                    </td>
                    {dataset.secondaryCategoryCol && (
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {secVals.join(' + ') || '—'}
                      </td>
                    )}
                    {dataset.primaryMetricCol && (
                      <td className="py-3 pr-6 pl-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatColumnValue(ent.primaryMetricTotal, pMetricKind)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
                {dataset.columns.map((col, idx) => {
                  const isNumeric =
                    col.kind === 'currency' ||
                    col.kind === 'number' ||
                    col.kind === 'percent';
                  return (
                    <th
                      key={col.name}
                      className={`py-3 font-medium text-slate-600 dark:text-slate-300 ${
                        idx === 0 ? 'pr-4 pl-6' : idx === dataset.columns.length - 1 ? 'pr-6 pl-4' : 'px-4'
                      } ${isNumeric ? 'text-right' : 'text-left'}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPage(1);
                          if (rowSortCol === col.name) {
                            setRowSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setRowSortCol(col.name);
                            setRowSortDir(isNumeric || col.kind === 'date' ? 'desc' : 'asc');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                      >
                        {col.name}
                        <SortIcon active={rowSortCol === col.name} dir={rowSortDir} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedRows.slice(startIdx, startIdx + pageSize).map((row) => (
                <tr
                  key={row.rowIndex}
                  onClick={() => onInspectRow(row)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  {dataset.columns.map((col, idx) => {
                    const isNumeric =
                      col.kind === 'currency' ||
                      col.kind === 'number' ||
                      col.kind === 'percent';
                    return (
                      <td
                        key={col.name}
                        className={`py-3 ${
                          idx === 0 ? 'pr-4 pl-6' : idx === dataset.columns.length - 1 ? 'pr-6 pl-4' : 'px-4'
                        } ${
                          isNumeric || col.kind === 'date' || col.kind === 'id'
                            ? 'font-mono'
                            : ''
                        } ${isNumeric ? 'text-right font-semibold' : ''} text-slate-800 dark:text-slate-200 whitespace-nowrap`}
                      >
                        {row.raw[col.name] || '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-mono">
            Showing {totalCount === 0 ? 0 : startIdx + 1}–
            {Math.min(startIdx + pageSize, totalCount)} of {totalCount}
          </span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={200}>Show 200</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 font-mono text-xs text-slate-700 dark:text-slate-300">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
