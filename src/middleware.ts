import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

export const config = {
  matcher: [
    "/home",
    "/profile",
    "/scam-reports",
    "/digital-threats",
    "/digital-threats/my-threats",
    "/literacy-hub",
  ], // TODO: Add more routes here scam reports, digital threats, literacy hub, etc.
};
