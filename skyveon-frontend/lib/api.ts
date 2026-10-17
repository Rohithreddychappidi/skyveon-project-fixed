"use client";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * CMS image uploads are stored as backend-relative paths (e.g.
 * "/api/cms/image/cms/2026/07/abc.jpg"). An external URL an admin pasted
 * in by hand is left untouched. Used both in the CMS editor's preview and
 * on the public home page itself, since the frontend and backend run on
 * different origins.
 */
export function resolveImageUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (url.startsWith("/api/")) return `${API_BASE_URL}${url}`;
  return url;
}

// The access token lives in memory only (never localStorage) — it's
// recovered on page load via the httpOnly refresh cookie. See
// components/auth/auth-context.tsx.
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** AuthProvider registers a callback here so a failed refresh can clear the session. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  skipAuthRetry?: boolean;
}

async function rawFetch(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    // sends/receives the httpOnly refresh cookie
    credentials: "include",
  });
}

async function parseResponse(res: Response) {
  if (res.status === 204) return null;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error || res.statusText, body?.details);
  }
  return body;
}

// Remembers (per browser) that a session exists, so public pages don't fire
// a refresh request that can only 401 for visitors who never signed in.
// The refresh cookie itself is httpOnly and scoped to the API origin, so
// the frontend can't check for it directly.
const SESSION_HINT_KEY = "skyveon-has-session";

export function setSessionHint(on: boolean) {
  try {
    if (on) window.localStorage.setItem(SESSION_HINT_KEY, "1");
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // storage unavailable (private mode) — refresh will just always be tried
  }
}

export function hadSession() {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return true;
  }
}

// Refresh tokens rotate on every use, so two refreshes racing with the same
// cookie used to end with one of them rejected — and the app logging the
// user out. Every caller now shares the one in-flight refresh instead.
let refreshInFlight: Promise<{ accessToken: string } | null> | null = null;

export function refreshAccessToken(): Promise<{ accessToken: string } | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return null;
        const body = await res.json();
        setAccessToken(body.accessToken);
        return body;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const tokenUsed = accessToken;
  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuthRetry && !path.startsWith("/api/auth/")) {
    // If another request already refreshed while this one was in flight,
    // just retry with the new token rather than refreshing again.
    const refreshed = accessToken && accessToken !== tokenUsed ? { accessToken } : await refreshAccessToken();
    if (refreshed) {
      res = await rawFetch(path, options);
    } else {
      setAccessToken(null);
      onUnauthorized?.();
    }
  }

  return parseResponse(res);
}

/** Absolute URL for an API path (e.g. a signed lesson-file link from /api/files/:id/link). */
export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

/**
 * Downloads a file from an authenticated endpoint and triggers the
 * browser's save dialog — a plain <a href> can't carry the Authorization
 * header these routes need, so this fetches the blob manually instead.
 */
export async function downloadFile(path: string, fileName: string) {
  let res = await rawFetch(path, { method: "GET" });
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await rawFetch(path, { method: "GET" });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: (path: string) => apiFetch(path, { method: "GET" }),
  post: (path: string, body?: unknown) =>
    apiFetch(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    apiFetch(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: (path: string) => apiFetch(path, { method: "DELETE" }),
  upload: (path: string, formData: FormData) => apiFetch(path, { method: "POST", body: formData }),
};
