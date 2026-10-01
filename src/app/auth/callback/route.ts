import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("next");
  const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";
  return NextResponse.redirect(new URL(nextPath, request.url));
}
