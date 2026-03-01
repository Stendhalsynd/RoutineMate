import type { GoogleProfile } from "@routinemate/domain";

type GooglePlatform = "web" | "android";

type TokenInfoPayload = {
  sub?: string;
  email?: string;
  email_verified?: string;
  picture?: string;
  aud?: string;
  azp?: string;
};

function allowedAudiences(platform: GooglePlatform): string[] {
  const values: Array<string | undefined> =
    platform === "web"
      ? [
          process.env.GOOGLE_WEB_CLIENT_ID,
          process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
        ]
      : [process.env.GOOGLE_ANDROID_CLIENT_ID, process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID];

  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function primaryAudience(platform: GooglePlatform): string {
  const audiences = allowedAudiences(platform);
  const audience = audiences[0];
  if (!audience) {
    const missingEnv =
      platform === "web"
        ? "GOOGLE_WEB_CLIENT_ID"
        : "GOOGLE_ANDROID_CLIENT_ID (or EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)";
    throw new Error(`Google OAuth is not configured. Missing env: ${missingEnv}`);
  }
  return audience;
}

function parseTestToken(idToken: string): GoogleProfile | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const [prefix, sub, email] = idToken.split(":");
  if (prefix !== "test" || !sub || !email) {
    return null;
  }
  const localPart = email.split("@")[0];
  return {
    sub,
    email,
    ...(localPart ? { name: localPart } : {})
  };
}

export async function verifyGoogleIdToken(idToken: string, platform: GooglePlatform): Promise<GoogleProfile> {
  const mocked = parseTestToken(idToken);
  if (mocked) {
    return mocked;
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Google ID token 검증에 실패했습니다.");
  }

  const payload = (await response.json()) as TokenInfoPayload;
  if (!payload.sub || !payload.email) {
    throw new Error("Google 프로필 정보가 누락되었습니다.");
  }
  if (payload.email_verified === "false") {
    throw new Error("Google 이메일 인증이 필요합니다.");
  }

  const audiences = allowedAudiences(platform);
  if (audiences.length > 0) {
    const audience = payload.aud ?? payload.azp ?? "";
    if (!audience || !audiences.includes(audience)) {
      throw new Error("허용되지 않은 Google OAuth 클라이언트입니다.");
    }
  }

  return {
    sub: payload.sub,
    email: payload.email,
    ...(payload.picture ? { picture: payload.picture } : {})
  };
}

type GoogleCodeExchangeInput = {
  authorizationCode: string;
  codeVerifier: string;
  redirectUri: string;
  platform: GooglePlatform;
};

export async function exchangeGoogleAuthorizationCode({
  authorizationCode,
  codeVerifier,
  redirectUri,
  platform
}: GoogleCodeExchangeInput): Promise<string> {
  const clientId = primaryAudience(platform);

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId
  });

  const secret = process.env.GOOGLE_WEB_CLIENT_SECRET?.trim();
  if (platform === "web" && secret) {
    params.set("client_secret", secret);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString(),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as { id_token?: string; error_description?: string };
  if (!response.ok || !payload.id_token) {
    const detail = payload.error_description?.trim();
    throw new Error(detail ? `Google code 교환에 실패했습니다. (${detail})` : "Google code 교환에 실패했습니다.");
  }

  return payload.id_token;
}

export function getGoogleWebClientId(): string {
  const clientId =
    process.env.GOOGLE_WEB_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error("Google OAuth is not configured. Missing env: GOOGLE_WEB_CLIENT_ID");
  }

  return clientId;
}
