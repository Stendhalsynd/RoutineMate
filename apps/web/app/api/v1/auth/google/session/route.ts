import { googleSessionRequestSchema } from "@routinemate/api-contract";
import { badRequest, internalError, ok, zodIssues } from "@/lib/api-utils";
import { exchangeGoogleAuthorizationCode, verifyGoogleIdToken } from "@/lib/google-auth";
import { repo } from "@/lib/repository";
import { setSessionCookie } from "@/lib/session-cookie";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = googleSessionRequestSchema.safeParse({
      idToken: body.idToken,
      authorizationCode: body.authorizationCode,
      codeVerifier: body.codeVerifier,
      redirectUri: body.redirectUri,
      platform: body.platform
    });

    if (!parsed.success) {
      return badRequest("Invalid google session request.", zodIssues(parsed.error));
    }

    const idToken =
      "idToken" in parsed.data
        ? parsed.data.idToken
        : await exchangeGoogleAuthorizationCode({
            authorizationCode: parsed.data.authorizationCode,
            codeVerifier: parsed.data.codeVerifier,
            redirectUri: parsed.data.redirectUri,
            platform: parsed.data.platform
          });
    const profile = await verifyGoogleIdToken(idToken, parsed.data.platform);
    const session = await repo.createOrRestoreGoogleSession(profile);
    const response = ok(session, 200);
    setSessionCookie(response, session.sessionId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore Google session.";
    return internalError(message);
  }
}
