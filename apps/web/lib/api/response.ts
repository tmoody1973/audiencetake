import { NextResponse } from "next/server";

type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
};

export function ok<T>(data: T, requestId = crypto.randomUUID()) {
  return NextResponse.json({ ok: true, data, error: null, requestId });
}

export function fail(error: ApiError, status: number, requestId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, data: null, error, requestId }, { status });
}
