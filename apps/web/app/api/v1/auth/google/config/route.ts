import { internalError, ok } from "@/lib/api-utils";
import { getGoogleWebClientId } from "@/lib/google-auth";

export async function GET() {
  try {
    const webClientId = getGoogleWebClientId();
    return ok({ webClientId }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth config is not available.";
    return internalError(message);
  }
}
