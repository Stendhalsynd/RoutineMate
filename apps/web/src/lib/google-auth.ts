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
