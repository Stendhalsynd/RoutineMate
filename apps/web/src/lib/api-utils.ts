import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { formatZodIssues } from "@routinemate/api-contract";

type ApiError = {
  error: {
    code: "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL_ERROR";
    message: string;
    details?: string[];
  };
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function badRequest(message: string, details?: string[]) {
  return NextResponse.json<ApiError>(
    {
      error: {
        code: "BAD_REQUEST",
        message,
        ...(details && details.length > 0 ? { details } : {})
      }
    },
    { status: 400 }
  );
}

export function notFound(message: string) {
  return NextResponse.json<ApiError>(
    {
      error: {
        code: "NOT_FOUND",
        message
      }
    },
    { status: 404 }
  );
}

export function internalError(message: string) {
  return NextResponse.json<ApiError>(
    {
      error: {
        code: "INTERNAL_ERROR",
        message
      }
    },
    { status: 500 }
  );
}

export function zodIssues(error: ZodError): string[] {
  return formatZodIssues(error);
}
