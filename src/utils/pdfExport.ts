import { jsPDF } from 'jspdf';
import { AiAnalysisResponse, ParsedRow, UniversalDataset } from '../types/dataset';
import {
  aggregateUniversal,
  computeUniversalKpis,
  formatColumnValue,
  formatPercent,
} from './csvEngine';

interface ExportPdfOptions {
  dataset: UniversalDataset;
  filteredRows: ParsedRow[];
  appVersion: string;
  aiAnalysis?: AiAnalysisResponse | null;
}

export function generatePdfReport({
  dataset,
  filteredRows,
  appVersion,
  aiAnalysis,
}: ExportPdfOptions): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }
  };

  // Report Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text('Dataset Analytics Report', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(`v${appVersion} · Generated ${dateStr}`, pageWidth - margin, y, {
    align: 'right',
  });

  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Source: ${dataset.name} · ${filteredRows.length} of ${dataset.rows.length} rows${
      dataset.minDate && dataset.maxDate ? ` · ${dataset.minDate} to ${dataset.maxDate}` : ''
    }`,
    margin,
    y
  );

  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  // Executive KPI Summary
  const kpis = computeUniversalKpis(dataset, filteredRows);
  const pMetricSchema = dataset.columns.find((c) => c.name === dataset.primaryMetricCol);
  const pKind = pMetricSchema?.kind ?? 'number';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Executive Summary', margin, y);
  y += 16;

  const kpiCards: { label: string; value: string }[] = [
    { label: 'Rows Analyzed', value: String(kpis.rowCount) },
  ];
  if (dataset.primaryMetricCol) {
    kpiCards.push({
      label: `Total ${dataset.primaryMetricCol}`,
      value: formatColumnValue(kpis.primarySum, pKind),
    });
    kpiCards.push({
      label: `Avg ${dataset.primaryMetricCol} / Row`,
      value: formatColumnValue(kpis.primaryAvgRow, pKind),
    });
  }
  if (dataset.entityIdCol) {
    kpiCards.push({
      label: `Unique ${dataset.entityIdCol}`,
      value: String(kpis.uniqueEntities),
    });
  }
  if (kpis.topCategory) {
    kpiCards.push({
      label: `Top ${dataset.primaryCategoryCol || 'Category'}`,
      value: `${kpis.topCategory.name} (${formatPercent(kpis.topCategory.share)})`,
    });
  }

  const colW = contentWidth / Math.min(3, kpiCards.length);
  doc.setFontSize(9);
  kpiCards.forEach((card, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const bx = margin + col * colW;
    const by = y + row * 40;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, bx, by);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value.slice(0, 32), bx, by + 14);
    doc.setFontSize(9);
  });

  y += Math.ceil(kpiCards.length / 3) * 40 + 10;

  // Optional AI Summary Section
  if (aiAnalysis) {
    ensureSpace(120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('AI Analyst Highlights', margin, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const summaryLines = doc.splitTextToSize(aiAnalysis.summary, contentWidth) as string[];
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 13 + 8;

    for (const finding of aiAnalysis.keyFindings.slice(0, 4)) {
      ensureSpace(28);
      const lines = doc.splitTextToSize(`• ${finding}`, contentWidth - 8) as string[];
      doc.text(lines, margin + 6, y);
      y += lines.length * 12 + 4;
    }
    y += 10;
  }

  // Primary Category Breakdown Table
  if (dataset.primaryCategoryCol) {
    ensureSpace(120);
    const metricKey = dataset.primaryMetricCol || '__count';
    const op = dataset.primaryMetricCol ? 'sum' : 'count';
    const buckets = aggregateUniversal(
      dataset,
      filteredRows,
      dataset.primaryCategoryCol,
      metricKey,
      op
    ).slice(0, 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Breakdown by ${dataset.primaryCategoryCol}`, margin, y);
    y += 16;

    // Header row
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y - 10, contentWidth, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(dataset.primaryCategoryCol, margin + 6, y + 2);
    doc.text('Rows', margin + contentWidth * 0.56, y + 2, { align: 'right' });
    doc.text('Share', margin + contentWidth * 0.74, y + 2, { align: 'right' });
    doc.text(
      dataset.primaryMetricCol || 'Count',
      pageWidth - margin - 6,
      y + 2,
      { align: 'right' }
    );
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    for (const b of buckets) {
      ensureSpace(18);
      doc.text(b.label.slice(0, 42), margin + 6, y);
      doc.text(String(b.count), margin + contentWidth * 0.56, y, { align: 'right' });
      doc.text(formatPercent(b.shareValue), margin + contentWidth * 0.74, y, {
        align: 'right',
      });
      doc.text(
        formatColumnValue(b.value, dataset.primaryMetricCol ? pKind : 'count'),
        pageWidth - margin - 6,
        y,
        { align: 'right' }
      );
      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageWidth - margin, y);
      y += 11;
    }
    y += 10;
  }

  // Secondary Category Breakdown if available
  if (dataset.secondaryCategoryCol) {
    ensureSpace(90);
    const metricKey = dataset.primaryMetricCol || '__count';
    const op = dataset.primaryMetricCol ? 'sum' : 'count';
    const secBuckets = aggregateUniversal(
      dataset,
      filteredRows,
      dataset.secondaryCategoryCol,
      metricKey,
      op
    ).slice(0, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Breakdown by ${dataset.secondaryCategoryCol}`, margin, y);
    y += 16;

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y - 10, contentWidth, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(dataset.secondaryCategoryCol, margin + 6, y + 2);
    doc.text('Rows', margin + contentWidth * 0.56, y + 2, { align: 'right' });
    doc.text('Share', margin + contentWidth * 0.74, y + 2, { align: 'right' });
    doc.text(
      dataset.primaryMetricCol || 'Count',
      pageWidth - margin - 6,
      y + 2,
      { align: 'right' }
    );
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    for (const b of secBuckets) {
      ensureSpace(18);
      doc.text(b.label.slice(0, 42), margin + 6, y);
      doc.text(String(b.count), margin + contentWidth * 0.56, y, { align: 'right' });
      doc.text(formatPercent(b.shareValue), margin + contentWidth * 0.74, y, {
        align: 'right',
      });
      doc.text(
        formatColumnValue(b.value, dataset.primaryMetricCol ? pKind : 'count'),
        pageWidth - margin - 6,
        y,
        { align: 'right' }
      );
      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageWidth - margin, y);
      y += 11;
    }
    y += 10;
  }

  // Sample / Filtered Records Table (first 40 rows)
  ensureSpace(90);
  const displayCols = dataset.columns.slice(0, 5);
  const rowsToPrint = filteredRows.slice(0, 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Filtered Records (${rowsToPrint.length}${
      filteredRows.length > rowsToPrint.length ? ` of ${filteredRows.length}` : ''
    })`,
    margin,
    y
  );
  y += 16;

  const colWidth = contentWidth / Math.max(1, displayCols.length);
  const drawTableHeader = () => {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y - 10, contentWidth, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    displayCols.forEach((col, i) => {
      doc.text(col.name.slice(0, 18), margin + i * colWidth + 4, y + 2);
    });
    y += 16;
  };

  drawTableHeader();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  for (const r of rowsToPrint) {
    if (y + 18 > pageHeight - 45) {
      doc.addPage();
      y = margin;
      drawTableHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
    }
    displayCols.forEach((col, i) => {
      const val = (r.raw[col.name] || '—').slice(0, 22);
      doc.text(val, margin + i * colWidth + 4, y);
    });
    y += 5;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }

  // Page Footer Numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 24,
      { align: 'right' }
    );
  }

  const baseName = dataset.name.replace(/\.csv$/i, '').replace(/[^a-z0-9_-]+/gi, '_');
  const filename = `${baseName}_report.pdf`;
  doc.save(filename);

  // Only invoke window.print() additionally when running top-level (never in sandboxed iframe)
  if (typeof window !== 'undefined' && window.self === window.top) {
    try {
      window.print();
    } catch {
      // Ignore if print dialog is unavailable
    }
  }

  return filename;
}
