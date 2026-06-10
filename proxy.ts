import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];
const PUBLIC_FILE = /\.(.*)$/;

function hasPasswordConfigured() {
  return Boolean(process.env.APP_PASSWORD);
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname) ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  if (!hasPasswordConfigured() && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const session = request.cookies.get("atf_session")?.value;
  if (session === process.env.APP_SESSION_SECRET && process.env.APP_SESSION_SECRET) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
