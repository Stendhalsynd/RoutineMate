import { workoutSuggestionQuerySchema } from "@routinemate/api-contract";
import { badRequest, internalError, ok, zodIssues } from "@/lib/api-utils";
import type { BodyPart, WorkoutSuggestion } from "@routinemate/domain";

const baseSuggestions: Record<BodyPart, string[]> = {
  chest: ["푸시업", "벤치프레스", "덤벨 프레스"],
  back: ["랫 풀다운", "바벨 로우", "시티드 로우"],
  legs: ["스쿼트", "런지", "레그 프레스"],
  core: ["플랭크", "데드버그", "행잉 레그레이즈"],
  shoulders: ["숄더 프레스", "레터럴 레이즈", "리어 델트 플라이"],
  arms: ["바벨 컬", "트라이셉스 푸시다운", "해머 컬"],
  full_body: ["버피", "쓰러스터", "클린 앤 프레스"],
  cardio: ["런닝", "사이클", "줄넘기"]
};

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = workoutSuggestionQuerySchema.safeParse({
      bodyPart: params.get("bodyPart") ?? "",
      purpose: params.get("purpose") ?? undefined,
      tool: params.get("tool") ?? undefined
    });

    if (!parsed.success) {
      return badRequest("Invalid workout suggestion query.", zodIssues(parsed.error));
    }

    const suggestions: WorkoutSuggestion[] = baseSuggestions[parsed.data.bodyPart].map((exerciseName) => ({
      bodyPart: parsed.data.bodyPart,
      purpose: parsed.data.purpose ?? "fat_loss",
      tool: parsed.data.tool ?? "bodyweight",
      exerciseName,
      reason: "bodyPart/purpose/tool 조합 기반 기본 추천"
    }));

    return ok(
      {
        suggestions
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workout suggestions.";
    return internalError(message);
  }
}

