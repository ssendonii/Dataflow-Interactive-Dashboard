import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const PER_MODEL_TIMEOUT_MS = 18_000;

function readPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version || '1.1.0';
  } catch {
    return '1.1.0';
  }
}

const APP_VERSION = readPackageVersion();

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable AI dataset analysis.'
    ) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

class TimeoutError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
    this.statusCode = 504;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label} exceeded the ${Math.round(ms / 1000)}s timeout.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractErrorDetails(err: unknown): {
  status: number;
  code: string;
  message: string;
  shouldFailover: boolean;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const upper = raw.toUpperCase();
  const anyErr = err as { status?: number; statusCode?: number; code?: string | number };

  const statusCandidate =
    typeof anyErr?.statusCode === 'number'
      ? anyErr.statusCode
      : typeof anyErr?.status === 'number'
      ? anyErr.status
      : upper.includes('429') || upper.includes('RESOURCE_EXHAUSTED')
      ? 429
      : upper.includes('503') || upper.includes('UNAVAILABLE')
      ? 503
      : upper.includes('404') || upper.includes('NOT_FOUND')
      ? 404
      : upper.includes('403') || upper.includes('PERMISSION_DENIED')
      ? 403
      : upper.includes('401') || upper.includes('API_KEY_INVALID') || upper.includes('INVALID_ARGUMENT')
      ? 400
      : err instanceof TimeoutError || upper.includes('TIMEOUT') || upper.includes('TIMED OUT')
      ? 504
      : 500;

  const shouldFailover =
    statusCandidate === 503 ||
    statusCandidate === 429 ||
    statusCandidate === 404 ||
    statusCandidate === 504 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('NOT_FOUND') ||
    upper.includes('TIMEOUT');

  let cleanMessage = 'Unable to complete AI analysis right now. Please try again.';
  if (statusCandidate === 403 || upper.includes('PERMISSION_DENIED') || upper.includes('API_KEY_INVALID')) {
    cleanMessage =
      'Gemini API access was rejected. Verify that GEMINI_API_KEY is valid in Settings > Secrets.';
  } else if (statusCandidate === 429 || upper.includes('RESOURCE_EXHAUSTED')) {
    cleanMessage =
      'AI request rate limit or quota reached across available models. Please wait a moment and try again.';
  } else if (statusCandidate === 503 || upper.includes('UNAVAILABLE')) {
    cleanMessage =
      'The AI service is temporarily experiencing high demand. Please retry shortly.';
  } else if (statusCandidate === 504 || err instanceof TimeoutError) {
    cleanMessage =
      'The AI analysis timed out while waiting for a model response. Please try again with a smaller prompt.';
  } else if (statusCandidate === 404 || upper.includes('NOT_FOUND')) {
    cleanMessage = 'The configured AI model was unavailable on this endpoint.';
  } else if (anyErr?.statusCode === 503 && raw.includes('GEMINI_API_KEY')) {
    cleanMessage = raw;
  }

  return {
    status: statusCandidate === 404 ? 502 : statusCandidate,
    code: String(anyErr?.code || statusCandidate),
    message: cleanMessage,
    shouldFailover,
  };
}

function stripJsonCodeFences(rawText: string): string {
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }
  return cleaned;
}

interface GenerateFallbackParams {
  contents: string;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
}

