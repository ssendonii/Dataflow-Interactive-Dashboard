import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Upload, X } from 'lucide-react';
import { AiAnalystView } from './components/AiAnalystView';
import { ChartStudioView, StudioExternalConfig } from './components/ChartStudioView';
import { DimensionsView } from './components/DimensionsView';
import { FilterBar } from './components/FilterBar';
import { LedgerView } from './components/LedgerView';
import { OverviewView } from './components/OverviewView';
import { RowDetailDrawer } from './components/RowDetailDrawer';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import {
  AiAnalysisResponse,
  ColumnKind,
  EntityGroup,
  NavSection,
  ParsedRow,
  UniversalDataset,
  UniversalFilterState,
} from './types/dataset';
import {
  buildUniversalDataset,
  DEFAULT_CSV_PATH,
  DEFAULT_DATASET_NAME,
  exportRowsToCsv,
  filterUniversalRows,
} from './utils/csvEngine';
import { generatePdfReport } from './utils/pdfExport';
import { safeFetchJson } from './utils/safeFetch';

const APP_VERSION_FALLBACK = '1.1.0';

function createInitialFilters(ds: UniversalDataset): UniversalFilterState {
  return {
    dateStart: ds.minDate,
    dateEnd: ds.maxDate,
    categoryFilters: {},
    searchQuery: '',
  };
}

