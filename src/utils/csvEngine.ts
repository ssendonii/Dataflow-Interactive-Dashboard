import {
  AggregationOp,
  ColumnKind,
  ColumnSchema,
  DimensionBucket,
  EntityGroup,
  ParsedRow,
  UniversalDataset,
  UniversalFilterState,
} from '../types/dataset';

export const DEFAULT_CSV_PATH = '/assets/aistudio/Sales_data_-_Sheet1_5e94d700.csv';
export const DEFAULT_DATASET_NAME = 'Sales_data_-_Sheet1_5e94d700.csv';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONDAY_FIRST_ORDER = [1, 2, 3, 4, 5, 6, 0];

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] || '';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const delim of candidates) {
    const count = firstLine.split(delim).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

export function parseCsvMatrix(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '').trim();
  if (!text) return [];
  const delim = detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) {
    rows.push(row);
  }
  return rows;
}

export function parseNumericCandidate(raw: string): {
  valid: boolean;
  value: number;
  hasCurrency: boolean;
  hasPercent: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, value: 0, hasCurrency: false, hasPercent: false };
  }
  const hasCurrency = /[$€£¥]/.test(trimmed);
  const hasPercent = /%$/.test(trimmed);

  // Reject things that look like dates or IDs with hyphens like TT-1001 or 2025-08-15
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed) || /[a-zA-Z]/.test(trimmed.replace(/[$€£¥%,.\s]/g, ''))) {
    return { valid: false, value: 0, hasCurrency: false, hasPercent: false };
  }

  let normalized = trimmed.replace(/[$€£¥%\s,]/g, '');
  // Handle accounting negatives like ($120.50)
  if (/^\(.*\)$/.test(normalized)) {
    normalized = `-${normalized.slice(1, -1)}`;
  }

  if (!/^[-+]?\d*\.?\d+$/.test(normalized)) {
    return { valid: false, value: 0, hasCurrency: false, hasPercent: false };
  }
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) {
    return { valid: false, value: 0, hasCurrency: false, hasPercent: false };
  }
  return { valid: true, value: num, hasCurrency, hasPercent };
}

