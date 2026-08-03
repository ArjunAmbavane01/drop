import { NextResponse } from "next/server";

export function jsonOk<T>(data: T) {
  return NextResponse.json(data);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
