import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "routinemate_session_id";

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .reduce<Record<string, string>>((acc, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex < 0) {
        return acc;
      }
      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function getSessionIdFromRequest(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export function resolveSessionId(request: Request, explicitSessionId?: string | null): string | null {
  if (explicitSessionId && explicitSessionId.trim().length > 0) {
    return explicitSessionId.trim();
  }
  return getSessionIdFromRequest(request);
}

export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

