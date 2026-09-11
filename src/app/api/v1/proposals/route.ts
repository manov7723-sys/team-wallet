/**
 * Extracts the wallet address from request headers.
 *
 * @param {NextRequest} req - Incoming request object
 * @returns {string | null} Wallet address if present, otherwise null
 */

/**
 * Verifies whether a wallet belongs to a team.
 *
 * Responsibilities:
 * - Fetches the team by wallet address
 * - Validates if the user is a member of the team
 *
 * @async
 * @param {string} wallet - Wallet address of the requester
 * @param {string} teamWalletAddress - Team wallet identifier
 *
 * @returns {Promise<
 *   | { error: string; status: number }
 *   | { team: any }
 * >}
 */

/**
 * GET /api/proposal-logs
 *
 * Fetches proposal execution logs for a given team.
 *
 * Flow:
 * - Validates wallet authentication
 * - Validates required query params (teamWalletAddress)
 * - Verifies team membership
 * - Retrieves proposal logs sorted by latest execution
 *
 * @async
 * @param {NextRequest} req - Incoming request object
 *
 * @returns {Promise<NextResponse>}
 *
 */

/**
 * POST /api/proposal-logs
 *
 * Creates or updates a proposal execution log.
 *
 * Flow:
 * - Validates wallet authentication
 * - Parses and validates request body
 * - Verifies team membership
 * - Upserts proposal log with execution details
 *
 * @async
 * @param {NextRequest} req - Incoming request object
 *
 * @returns {Promise<NextResponse>}
 *
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { ProposalLog, Team } from "@/src/models";
import { getTranslations } from "next-intl/server";
function getWallet(req: NextRequest): string | null {
  return req.headers.get("x-wallet-address");
}

async function verifyMembership(wallet: string, teamWalletAddress: string) {
  const t = await getTranslations("errormessage");
  const team = await Team.findOne({ teamWalletAddress, isActive: true });
  if (!team) return { error: t("teamNotFound"), status: 404 };

  const isMember = team.owner === wallet || team.members.some((m) => m.key === wallet);
  if (!isMember) return { error: t("notMember"), status: 403 };

  return { team };
}

export async function GET(req: NextRequest) {
  const t = await getTranslations("errormessage");
  const wallet = getWallet(req);
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const teamWalletAddress = req.nextUrl.searchParams.get("team");
  if (!teamWalletAddress) {
    return NextResponse.json({ success: false, error: t("missingParams") }, { status: 400 });
  }

  await connectDB();

  const check = await verifyMembership(wallet, teamWalletAddress);
  if ("error" in check) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  const logs = await ProposalLog.find({ teamWalletAddress })
    .sort({ createdAt: -1 })
    .select("proposalKey signature executedBy createdAt")
    .lean();

  return NextResponse.json({ success: true, data: logs });
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const wallet = getWallet(req);
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const { teamWalletAddress, proposalKey, signature } = await req.json();

  if (!teamWalletAddress || !proposalKey || !signature) {
    return NextResponse.json(
      { success: false, error: t("Missing teamWalletAddress proposalKey or signature") },
      { status: 400 }
    );
  }

  await connectDB();

  const check = await verifyMembership(wallet, teamWalletAddress);
  if ("error" in check) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  const log = await ProposalLog.findOneAndUpdate(
    { proposalKey },
    { $set: { teamWalletAddress, signature, executedBy: wallet } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, data: log });
}