async function generateWithRetryAndFallback(
  params: GenerateFallbackParams
): Promise<{ text: string; modelUsed: string }> {
  const ai = getAiClient();
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        }),
        PER_MODEL_TIMEOUT_MS,
        `Model ${model}`
      );

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error(`Empty response received from ${model}.`);
      }
      return { text: stripJsonCodeFences(text), modelUsed: model };
    } catch (err) {
      lastError = err;
      const details = extractErrorDetails(err);
      const hasNextModel = i < models.length - 1;
      if (details.shouldFailover && hasNextModel) {
        console.warn(
          `[AI Failover] ${model} failed (${details.code}), failing over to ${models[i + 1]}...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('All AI models failed.');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, version: APP_VERSION });
  });

  app.post('/api/ai/analyze-csv', async (req: Request, res: Response) => {
    try {
      const { datasetName, rowCount, columns, numericSummaries, categoricalSummaries, sampleRows } =
        req.body ?? {};

      if (!datasetName || !Array.isArray(columns) || columns.length === 0) {
        res.status(400).json({
          error: 'Invalid dataset profile. Please upload or load a valid CSV before analyzing.',
        });
        return;
      }

      const safeContext = JSON.stringify(
        {
          datasetName,
          rowCount,
          columns,
          numericSummaries,
          categoricalSummaries,
          sampleRows: Array.isArray(sampleRows) ? sampleRows.slice(0, 8) : [],
        },
        null,
        2
      );

      const schema = {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'Concise 2-3 sentence executive overview of the dataset.',
          },
          keyFindings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 to 5 specific quantitative findings grounded strictly in the provided summary metrics.',
          },
          dataQualityNotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '1 to 3 observations about missing values, skewness, cardinality, or outliers.',
          },
          recommendedCharts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                rationale: { type: Type.STRING },
                chartKind: {
                  type: Type.STRING,
                  description: 'One of: area, line, bar, cumulative, horizontalBar, donut, heatmap, scatter, calendar',
                },
                dimension: {
                  type: Type.STRING,
                  description: 'Exact column name from columns, or one of derived: __date_day, __date_week, __date_month, __date_weekday',
                },
                metric: {
                  type: Type.STRING,
                  description: 'Exact numeric column name, or __count for row count, or __unique_entities for unique IDs',
                },
              },
              required: ['title', 'rationale', 'chartKind', 'dimension', 'metric'],
            },
          },
        },
        required: ['summary', 'keyFindings', 'dataQualityNotes', 'recommendedCharts'],
      };

      const { text, modelUsed } = await generateWithRetryAndFallback({
        systemInstruction:
          'You are a senior data analyst. Analyze the provided CSV schema, computed statistics, and sample rows. Be strictly factual—never invent numbers that are not supported by the summary statistics. Recommend 3 diverse, high-signal chart configurations using ONLY the provided column names or derived date keys (__date_day, __date_week, __date_month, __date_weekday) and metric keys (exact numeric column name or __count).',
        contents: `Analyze this CSV dataset profile and return structured JSON insights:\n\n${safeContext}`,
        responseSchema: schema,
      });

      const parsed = JSON.parse(text) as Record<string, unknown>;
      res.json({ ...parsed, modelUsed });
    } catch (err) {
      const details = extractErrorDetails(err);
      res.status(details.status).json({
        error: details.message,
        code: details.code,
      });
    }
  });

  app.post('/api/ai/ask', async (req: Request, res: Response) => {
    try {
      const { question, datasetName, rowCount, columns, numericSummaries, categoricalSummaries, sampleRows } =
        req.body ?? {};

      if (!question || typeof question !== 'string' || !question.trim()) {
        res.status(400).json({ error: 'Please enter a question about the dataset.' });
        return;
      }

      const safeContext = JSON.stringify(
        {
          datasetName,
          rowCount,
          columns,
          numericSummaries,
          categoricalSummaries,
          sampleRows: Array.isArray(sampleRows) ? sampleRows.slice(0, 8) : [],
        },
        null,
        2
      );

      const schema = {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description: 'Direct, factual answer to the user question referencing exact values from the dataset statistics.',
          },
          supportingMetrics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 4 brief supporting facts or figures from the dataset.',
          },
          suggestedChart: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              chartKind: { type: Type.STRING },
              dimension: { type: Type.STRING },
              metric: { type: Type.STRING },
            },
            required: ['title', 'chartKind', 'dimension', 'metric'],
          },
        },
        required: ['answer', 'supportingMetrics'],
      };

      const { text, modelUsed } = await generateWithRetryAndFallback({
        systemInstruction:
          'You are a precision data analyst answering a question about an uploaded CSV dataset. Ground every figure in the provided computed summaries and sample rows. If a detail cannot be determined from the summary, state that clearly instead of guessing.',
        contents: `Question: ${question.trim()}\n\nDataset Profile:\n${safeContext}`,
        responseSchema: schema,
      });

      const parsed = JSON.parse(text) as Record<string, unknown>;
      res.json({ ...parsed, modelUsed });
    } catch (err) {
      const details = extractErrorDetails(err);
      res.status(details.status).json({
        error: details.message,
        code: details.code,
      });
    }
  });

  const distDir = path.join(__dirname, 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (isProd && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (v${APP_VERSION})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
