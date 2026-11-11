import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;

export async function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    return NextResponse.json({ error: "A criação de contas é feita pelo usuário Master." }, { status: 403 });
  }
  return handlers.POST(request);
}
