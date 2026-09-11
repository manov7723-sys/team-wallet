/**
 * Extracts the wallet address from request headers.
 *
 * @param {NextRequest} req - Incoming request object
 * @returns {string | null} Wallet address if present, otherwise null
 */

/**
 * Verifies whether a wallet belongs to a team and checks its role.
 *
 * Responsibilities:
 * - Fetches the team by wallet address
 * - Validates if the user is a member of the team
 * - Determines if the user is an owner or contributor
 *
 * @async
 * @param {string} wallet - Wallet address of the requester
 * @param {string} teamWalletAddress - Team wallet identifier
 *
 * @returns {Promise<
 *   | { error: string; status: number }
 *   | { team: any; isContributorOrOwner: boolean }
 * >}
 *
 * Possible errors:
 * - 404: Team not found
 * - 403: User is not a member of the team
 */

/**
 * GET /api/programs
 *
 * Fetches all programs associated with a given team wallet.
 *
 * Flow:
 * - Validates wallet authentication
 * - Validates required query params (teamWalletAddress)
 * - Verifies team membership
 * - Retrieves programs sorted by creation date (latest first)
 *
 * @async
 * @param {NextRequest} req - Incoming request object
 *
 * @returns {Promise<NextResponse>}
 *
 * Responses:
 * - 200: Programs fetched successfully
 * - 400: Missing query parameters
 * - 401: Unauthorized (wallet missing)
 * - 403: Not a team member
 * - 404: Team not found
 */

/**
 * POST /api/programs
 *
 * Creates a new program entry or updates an existing program with upgrade logs.
 *
 * Flow:
 * - Validates wallet authentication
 * - Parses and validates request body
 * - Verifies team membership
 * - If `upgradeLog` is provided:
 *    → Appends upgrade log to existing program
 * - Else:
 *    → Creates a new program entry
 *
 * @async
 * @param {NextRequest} req - Incoming request object
 *
 * @returns {Promise<NextResponse>}
 *
 * Request Body:
 * - programId {string} - Unique program identifier
 * - teamWalletAddress {string} - Team wallet address
 * - name {string} (required for creation)
 * - description {string} (optional)
 * - upgradeLog {Object} (optional)
 *
 * Responses:
 * - 200: Program updated (upgrade log added)
 * - 201: Program created
 * - 400: Missing fields or invalid input
 * - 401: Unauthorized
 * - 403: Not a team member
 * - 404: Program or team not found
 * - 409: Program already exists
 */

/**
 * DELETE /api/programs
 *
 * Deletes a program associated with a team.
 *
 * Flow:
 * - Validates wallet authentication
 * - Validates required query params (programId, teamWalletAddress)
 * - Verifies team membership
 * - Deletes the program record
 *
 * @async
 * @param {NextRequest} req - Incoming request object
 *
 * @returns {Promise<NextResponse>}
 *
 * Query Params:
 * - id {string} - Program ID
 * - team {string} - Team wallet address
 *
 * Responses:
 * - 200: Program deleted successfully
 * - 400: Missing query parameters
 * - 401: Unauthorized
 * - 403: Not a team member
 * - 404: Team not found
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { Program, Team } from "@/src/models";
import { getTranslations } from "next-intl/server";
function getWallet(req: NextRequest): string | null {
  return req.headers.get("x-wallet-address");
}

async function verifyMembership(wallet: string, teamWalletAddress: string) {
  const team = await Team.findOne({ teamWalletAddress, isActive: true });
  const t = await getTranslations("errormessageapi");
  if (!team) return { error: t("teamNotFound"), status: 404 };
  const isMember = team.owner === wallet || team.members.some((m) => m.key === wallet);
  if (!isMember) return { error: t("notMember"), status: 403 };
  const isContributorOrOwner =
    team.owner === wallet || team.members.some((m) => m.key === wallet && m.isOwner);
  return { team, isContributorOrOwner };
}

export async function GET(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
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

  const programs = await Program.find({ teamWalletAddress }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ success: true, data: programs });
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const wallet = getWallet(req);
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const body = await req.json();
  const { programId, teamWalletAddress } = body;

  if (!programId || !teamWalletAddress) {
    return NextResponse.json({ success: false, error: t("missingFields") }, { status: 400 });
  }

  await connectDB();
  const check = await verifyMembership(wallet, teamWalletAddress);
  if ("error" in check) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  if (body.upgradeLog) {
    const program = await Program.findOneAndUpdate(
      { programId, teamWalletAddress },
      {
        $push: {
          upgradeLogs: {
            bufferAddress: body.upgradeLog.bufferAddress,
            notes: body.upgradeLog.notes || "",
            proposalKey: body.upgradeLog.proposalKey || "",
            signature: body.upgradeLog.signature || "",
            proposedBy: wallet,
            executedAt: body.upgradeLog.executedAt
              ? new Date(body.upgradeLog.executedAt)
              : undefined,
          },
        },
      },
      { new: true }
    );
    if (!program) {
      return NextResponse.json({ success: false, error: t("programNotFound") }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: program });
  }

  if (!body.name) {
    return NextResponse.json({ success: false, error: t("nameRequired") }, { status: 400 });
  }

  const existing = await Program.findOne({ programId });
  if (existing) {
    return NextResponse.json({ success: false, error: t("alreadyTracked") }, { status: 409 });
  }

  const program = await Program.create({
    programId,
    teamWalletAddress,
    name: body.name.trim(),
    description: body.description?.trim() || "",
    addedBy: wallet,
  });

  return NextResponse.json({ success: true, data: program });
}

export async function DELETE(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const wallet = getWallet(req);
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const programId = req.nextUrl.searchParams.get("id");
  const teamWalletAddress = req.nextUrl.searchParams.get("team");

  if (!programId || !teamWalletAddress) {
    return NextResponse.json({ success: false, error: t("missingParams") }, { status: 400 });
  }

  await connectDB();
  const check = await verifyMembership(wallet, teamWalletAddress);
  if ("error" in check) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  await Program.deleteOne({ programId, teamWalletAddress });
  return NextResponse.json({ success: true });
}
