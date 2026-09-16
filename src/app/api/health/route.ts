// Deployment Contract §2 — health endpoint auto-added by deploy_my_app.
// Kubernetes readiness/liveness probes hit this route. Do NOT gate it on
// auth, DB, or any external dependency — /health only proves the process
// is up and serving HTTP.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
