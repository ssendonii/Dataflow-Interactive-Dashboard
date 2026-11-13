import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Send, Sparkles } from 'lucide-react';
import {
  AiAnalysisResponse,
  AiAskResponse,
  ChartKind,
  ParsedRow,
  UniversalDataset,
} from '../types/dataset';
import { buildAiDatasetProfile } from '../utils/csvEngine';
import { ApiFetchError, safeFetchJson } from '../utils/safeFetch';
import { StudioExternalConfig } from './ChartStudioView';

interface AiAnalystViewProps {
  dataset: UniversalDataset;
  filteredRows: ParsedRow[];
  analysis: AiAnalysisResponse | null;
  onAnalysisChange: (res: AiAnalysisResponse | null) => void;
  onApplyChartConfig: (config: StudioExternalConfig) => void;
}

const VALID_CHART_KINDS: ChartKind[] = [
  'bar',
  'line',
  'area',
  'cumulative',
  'horizontalBar',
  'donut',
  'heatmap',
  'scatter',
  'calendar',
];

export function AiAnalystView({
  dataset,
  filteredRows,
  analysis,
  onAnalysisChange,
  onApplyChartConfig,
}: AiAnalystViewProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [qaHistory, setQaHistory] = useState<
    { question: string; response: AiAskResponse }[]
  >([]);

  const profile = useMemo(
    () => buildAiDatasetProfile(dataset, filteredRows),
    [dataset, filteredRows]
  );

  const quickQuestions = useMemo(() => {
    const prompts: string[] = [];
    if (dataset.primaryCategoryCol && dataset.primaryMetricCol) {
      prompts.push(
        `Which ${dataset.primaryCategoryCol} contributes the highest ${dataset.primaryMetricCol}, and how concentrated is the top tier?`
      );
    }
    if (dataset.secondaryCategoryCol) {
      prompts.push(
        `Compare performance across ${dataset.secondaryCategoryCol} segments.`
      );
    }
    if (dataset.primaryDateCol) {
      prompts.push(
        `What temporal trends or peak periods stand out across ${dataset.primaryDateCol}?`
      );
    }
    prompts.push('What anomalies, skew, or data quality issues should I inspect?');
    return prompts.slice(0, 3);
  }, [dataset]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const data = await safeFetchJson<AiAnalysisResponse>('/api/ai/analyze-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      onAnalysisChange(data);
    } catch (err) {
      const message =
        err instanceof ApiFetchError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to analyze CSV dataset.';
      setAnalyzeError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const submitQuestion = async (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed) return;
    setAsking(true);
    setAskError(null);
    try {
      const data = await safeFetchJson<AiAskResponse>('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          ...profile,
        }),
      });
      setQaHistory((prev) => [{ question: trimmed, response: data }, ...prev]);
      setQuestion('');
    } catch (err) {
      const message =
        err instanceof ApiFetchError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to answer question.';
      setAskError(message);
    } finally {
      setAsking(false);
    }
  };

  const handleAskSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuestion(question);
  };

  const mapRecommendedChart = (rec: {
    chartKind: string;
    dimension: string;
    metric: string;
  }): StudioExternalConfig => {
    const kind = VALID_CHART_KINDS.includes(rec.chartKind as ChartKind)
      ? (rec.chartKind as ChartKind)
      : 'bar';

    const metricCol =
      rec.metric === '__count' ||
      dataset.columns.some((c) => c.name === rec.metric)
        ? rec.metric
        : dataset.primaryMetricCol || '__count';

    const op =
      rec.metric === '__unique_entities'
        ? 'uniqueEntities'
        : metricCol === '__count'
        ? 'count'
        : 'sum';

    return {
      chartKind: kind,
      dimension: rec.dimension,
      metricCol,
      op,
    };
  };

  return (
    <div className="space-y-6">
      {/* Executive Analysis Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              AI Dataset Brief
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Generates executive insights and chart recommendations grounded in{' '}
              <span className="font-mono">{filteredRows.length}</span> filtered rows of{' '}
              {dataset.name}
            </p>
          </div>

          <button
            type="button"
            disabled={analyzing || filteredRows.length === 0}
            onClick={handleAnalyze}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {analyzing
              ? 'Analyzing Dataset...'
              : analysis
              ? 'Refresh Analysis'
              : 'Generate AI Brief'}
          </button>
        </div>

        {analyzeError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {analyzeError}
          </div>
        )}

        {analyzing && !analysis && (
          <div className="mt-6 space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        )}

        {analysis && (
          <div className="mt-6 space-y-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Executive Summary
                </h3>
                {analysis.modelUsed && (
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                    Model: {analysis.modelUsed}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {analysis.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Key Quantitative Findings
                </h3>
                <ul className="mt-2.5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {analysis.keyFindings.map((finding, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Data Quality & Distribution Notes
                </h3>
                <ul className="mt-2.5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {analysis.dataQualityNotes.map((note, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="font-mono text-xs text-slate-400">·</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {analysis.recommendedCharts.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Recommended Visualizations (Click to open in Chart Studio)
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {analysis.recommendedCharts.map((rec, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onApplyChartConfig(mapRecommendedChart(rec))}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left transition-colors hover:border-blue-500 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-500 dark:hover:bg-slate-800"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {rec.title}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {rec.rationale}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-blue-600 dark:text-blue-400">
                        <span>{rec.chartKind}</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Ask Questions About CSV */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          Ask About This Dataset
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Query metrics, distributions, outliers, or trends in natural language
        </p>

        <form onSubmit={handleAskSubmit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the uploaded CSV..."
            aria-label="Ask a question about the dataset"
            className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={asking || !question.trim() || filteredRows.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            {asking ? 'Thinking...' : 'Ask Analyst'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {quickQuestions.map((qp) => (
            <button
              key={qp}
              type="button"
              disabled={asking}
              onClick={() => submitQuestion(qp)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {qp}
            </button>
          ))}
        </div>

        {askError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {askError}
          </div>
        )}

        {qaHistory.length > 0 && (
          <div className="mt-6 space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800">
            {qaHistory.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {item.question}
                  </div>
                  {item.response.modelUsed && (
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">
                      {item.response.modelUsed}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {item.response.answer}
                </p>
                {item.response.supportingMetrics.length > 0 && (
                  <ul className="mt-2.5 space-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {item.response.supportingMetrics.map((m, mIdx) => (
                      <li key={mIdx}>· {m}</li>
                    ))}
                  </ul>
                )}
                {item.response.suggestedChart && (
                  <button
                    type="button"
                    onClick={() =>
                      onApplyChartConfig(
                        mapRecommendedChart(item.response.suggestedChart!)
                      )
                    }
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Open &ldquo;{item.response.suggestedChart.title}&rdquo; in Chart Studio
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
