/**
 * @module API Authentication Middleware
 *
 * Edge middleware that runs on every /api/v1/* request except
 * /api/v1/auth/* and OPTIONS preflight requests.
 *
 * Verifies the Bearer JWT using the JWT_SECRET env var via `jose`,
 * extracts the wallet address and userId from the payload, and forwards
 * them as x-wallet-address and x-user-id request headers so downstream
 * route handlers can trust the caller identity without re-verifying.
 * Returns 401 for missing, malformed, or expired tokens.
 */
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const encoder = new TextEncoder();

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (req.method === "OPTIONS" || pathname.startsWith("/api/v1/auth")) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  try {
    const secret = encoder.encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const wallet = payload.wallet as string;
    if (!wallet) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }
    const headers = new Headers(req.headers);
    headers.set("x-wallet-address", wallet);
    headers.set("x-user-id", (payload.userId as string) || "");
    return NextResponse.next({ request: { headers } });
  } catch (err: any) {
    const isExpired = err?.code === "ERR_JWT_EXPIRED";
    return NextResponse.json(
      { success: false, error: isExpired ? "TokenExpired" : "Unauthorized" },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
