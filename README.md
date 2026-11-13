# TrouserCraft CSV & Sales Analytics Dashboard

An interactive, schema-adaptive CSV analytics dashboard built with React, TypeScript, Tailwind CSS, Express, jsPDF, and server-side Gemini AI insights.

## Capabilities

- **Universal CSV Upload & Schema Inference**: Drag-and-drop or upload any CSV file (or explore the preloaded retail sales dataset). Automatically detects numeric, currency, date/timestamp, categorical, and identifier columns, derives time buckets (Day, Week, Month, Weekday), and adapts all charts, filters, and summary tables to the active CSV structure.
- **Multi-View Chart Studio**: Visualize data via Area, Line, Bar, Stacked Bar, Cumulative Curve, Ranked Horizontal Bars, Donut Breakdown, Cross-Tab Matrix Heatmap, Scatter Plot, and Daily Calendar Grid.
- **Server-Side AI Dataset Analyst**: Powered by `@google/genai` on the Express backend with an 18-second per-model timeout, `ThinkingLevel.LOW` structured JSON output, and automatic failover from `gemini-3.8-flash` to `gemini-3.1-flash-lite`.
- **Iframe-Safe PDF & CSV Export**: Multi-page formatted PDF executive reports generated client-side via `jspdf` (compatible with sandboxed iframes), plus raw and pivoted CSV exports.

## Version History

### v1.1.0 (2026-11-12)
- Added Universal Schema-Adaptive CSV engine supporting any arbitrary CSV upload alongside the preloaded sales dataset.
- Added Express full-stack server (`server.ts`) with `@google/genai` server-side AI dataset analysis and Q&A (`gemini-3.8-flash` primary with automatic failover to `gemini-3.1-flash-lite`, 18s timeout, `ThinkingLevel.LOW`, and clean upstream error formatting).
- Added safe frontend `fetch` wrapper (`safeFetchJson`) handling non-JSON / HTML proxy responses cleanly.
- Added iframe-safe multi-page PDF report export powered by `jspdf` with download confirmation toast.
- Added active version badge (`v1.1.0`) in the application header and synchronized `README.md` version history.

### v1.0.0 (2026-11-12)
- Initial sales analytics dashboard with Overview, Chart Studio, Product Analytics, Order & Basket Ledger, and interactive cross-filtering for `Sales_data_-_Sheet1_5e94d700.csv`.
