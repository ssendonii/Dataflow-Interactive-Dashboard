export class ApiFetchError extends Error {
  status: number;
  isHtmlProxyError: boolean;

  constructor(message: string, status: number, isHtmlProxyError = false) {
    super(message);
    this.name = 'ApiFetchError';
    this.status = status;
    this.isHtmlProxyError = isHtmlProxyError;
  }
}

export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (networkErr) {
    const msg =
      networkErr instanceof Error ? networkErr.message : 'Network request failed';
    throw new ApiFetchError(
      `Unable to reach the server (${msg}). Check your connection and try again.`,
      0
    );
  }

  const rawBody = await response.text();
  const trimmed = rawBody.trim();
  const looksLikeHtml =
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    trimmed.includes('</html>');

  let parsed: unknown = null;
  if (trimmed.length > 0 && !looksLikeHtml) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = null;
    }
  }

  if (looksLikeHtml || (trimmed.length > 0 && parsed === null)) {
    const statusLabel = response.status || 502;
    const hint =
      statusLabel === 504 || statusLabel === 502
        ? 'The server gateway timed out or restarted while handling the request.'
        : 'The server returned an unexpected non-JSON page instead of an API response.';
    throw new ApiFetchError(`${hint} (HTTP ${statusLabel})`, statusLabel, true);
  }

  if (!response.ok) {
    const errObj = parsed as { error?: string; message?: string } | null;
    const message =
      errObj?.error ||
      errObj?.message ||
      `Request failed with HTTP ${response.status}.`;
    throw new ApiFetchError(message, response.status);
  }

  return (parsed ?? {}) as T;
}
