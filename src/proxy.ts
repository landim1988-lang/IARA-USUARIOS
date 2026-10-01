import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthApi = request.nextUrl.pathname.startsWith("/api/auth");
  if (isAuthApi) return NextResponse.next();
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session && !isLoginPage) return NextResponse.redirect(loginUrl);
  if (session && isLoginPage) return NextResponse.redirect(new URL("/dashboard", request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