export function parseDateCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /^\d+$/.test(trimmed)) return null;

  // YYYY-MM-DD or YYYY/MM/DD (with optional timestamp)
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const usMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s.*)?$/);
  if (usMatch) {
    const a = Number(usMatch[1]);
    const b = Number(usMatch[2]);
    const y = Number(usMatch[3]);
    if (y >= 1900 && y <= 2100) {
      // Assume MM/DD/YYYY unless first > 12 (then DD/MM/YYYY)
      const m = a > 12 ? b : a;
      const d = a > 12 ? a : b;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  // Named month strings like "Aug 15, 2025" or "15 Aug 2025"
  if (/[a-zA-Z]{3}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      if (y >= 1900 && y <= 2100) {
        return `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

export function parseLocalCalendarDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y || 2025, (m || 1) - 1, d || 1);
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatShortDate(isoDate: string): string {
  const d = parseLocalCalendarDate(isoDate);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatFullDate(isoDate: string): string {
  const d = parseLocalCalendarDate(isoDate);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function getMondayISO(isoDate: string): string {
  const local = parseLocalCalendarDate(isoDate);
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return formatISODate(
    new Date(local.getFullYear(), local.getMonth(), local.getDate() + diff)
  );
}

function inferColumnKind(
  header: string,
  values: string[]
): ColumnKind {
  const nonEmpty = values.filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return 'category';

  let numericCount = 0;
  let currencyCount = 0;
  let percentCount = 0;
  let dateCount = 0;

  for (const v of nonEmpty) {
    const num = parseNumericCandidate(v);
    if (num.valid) {
      numericCount++;
      if (num.hasCurrency) currencyCount++;
      if (num.hasPercent) percentCount++;
    } else if (parseDateCandidate(v) !== null) {
      dateCount++;
    }
  }

  const ratioNum = numericCount / nonEmpty.length;
  const ratioDate = dateCount / nonEmpty.length;
  const lowerH = header.toLowerCase();

  if (ratioDate >= 0.8) {
    return 'date';
  }
  if (ratioNum >= 0.85) {
    if (percentCount / numericCount >= 0.5 || lowerH.includes('rate') || lowerH.includes('pct') || lowerH.includes('%')) {
      return percentCount > 0 ? 'percent' : 'number';
    }
    if (
      currencyCount / numericCount >= 0.5 ||
      /price|revenue|amount|cost|total|sales|salary|budget|spend|profit|margin|income|fee/.test(lowerH)
    ) {
      return currencyCount > 0 || /price|revenue|cost|salary|budget|spend|profit/.test(lowerH)
        ? 'currency'
        : 'number';
    }
    return 'number';
  }

  const uniqueCount = new Set(nonEmpty).size;
  const uniqueRatio = uniqueCount / nonEmpty.length;

  if (
    (/order|id$|_id|sku|invoice|ticket|code|uuid|account|email|customer/.test(lowerH) &&
      uniqueRatio >= 0.45) ||
    (uniqueCount > 35 && uniqueRatio >= 0.8)
  ) {
    return 'id';
  }

  return 'category';
}

export function buildUniversalDataset(
  rawText: string,
  datasetName: string,
  kindOverrides?: Record<string, ColumnKind>
): UniversalDataset {
  const matrix = parseCsvMatrix(rawText);
  if (matrix.length < 2) {
    throw new Error('The CSV file must contain a header row and at least one data row.');
  }

  const rawHeaders = matrix[0];
  const seenHeaders = new Map<string, number>();
  const headers = rawHeaders.map((h, idx) => {
    const base = h || `Column ${idx + 1}`;
    const count = seenHeaders.get(base) || 0;
    seenHeaders.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  const dataRows = matrix.slice(1);
  const columns: ColumnSchema[] = headers.map((header, colIdx) => {
    const values = dataRows.map((r) => (r[colIdx] ?? '').trim());
    const detectedKind = inferColumnKind(header, values);
    const kind = kindOverrides?.[header] || detectedKind;

    const nonEmpty = values.filter((v) => v.length > 0);
    const valueCounts = new Map<string, number>();
    for (const v of nonEmpty) {
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    }

    const topValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));

    const schema: ColumnSchema = {
      name: header,
      kind,
      detectedKind,
      nonNullCount: nonEmpty.length,
      nullCount: values.length - nonEmpty.length,
      uniqueCount: valueCounts.size,
      sampleValues: nonEmpty.slice(0, 5),
      topValues,
    };

    if (kind === 'currency' || kind === 'number' || kind === 'percent') {
      const nums = nonEmpty
        .map((v) => parseNumericCandidate(v))
        .filter((n) => n.valid)
        .map((n) => n.value)
        .sort((a, b) => a - b);
      if (nums.length > 0) {
        const sum = nums.reduce((a, b) => a + b, 0);
        const mid = Math.floor(nums.length / 2);
        const median =
          nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
        schema.minNumber = nums[0];
        schema.maxNumber = nums[nums.length - 1];
        schema.sumNumber = sum;
        schema.avgNumber = sum / nums.length;
        schema.medianNumber = median;
      }
    }

    if (kind === 'date') {
      const parsedDates = nonEmpty
        .map((v) => parseDateCandidate(v))
        .filter((d): d is string => d !== null)
        .sort();
      if (parsedDates.length > 0) {
        schema.minDate = parsedDates[0];
        schema.maxDate = parsedDates[parsedDates.length - 1];
      }
    }

    return schema;
  });

  const rows: ParsedRow[] = dataRows.map((rawRow, idx) => {
    const raw: Record<string, string> = {};
    const numbers: Record<string, number | null> = {};
    const dates: Record<string, string | null> = {};

    columns.forEach((col, colIdx) => {
      const val = (rawRow[colIdx] ?? '').trim();
      raw[col.name] = val;
      if (col.kind === 'currency' || col.kind === 'number' || col.kind === 'percent') {
        const parsed = parseNumericCandidate(val);
        numbers[col.name] = parsed.valid ? parsed.value : null;
      } else {
        numbers[col.name] = null;
      }
      if (col.kind === 'date') {
        dates[col.name] = parseDateCandidate(val);
      } else {
        dates[col.name] = null;
      }
    });

    return { rowIndex: idx + 1, raw, numbers, dates };
  });

  // Choose primary columns smartly
  const dateCols = columns.filter((c) => c.kind === 'date' && c.minDate && c.maxDate);
  const primaryDateCol = dateCols[0]?.name ?? null;

  const metricCols = columns.filter(
    (c) => (c.kind === 'currency' || c.kind === 'number' || c.kind === 'percent') && c.sumNumber !== undefined
  );
  const preferredMetric = metricCols.find((c) =>
    /revenue|sales|price|amount|total|profit|value|spend|cost/i.test(c.name)
  );
  const primaryMetricCol = (preferredMetric || metricCols[0])?.name ?? null;

  const categoryCols = columns
    .filter((c) => c.kind === 'category' && c.uniqueCount >= 2)
    .sort((a, b) => {
      // Prefer moderate cardinality (3..30) over 100+ or 2
      const score = (c: ColumnSchema) => {
        if (c.uniqueCount >= 3 && c.uniqueCount <= 25) return 3;
        if (c.uniqueCount >= 2 && c.uniqueCount <= 60) return 2;
        return 1;
      };
      return score(b) - score(a) || b.uniqueCount - a.uniqueCount;
    });

  const primaryCategoryCol = categoryCols[0]?.name ?? null;
  const secondaryCategoryCol =
    categoryCols.find(
      (c) => c.name !== primaryCategoryCol && c.uniqueCount <= 12
    )?.name ??
    categoryCols[1]?.name ??
    null;

  const idCols = columns.filter((c) => c.kind === 'id');
  const multiRowIdCol = idCols.find(
    (c) => c.uniqueCount > 1 && c.uniqueCount < rows.length
  );
  const entityIdCol = (multiRowIdCol || idCols[0])?.name ?? null;
  const hasMultiRowEntities = Boolean(
    entityIdCol &&
      (columns.find((c) => c.name === entityIdCol)?.uniqueCount ?? rows.length) < rows.length
  );

  const primaryDateSchema = columns.find((c) => c.name === primaryDateCol);
  const minDate = primaryDateSchema?.minDate || '';
  const maxDate = primaryDateSchema?.maxDate || '';

  return {
    name: datasetName,
    isDefaultSalesData: datasetName === DEFAULT_DATASET_NAME,
    columns,
    rows,
    primaryDateCol,
    primaryMetricCol,
    primaryCategoryCol,
    secondaryCategoryCol,
    entityIdCol,
    hasMultiRowEntities,
    minDate,
    maxDate,
  };
}

export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactNumber(value: number, isCurrency = false): string {
  const abs = Math.abs(value);
  const prefix = isCurrency ? '$' : '';
  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${prefix}${(value / 1_000).toFixed(1)}k`;
  if (isCurrency) return formatCurrency(value, 0);
  return Number.isInteger(value)
    ? new Intl.NumberFormat('en-US').format(value)
    : value.toFixed(1);
}

export function formatColumnValue(
  value: number,
  kind: ColumnKind | 'count',
  compact = false
): string {
  if (kind === 'count') {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  }
  if (kind === 'currency') {
    return compact ? formatCompactNumber(value, true) : formatCurrency(value, 2);
  }
  if (kind === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  if (compact) return formatCompactNumber(value, false);
  return Number.isInteger(value)
    ? new Intl.NumberFormat('en-US').format(value)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(ratio: number, decimals = 1): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

export function filterUniversalRows(
  dataset: UniversalDataset,
  filters: UniversalFilterState
): ParsedRow[] {
  const q = filters.searchQuery.trim().toLowerCase();
  const dateCol = dataset.primaryDateCol;
  const activeCatEntries = Object.entries(filters.categoryFilters).filter(
    ([, vals]) => vals.length > 0
  );

  return dataset.rows.filter((row) => {
    if (dateCol) {
      const d = row.dates[dateCol];
      if (filters.dateStart && d && d < filters.dateStart) return false;
      if (filters.dateEnd && d && d > filters.dateEnd) return false;
    }

    for (const [colName, allowed] of activeCatEntries) {
      const val = row.raw[colName] || '(Empty)';
      if (!allowed.includes(val)) return false;
    }

    if (q) {
      const matched = Object.values(row.raw).some((v) =>
        v.toLowerCase().includes(q)
      );
      if (!matched) return false;
    }
    return true;
  });
}

export function groupRowsByEntity(
  dataset: UniversalDataset,
  rows: ParsedRow[]
): EntityGroup[] {
  const idCol = dataset.entityIdCol;
  if (!idCol) return [];
  const dateCol = dataset.primaryDateCol;
  const metricCol = dataset.primaryMetricCol;

  const map = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const id = row.raw[idCol] || `Row-${row.rowIndex}`;
    const arr = map.get(id);
    if (arr) arr.push(row);
    else map.set(id, [row]);
  }

  const groups: EntityGroup[] = [];
  const catCols = dataset.columns.filter((c) => c.kind === 'category').slice(0, 3);

  for (const [entityId, groupRows] of map.entries()) {
    const primaryMetricTotal = metricCol
      ? groupRows.reduce((s, r) => s + (r.numbers[metricCol] ?? 0), 0)
      : groupRows.length;
    const categorySummary: Record<string, string[]> = {};
    for (const col of catCols) {
      categorySummary[col.name] = Array.from(
        new Set(groupRows.map((r) => r.raw[col.name]).filter(Boolean))
      );
    }
    groups.push({
      entityId,
      date: dateCol ? groupRows[0].dates[dateCol] : null,
      rows: groupRows,
      rowCount: groupRows.length,
      primaryMetricTotal,
      categorySummary,
    });
  }

  return groups.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
    return b.entityId.localeCompare(a.entityId);
  });
}

export interface MetricStats {
  rowCount: number;
  uniqueEntities: number;
  multiRowEntities: number;
  primarySum: number;
  primaryAvgRow: number;
  primaryAvgEntity: number;
  dateSpanDays: number;
  topCategory: { name: string; value: number; share: number } | null;
}

export function computeUniversalKpis(
  dataset: UniversalDataset,
  rows: ParsedRow[]
): MetricStats {
  const metricCol = dataset.primaryMetricCol;
  const dateCol = dataset.primaryDateCol;
  const catCol = dataset.primaryCategoryCol;
  const idCol = dataset.entityIdCol;

  const rowCount = rows.length;
  let primarySum = 0;
  let numericCount = 0;

  const entitySet = new Set<string>();
  const entityCounts = new Map<string, number>();
  const catSums = new Map<string, number>();
  let minD = '';
  let maxD = '';

  for (const r of rows) {
    const val = metricCol ? r.numbers[metricCol] : null;
    if (val !== null && val !== undefined) {
      primarySum += val;
      numericCount++;
    }
    const weight = val !== null && val !== undefined ? val : 1;

    if (idCol) {
      const id = r.raw[idCol] || `Row-${r.rowIndex}`;
      entitySet.add(id);
      entityCounts.set(id, (entityCounts.get(id) || 0) + 1);
    }

    if (catCol) {
      const cat = r.raw[catCol] || '(Empty)';
      catSums.set(cat, (catSums.get(cat) || 0) + weight);
    }

    if (dateCol) {
      const d = r.dates[dateCol];
      if (d) {
        if (!minD || d < minD) minD = d;
        if (!maxD || d > maxD) maxD = d;
      }
    }
  }

  const uniqueEntities = idCol ? entitySet.size : rowCount;
  const multiRowEntities = idCol
    ? Array.from(entityCounts.values()).filter((c) => c > 1).length
    : 0;

  let topCategory: MetricStats['topCategory'] = null;
  const totalWeight = metricCol ? primarySum : rowCount;
  for (const [name, value] of catSums.entries()) {
    if (!topCategory || value > topCategory.value) {
      topCategory = {
        name,
        value,
        share: totalWeight > 0 ? value / totalWeight : 0,
      };
    }
  }

  let dateSpanDays = 0;
  if (minD && maxD) {
    const t1 = parseLocalCalendarDate(minD).getTime();
    const t2 = parseLocalCalendarDate(maxD).getTime();
    dateSpanDays = Math.max(1, Math.round((t2 - t1) / 86_400_000) + 1);
  }

  return {
    rowCount,
    uniqueEntities,
    multiRowEntities,
    primarySum,
    primaryAvgRow: numericCount > 0 ? primarySum / numericCount : 0,
    primaryAvgEntity: uniqueEntities > 0 ? primarySum / uniqueEntities : 0,
    dateSpanDays,
    topCategory,
  };
}

export function getMetricTierLabel(
  value: number,
  minVal: number,
  maxVal: number,
  isCurrency: boolean
): { label: string; order: number } {
  // Friendly retail brackets if range looks like $50-$200 currency
  if (isCurrency && minVal >= 20 && maxVal <= 500) {
    if (value < 75) return { label: 'Under $75', order: 0 };
    if (value < 100) return { label: '$75–$99', order: 1 };
    return { label: '$100+', order: 2 };
  }
  const span = maxVal - minVal;
  if (span <= 0) return { label: 'All Values', order: 0 };
  const t1 = minVal + span / 3;
  const t2 = minVal + (2 * span) / 3;
  const fmt = (n: number) => formatCompactNumber(n, isCurrency);
  if (value <= t1) return { label: `Low (${fmt(minVal)}–${fmt(t1)})`, order: 0 };
  if (value <= t2) return { label: `Mid (${fmt(t1)}–${fmt(t2)})`, order: 1 };
  return { label: `High (${fmt(t2)}–${fmt(maxVal)})`, order: 2 };
}

export function aggregateUniversal(
  dataset: UniversalDataset,
  rows: ParsedRow[],
  dimension: string, // column name or '__date_day' | '__date_week' | '__date_month' | '__date_weekday' | '__metric_tier'
  metricCol: string, // column name or '__count'
  op: AggregationOp,
  stackCol?: string | null
): DimensionBucket[] {
  const dateCol = dataset.primaryDateCol;
  const idCol = dataset.entityIdCol;
  const pMetricCol = dataset.primaryMetricCol;
  const pMetricSchema = dataset.columns.find((c) => c.name === pMetricCol);
  const minVal = pMetricSchema?.minNumber ?? 0;
  const maxVal = pMetricSchema?.maxNumber ?? 0;
  const isCurrency = pMetricSchema?.kind === 'currency';

  interface Draft {
    key: string;
    label: string;
    subLabel?: string;
    sortOrder?: number;
    sumVal: number;
    numCount: number;
    sumPrimary: number;
    count: number;
    entitySet: Set<string>;
    byStack: Record<
      string,
      { sum: number; count: number; entitySet: Set<string> }
    >;
  }

  const map = new Map<string, Draft>();

  for (const r of rows) {
    let key = '';
    let label = '';
    let subLabel: string | undefined;
    let sortOrder: number | undefined;

    if (
      (dimension === '__date_day' ||
        dimension === '__date_week' ||
        dimension === '__date_month' ||
        dimension === '__date_weekday') &&
      dateCol
    ) {
      const iso = r.dates[dateCol];
      if (!iso) continue;
      const local = parseLocalCalendarDate(iso);
      if (dimension === '__date_day') {
        key = iso;
        label = formatShortDate(iso);
        subLabel = WEEKDAY_NAMES[local.getDay()];
      } else if (dimension === '__date_week') {
        const wk = getMondayISO(iso);
        key = wk;
        label = `Wk of ${formatShortDate(wk)}`;
      } else if (dimension === '__date_month') {
        key = iso.slice(0, 7);
        label = `${MONTH_NAMES[local.getMonth()]} ${local.getFullYear()}`;
      } else {
        const wd = local.getDay();
        key = String(wd);
        label = WEEKDAY_NAMES[wd];
        sortOrder = MONDAY_FIRST_ORDER.indexOf(wd);
      }
    } else if (dimension === '__metric_tier' && pMetricCol) {
      const val = r.numbers[pMetricCol];
      if (val === null) continue;
      const tier = getMetricTierLabel(val, minVal, maxVal, isCurrency);
      key = tier.label;
      label = tier.label;
      sortOrder = tier.order;
    } else {
      const rawVal = r.raw[dimension] || '(Empty)';
      key = rawVal;
      label = rawVal;
    }

    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        key,
        label,
        subLabel,
        sortOrder,
        sumVal: 0,
        numCount: 0,
        sumPrimary: 0,
        count: 0,
        entitySet: new Set(),
        byStack: {},
      };
      map.set(key, bucket);
    }

    const rowNum = metricCol === '__count' ? 1 : r.numbers[metricCol];
    if (rowNum !== null && rowNum !== undefined) {
      bucket.sumVal += rowNum;
      bucket.numCount += 1;
    }
    const pNum = pMetricCol ? r.numbers[pMetricCol] : null;
    if (pNum !== null && pNum !== undefined) {
      bucket.sumPrimary += pNum;
    }
    bucket.count += 1;

    const entityId = idCol ? r.raw[idCol] || `Row-${r.rowIndex}` : `Row-${r.rowIndex}`;
    bucket.entitySet.add(entityId);

    if (stackCol) {
      const sKey = r.raw[stackCol] || '(Empty)';
      if (!bucket.byStack[sKey]) {
        bucket.byStack[sKey] = { sum: 0, count: 0, entitySet: new Set() };
      }
      bucket.byStack[sKey].sum += rowNum ?? 0;
      bucket.byStack[sKey].count += 1;
      bucket.byStack[sKey].entitySet.add(entityId);
    }
  }

  const rawBuckets = Array.from(map.values()).map((b) => {
    const uniqueEntities = b.entitySet.size;
    let value = b.count;
    if (op === 'count') value = b.count;
    else if (op === 'uniqueEntities') value = uniqueEntities;
    else if (op === 'avg') {
      if (metricCol === '__count') value = b.count;
      else value = b.numCount > 0 ? b.sumVal / b.numCount : 0;
    } else {
      // sum
      value = metricCol === '__count' ? b.count : b.sumVal;
    }

    const byStack: DimensionBucket['byStack'] = {};
    for (const [sk, sv] of Object.entries(b.byStack)) {
      byStack[sk] = {
        sum: sv.sum,
        count: sv.count,
        uniqueEntities: sv.entitySet.size,
      };
    }

    return {
      key: b.key,
      label: b.label,
      subLabel: b.subLabel,
      sortOrder: b.sortOrder,
      value,
      sumPrimary: b.sumPrimary,
      avgPrimary: b.count > 0 ? b.sumPrimary / b.count : 0,
      count: b.count,
      uniqueEntities,
      byStack,
    };
  });

  const totalValue = rawBuckets.reduce((s, b) => s + Math.max(0, b.value), 0);
  const totalCount = rawBuckets.reduce((s, b) => s + b.count, 0);

  const finalized: DimensionBucket[] = rawBuckets.map((b) => ({
    key: b.key,
    label: b.label,
    subLabel: b.subLabel,
    value: b.value,
    sumPrimary: b.sumPrimary,
    avgPrimary: b.avgPrimary,
    count: b.count,
    uniqueEntities: b.uniqueEntities,
    shareValue: totalValue > 0 ? Math.max(0, b.value) / totalValue : 0,
    shareCount: totalCount > 0 ? b.count / totalCount : 0,
    byStack: b.byStack,
  }));

  if (
    dimension === '__date_day' ||
    dimension === '__date_week' ||
    dimension === '__date_month'
  ) {
    finalized.sort((a, b) => a.key.localeCompare(b.key));
  } else if (dimension === '__date_weekday' || dimension === '__metric_tier') {
    const orderLookup = new Map(rawBuckets.map((b) => [b.key, b.sortOrder ?? 0]));
    finalized.sort((a, b) => (orderLookup.get(a.key) ?? 0) - (orderLookup.get(b.key) ?? 0));
  } else {
    finalized.sort((a, b) => b.value - a.value);
  }

  return finalized;
}

