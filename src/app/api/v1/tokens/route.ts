import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { Token, Team } from "@/src/models";
import { getTranslations } from "next-intl/server";

function getWallet(req: NextRequest): string | null {
  return req.headers.get("x-wallet-address");
}

async function verifyMembership(wallet: string, teamWalletAddress: string) {
  const t = await getTranslations("errormessageapi");
  const team = await Team.findOne({ teamWalletAddress, isActive: true });
  if (!team) return { error: t("teamNotFound"), status: 404 };
  const isMember = team.owner === wallet || team.members.some((m) => m.key === wallet);
  if (!isMember) return { error: t("notMember"), status: 403 };
  return { team };
}

/**
 * GET /api/v1/tokens?team=<teamWalletAddress>
 * List all managed tokens for a team.
 */
export async function GET(req: NextRequest) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const teamWalletAddress = req.nextUrl.searchParams.get("team");
  if (!teamWalletAddress) {
    return NextResponse.json(
      { success: false, error: t("Missing team query param") },
      { status: 400 }
    );
  }

  await connectDB();

  const check = await verifyMembership(wallet, teamWalletAddress);
  if ("error" in check) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  const tokens = await Token.find({ teamWalletAddress }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({ success: true, data: tokens });
}

/**
 * POST /api/v1/tokens
 * Save a new managed token after creation or import.
 * Body: { mintAddress, teamWalletAddress, name, symbol, decimals, tokenType, metadataUri, imageUrl, description?, extensions?, imported? }
 */
export async function POST(req: NextRequest) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const body = await req.json();
  const {
    mintAddress,
    teamWalletAddress,
    name,
    symbol,
    decimals,
    tokenType,
    metadataUri,
    imageUrl,
  } = body;

  if (
    !mintAddress ||
    !teamWalletAddress ||
    !name ||
    !symbol ||
    decimals === undefined ||
    !tokenType ||
    !metadataUri
  ) {
    return NextResponse.json({ success: false, error: t("missingFields") }, { status: 400 });
  }

  await connectDB();

  const check = await verifyMembership(wallet, teamWalletAddress);
  if ("error" in check) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  const existing = await Token.findOne({ mintAddress });
  if (existing) {
    return NextResponse.json(
      { success: false, error: t("Token already registered") },
      { status: 409 }
    );
  }

  const token = await Token.create({
    mintAddress,
    teamWalletAddress,
    name: name.trim(),
    symbol: symbol.trim().toUpperCase(),
    decimals,
    tokenType,
    initialSupply: body.initialSupply || "0",
    metadataUri,
    imageUrl: imageUrl || "",
    description: body.description?.trim() || "",
    extensions: body.extensions || {},
    createdBy: wallet,
    imported: body.imported || false,
  });

  return NextResponse.json({ success: true, data: token });
}
