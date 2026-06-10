import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const configuredPassword = process.env.APP_PASSWORD;
  const sessionSecret = process.env.APP_SESSION_SECRET;

  if (!configuredPassword || !sessionSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Password protection is not configured. Set APP_PASSWORD and APP_SESSION_SECRET."
      },
      { status: 500 }
    );
  }

  if (body?.password !== configuredPassword) {
    return NextResponse.json({ ok: false, message: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("atf_session", sessionSecret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
