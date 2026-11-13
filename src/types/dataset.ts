export type ColumnKind = 'currency' | 'number' | 'percent' | 'date' | 'category' | 'id';

export interface ColumnSchema {
  name: string;
  kind: ColumnKind;
  detectedKind: ColumnKind;
  nonNullCount: number;
  nullCount: number;
  uniqueCount: number;
  sampleValues: string[];
  minNumber?: number;
  maxNumber?: number;
  sumNumber?: number;
  avgNumber?: number;
  medianNumber?: number;
  minDate?: string;
  maxDate?: string;
  topValues?: { value: string; count: number }[];
}

export interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  numbers: Record<string, number | null>;
  dates: Record<string, string | null>; // normalized YYYY-MM-DD
}

export interface UniversalDataset {
  name: string;
  isDefaultSalesData: boolean;
  columns: ColumnSchema[];
  rows: ParsedRow[];
  primaryDateCol: string | null;
  primaryMetricCol: string | null; // numeric/currency column
  primaryCategoryCol: string | null;
  secondaryCategoryCol: string | null;
  entityIdCol: string | null; // e.g. Order Number if repeated IDs exist
  hasMultiRowEntities: boolean;
  minDate: string;
  maxDate: string;
}

export interface UniversalFilterState {
  dateStart: string;
  dateEnd: string;
  categoryFilters: Record<string, string[]>;
  searchQuery: string;
}

export type AggregationOp = 'sum' | 'avg' | 'count' | 'uniqueEntities';

export type ChartKind =
  | 'bar'
  | 'line'
  | 'area'
  | 'cumulative'
  | 'horizontalBar'
  | 'donut'
  | 'heatmap'
  | 'scatter'
  | 'calendar';

export type NavSection = 'overview' | 'studio' | 'dimensions' | 'ledger' | 'ai';

export interface DimensionBucket {
  key: string;
  label: string;
  subLabel?: string;
  value: number;
  sumPrimary: number;
  avgPrimary: number;
  count: number;
  uniqueEntities: number;
  shareValue: number;
  shareCount: number;
  byStack: Record<string, { sum: number; count: number; uniqueEntities: number }>;
}

export interface EntityGroup {
  entityId: string;
  date: string | null;
  rows: ParsedRow[];
  rowCount: number;
  primaryMetricTotal: number;
  categorySummary: Record<string, string[]>;
}

export interface AiChartRecommendation {
  title: string;
  rationale: string;
  chartKind: string;
  dimension: string;
  metric: string;
}

export interface AiAnalysisResponse {
  summary: string;
  keyFindings: string[];
  dataQualityNotes: string[];
  recommendedCharts: AiChartRecommendation[];
  modelUsed?: string;
}

export interface AiAskResponse {
  answer: string;
  supportingMetrics: string[];
  suggestedChart?: {
    title: string;
    chartKind: string;
    dimension: string;
    metric: string;
  } | null;
  modelUsed?: string;
}