export default function App() {
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [datasetName, setDatasetName] = useState<string>(DEFAULT_DATASET_NAME);
  const [kindOverrides, setKindOverrides] = useState<Record<string, ColumnKind>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>(APP_VERSION_FALLBACK);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(false);

  const [selectedEntity, setSelectedEntity] = useState<EntityGroup | null>(null);
  const [selectedRow, setSelectedRow] = useState<ParsedRow | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResponse | null>(null);
  const [studioExternalConfig, setStudioExternalConfig] =
    useState<StudioExternalConfig | null>(null);

  const [filters, setFilters] = useState<UniversalFilterState>({
    dateStart: '',
    dateEnd: '',
    categoryFilters: {},
    searchQuery: '',
  });

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4500);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Sync active version from backend /api/health
  useEffect(() => {
    safeFetchJson<{ ok: boolean; version?: string }>('/api/health')
      .then((res) => {
        if (res.version) setAppVersion(res.version);
      })
      .catch(() => {
        // Fallback version remains active if health check is unavailable during static preview
      });
  }, []);

  const loadDefaultCsv = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(DEFAULT_CSV_PATH);
      if (!response.ok) {
        throw new Error(`Unable to load sample CSV (HTTP ${response.status}).`);
      }
      const text = await response.text();
      const parsed = buildUniversalDataset(text, DEFAULT_DATASET_NAME);
      setRawCsvText(text);
      setDatasetName(DEFAULT_DATASET_NAME);
      setKindOverrides({});
      setFilters(createInitialFilters(parsed));
      setAiAnalysis(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load CSV data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefaultCsv();
  }, [loadDefaultCsv]);

  const dataset = useMemo<UniversalDataset | null>(() => {
    if (!rawCsvText) return null;
    try {
      return buildUniversalDataset(rawCsvText, datasetName, kindOverrides);
    } catch {
      return null;
    }
  }, [rawCsvText, datasetName, kindOverrides]);

  const filteredRows = useMemo(() => {
    if (!dataset) return [];
    return filterUniversalRows(dataset, filters);
  }, [dataset, filters]);

  const handleImportCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = buildUniversalDataset(text, file.name);
      setRawCsvText(text);
      setDatasetName(file.name);
      setKindOverrides({});
      setFilters(createInitialFilters(parsed));
      setAiAnalysis(null);
      setErrorMsg(null);
      showToast(
        `Loaded ${file.name} (${parsed.rows.length} rows, ${parsed.columns.length} columns)`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not parse uploaded CSV file.'
      );
    }
  };

  const handleOverrideColumnKind = (colName: string, kind: ColumnKind) => {
    setKindOverrides((prev) => ({ ...prev, [colName]: kind }));
    showToast(`Updated "${colName}" column type to ${kind}`);
  };

  const handleResetFilters = () => {
    if (!dataset) return;
    setFilters(createInitialFilters(dataset));
  };

  const handleExportCsv = () => {
    if (!dataset) return;
    const baseName = dataset.name.replace(/\.csv$/i, '');
    const outName = `${baseName}-filtered.csv`;
    exportRowsToCsv(dataset, filteredRows, outName);
    showToast(`Exported ${filteredRows.length} rows to ${outName}`);
  };

  const handleExportPdf = () => {
    if (!dataset) return;
    const filename = generatePdfReport({
      dataset,
      filteredRows,
      appVersion,
      aiAnalysis,
    });
    showToast(`Saved PDF report: ${filename}`);
  };

  const uniqueEntityCount = useMemo(() => {
    if (!dataset?.entityIdCol) return null;
    const set = new Set<string>();
    for (const r of filteredRows) {
      set.add(r.raw[dataset.entityIdCol] || String(r.rowIndex));
    }
    return set.size;
  }, [dataset, filteredRows]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        datasetName={dataset?.name || datasetName}
        rowCount={filteredRows.length}
        columnCount={dataset?.columns.length || 0}
        uniqueEntityCount={uniqueEntityCount}
        entityColName={dataset?.entityIdCol || null}
        minDate={dataset?.minDate || ''}
        maxDate={dataset?.maxDate || ''}
        isDefaultDataset={dataset?.isDefaultSalesData ?? true}
        onResetToDefault={loadDefaultCsv}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeSection={activeSection}
          appVersion={appVersion}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          onImportCsvFile={handleImportCsvFile}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6">
          {toastMsg && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {toastMsg}
              </span>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                className="rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  />
                ))}
              </div>
              <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            </div>
          ) : !dataset ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Upload a CSV File to Begin
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Drop any structured CSV dataset or restore the built-in retail sales dataset.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800 dark:bg-blue-600">
                  <Upload className="h-3.5 w-3.5" />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportCsvFile(f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={loadDefaultCsv}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Load Sample Sales Data
                </button>
              </div>
            </div>
          ) : (
            <>
              <FilterBar
                dataset={dataset}
                filters={filters}
                onChange={setFilters}
                onReset={handleResetFilters}
                filteredCount={filteredRows.length}
              />

              {filteredRows.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    No Records Match Your Active Filters
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Clear or widen your date range, category selection, or search query to inspect data.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800 dark:bg-blue-600"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Filters
                  </button>
                </div>
              ) : (
                <>
                  {activeSection === 'overview' && (
                    <OverviewView
                      dataset={dataset}
                      filteredRows={filteredRows}
                      filters={filters}
                      onUpdateFilters={setFilters}
                      onNavigate={setActiveSection}
                      onUploadFile={handleImportCsvFile}
                    />
                  )}

                  {activeSection === 'studio' && (
                    <ChartStudioView
                      dataset={dataset}
                      filteredRows={filteredRows}
                      filters={filters}
                      onUpdateFilters={setFilters}
                      externalConfig={studioExternalConfig}
                    />
                  )}

                  {activeSection === 'dimensions' && (
                    <DimensionsView
                      dataset={dataset}
                      filteredRows={filteredRows}
                      filters={filters}
                      onUpdateFilters={setFilters}
                      onOverrideColumnKind={handleOverrideColumnKind}
                    />
                  )}

                  {activeSection === 'ledger' && (
                    <LedgerView
                      dataset={dataset}
                      filteredRows={filteredRows}
                      onInspectEntity={(ent) => {
                        setSelectedRow(null);
                        setSelectedEntity(ent);
                      }}
                      onInspectRow={(row) => {
                        setSelectedEntity(null);
                        setSelectedRow(row);
                      }}
                    />
                  )}

                  {activeSection === 'ai' && (
                    <AiAnalystView
                      dataset={dataset}
                      filteredRows={filteredRows}
                      analysis={aiAnalysis}
                      onAnalysisChange={setAiAnalysis}
                      onApplyChartConfig={(cfg) => {
                        setStudioExternalConfig(cfg);
                        setActiveSection('studio');
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {dataset && (
        <RowDetailDrawer
          dataset={dataset}
          selectedEntity={selectedEntity}
          selectedRow={selectedRow}
          onClose={() => {
            setSelectedEntity(null);
            setSelectedRow(null);
          }}
          onFilterCategory={(colName, val) => {
            setFilters((prev) => ({
              ...prev,
              categoryFilters: {
                ...prev.categoryFilters,
                [colName]: [val],
              },
            }));
          }}
        />
      )}
    </div>
  );
}