export interface CalendarCell {
  date: string;
  shortLabel: string;
  weekdayIndex: number;
  weekIndex: number;
  value: number;
  count: number;
  uniqueEntities: number;
}

export function buildUniversalCalendar(
  dataset: UniversalDataset,
  rows: ParsedRow[],
  metricCol: string,
  op: AggregationOp
): CalendarCell[] {
  const dateCol = dataset.primaryDateCol;
  if (!dateCol || !dataset.minDate || !dataset.maxDate) return [];

  const idCol = dataset.entityIdCol;
  const byDate = new Map<
    string,
    { sum: number; count: number; entities: Set<string> }
  >();

  for (const r of rows) {
    const iso = r.dates[dateCol];
    if (!iso) continue;
    const entry = byDate.get(iso) || { sum: 0, count: 0, entities: new Set() };
    const v = metricCol === '__count' ? 1 : r.numbers[metricCol] ?? 0;
    entry.sum += v;
    entry.count += 1;
    entry.entities.add(idCol ? r.raw[idCol] || String(r.rowIndex) : String(r.rowIndex));
    byDate.set(iso, entry);
  }

  const start = parseLocalCalendarDate(dataset.minDate);
  const end = parseLocalCalendarDate(dataset.maxDate);
  const startDay = start.getDay();
  const mondayDiff = startDay === 0 ? -6 : 1 - startDay;
  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + mondayDiff
  );

  const cells: CalendarCell[] = [];
  let offset = 0;

  while (cursor <= end || cursor.getDay() !== 1) {
    const iso = formatISODate(cursor);
    if (iso >= dataset.minDate && iso <= dataset.maxDate) {
      const stats = byDate.get(iso);
      const count = stats?.count ?? 0;
      const entities = stats?.entities.size ?? 0;
      const sum = stats?.sum ?? 0;
      const val =
        op === 'count'
          ? count
          : op === 'uniqueEntities'
          ? entities
          : op === 'avg'
          ? count > 0
            ? sum / count
            : 0
          : sum;

      cells.push({
        date: iso,
        shortLabel: formatShortDate(iso),
        weekdayIndex: cursor.getDay() === 0 ? 6 : cursor.getDay() - 1,
        weekIndex: Math.floor(offset / 7),
        value: val,
        count,
        uniqueEntities: entities,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    offset++;
    if (offset > 400) break;
  }

  return cells;
}

export interface ScatterPoint {
  label: string;
  xValue: number;
  yValue: number;
  sizeValue: number;
  count: number;
  shareCount: number;
}

export function buildScatterPoints(
  dataset: UniversalDataset,
  rows: ParsedRow[],
  groupDim: string,
  xCol: string,
  yMode: 'count' | string
): ScatterPoint[] {
  const totalCount = rows.length || 1;
  const groups = new Map<
    string,
    { xSum: number; xCnt: number; ySum: number; yCnt: number; count: number }
  >();

  for (const r of rows) {
    const key = r.raw[groupDim] || '(Empty)';
    const g = groups.get(key) || {
      xSum: 0,
      xCnt: 0,
      ySum: 0,
      yCnt: 0,
      count: 0,
    };
    const xv = r.numbers[xCol];
    if (xv !== null && xv !== undefined) {
      g.xSum += xv;
      g.xCnt += 1;
    }
    if (yMode !== 'count') {
      const yv = r.numbers[yMode];
      if (yv !== null && yv !== undefined) {
        g.ySum += yv;
        g.yCnt += 1;
      }
    }
    g.count += 1;
    groups.set(key, g);
  }

  const pts: ScatterPoint[] = [];
  for (const [label, g] of groups.entries()) {
    if (g.xCnt === 0) continue;
    const xValue = g.xSum / g.xCnt;
    const yValue = yMode === 'count' ? g.count : g.ySum;
    const sizeValue = g.xSum;
    pts.push({
      label,
      xValue,
      yValue,
      sizeValue,
      count: g.count,
      shareCount: g.count / totalCount,
    });
  }

  return pts.sort((a, b) => b.sizeValue - a.sizeValue).slice(0, 40);
}

export interface CoOccurrencePair {
  itemA: string;
  itemB: string;
  occurrences: number;
  combinedMetric: number;
  entityIds: string[];
}

export function computeCoOccurrences(
  dataset: UniversalDataset,
  rows: ParsedRow[],
  categoryCol: string
): CoOccurrencePair[] {
  if (!dataset.entityIdCol || !dataset.hasMultiRowEntities) return [];
  const groups = groupRowsByEntity(dataset, rows).filter((g) => g.rowCount > 1);
  const map = new Map<string, CoOccurrencePair>();

  for (const g of groups) {
    const values = Array.from(
      new Set(g.rows.map((r) => r.raw[categoryCol]).filter(Boolean))
    ).sort();
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i];
        const b = values[j];
        const k = `${a}|||${b}`;
        const existing = map.get(k) || {
          itemA: a,
          itemB: b,
          occurrences: 0,
          combinedMetric: 0,
          entityIds: [],
        };
        existing.occurrences += 1;
        existing.combinedMetric += g.primaryMetricTotal;
        existing.entityIds.push(g.entityId);
        map.set(k, existing);
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.occurrences - a.occurrences || b.combinedMetric - a.combinedMetric
  );
}

export function buildAiDatasetProfile(
  dataset: UniversalDataset,
  filteredRows: ParsedRow[]
) {
  const numericCols = dataset.columns.filter(
    (c) => c.kind === 'currency' || c.kind === 'number' || c.kind === 'percent'
  );
  const numericSummaries = numericCols.map((col) => {
    const vals = filteredRows
      .map((r) => r.numbers[col.name])
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      column: col.name,
      kind: col.kind,
      count: vals.length,
      sum: Number(sum.toFixed(2)),
      avg: vals.length > 0 ? Number((sum / vals.length).toFixed(2)) : 0,
      min: vals[0] ?? 0,
      max: vals[vals.length - 1] ?? 0,
    };
  });

  const categoricalCols = dataset.columns
    .filter((c) => c.kind === 'category')
    .slice(0, 5);
  const categoricalSummaries = categoricalCols.map((col) => {
    const counts = new Map<string, { count: number; metricSum: number }>();
    for (const r of filteredRows) {
      const k = r.raw[col.name] || '(Empty)';
      const entry = counts.get(k) || { count: 0, metricSum: 0 };
      entry.count += 1;
      if (dataset.primaryMetricCol) {
        entry.metricSum += r.numbers[dataset.primaryMetricCol] ?? 0;
      }
      counts.set(k, entry);
    }
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1].metricSum - a[1].metricSum || b[1].count - a[1].count)
      .slice(0, 12)
      .map(([value, stats]) => ({
        value,
        count: stats.count,
        primaryMetricSum: Number(stats.metricSum.toFixed(2)),
      }));
    return {
      column: col.name,
      uniqueValues: counts.size,
      topValues: top,
    };
  });

  return {
    datasetName: dataset.name,
    rowCount: filteredRows.length,
    totalUnfilteredRows: dataset.rows.length,
    primaryDateCol: dataset.primaryDateCol,
    primaryMetricCol: dataset.primaryMetricCol,
    entityIdCol: dataset.entityIdCol,
    dateRange:
      dataset.minDate && dataset.maxDate
        ? `${dataset.minDate} to ${dataset.maxDate}`
        : null,
    columns: dataset.columns.map((c) => ({
      name: c.name,
      kind: c.kind,
      uniqueCount: c.uniqueCount,
      nullCount: c.nullCount,
    })),
    numericSummaries,
    categoricalSummaries,
    sampleRows: filteredRows.slice(0, 8).map((r) => r.raw),
  };
}

export function exportRowsToCsv(
  dataset: UniversalDataset,
  rows: ParsedRow[],
  filename: string
) {
  const headers = dataset.columns.map((c) => c.name);
  const escapeCell = (val: string) =>
    /[",\n\r]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => headers.map((h) => escapeCell(r.raw[h] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
