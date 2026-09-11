/**
 * @file Team API Routes
 * 
 * Provides API endpoints to manage teams using wallet-based authentication.
 * 
 * Endpoints:
 * 
 * POST /api/team
 *   - Creates a new team with the given wallet, name, members, threshold, and optional image.
 *   - Authorization: Requires wallet address in headers.
 *   - Validates required fields: teamWalletAddress, name, members array, threshold.
 * GET /api/team
 *   - Retrieves all active teams where the requesting wallet is the owner or a member.
 *   - Authorization: Requires wallet address in headers.
 
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { Team } from "@/src/models";
import logger from "@/src/lib/logger";
import { getTranslations } from "next-intl/server";

function getWallet(req: NextRequest): string | null {
  return req.headers.get("x-wallet-address");
}

export async function POST(req: NextRequest) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  try {
    const body = await req.json();
    const { teamWalletAddress, name, members, threshold, image } = body;

    if (!teamWalletAddress || !name || !members?.length || !threshold) {
      return NextResponse.json(
        { success: false, error: t("Missing required fields") },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await Team.findOne({ teamWalletAddress });
    if (existing) {
      return NextResponse.json(
        { success: false, error: t("Team already exists") },
        { status: 409 }
      );
    }

    const team = await Team.create({
      teamWalletAddress,
      name: name.trim(),
      owner: wallet,
      members: members.map((m: any) => ({
        key: m.key,
        name: m.name || undefined,
        isOwner: m.key === wallet,
        hasVoter: true,
        hasContributor: m.key === wallet,
        addedAt: new Date(),
      })),
      threshold,
      image: image || undefined,
      isActive: true,
    });

    return NextResponse.json({ success: true, data: team });
  } catch (error: any) {
    logger.error("Error on adding team", error);
    return NextResponse.json(
      { success: false, error: t("Failed to create team") },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const wallet = getWallet(req);
  const t = await getTranslations("teamapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  await connectDB();
  const teams = await Team.find({
    $or: [{ owner: wallet }, { "members.key": wallet }],
    isActive: true,
  }).select("-__v");

  return NextResponse.json({ success: true, data: teams });
}
