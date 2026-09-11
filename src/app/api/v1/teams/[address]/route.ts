/**
 * @file Team API Route Handlers
 *
 * Provides GET and PUT handlers for managing and retrieving team data
 * based on wallet addresses. Handles authorization, permission checks,
 * and team data updates.
 *
 * Dependencies:
 * - Next.js server (NextRequest, NextResponse)
 * - MongoDB connection helper (connectDB)
 * - Team model
 * - next-intl for translations
 *
 * Exports:
 * - GET: Retrieve team details for a given wallet and team address.
 * - PUT: Update team information (description, image) for authorized users.
 * Extracts the wallet address from request headers.
 *
 * @param {NextRequest} req - The incoming request object.
 * @returns {string | null} - Wallet address if present, otherwise null.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { Team } from "@/src/models";
import { getTranslations } from "next-intl/server";

function getWallet(req: NextRequest): string | null {
  return req.headers.get("x-wallet-address");
}

type Params = { params: Promise<{ address: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const { address } = await params;
  await connectDB();

  const team = await Team.findOne({ teamWalletAddress: address, isActive: true }).select("-__v");
  if (!team)
    return NextResponse.json({ success: false, error: t("teamNotFound") }, { status: 404 });

  const isMember = team.owner === wallet || team.members.some((m) => m.key === wallet);
  if (!isMember)
    return NextResponse.json({ success: false, error: t("Not a member") }, { status: 403 });

  return NextResponse.json({ success: true, data: team });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const t = await getTranslations("errormessageapi");
  const wallet = getWallet(req);
  if (!wallet)
    return NextResponse.json({ success: false, error: t("Unauthorized") }, { status: 401 });

  const { address } = await params;
  await connectDB();

  const team = await Team.findOne({ teamWalletAddress: address, isActive: true });
  if (!team) return NextResponse.json({ success: false, error: t("notMember") }, { status: 404 });

  const isOwner = team.owner === wallet;
  const member = team.members.find((m) => m.key === wallet);
  const isContributor = member?.hasContributor || false;

  if (!isOwner && !isContributor) {
    return NextResponse.json(
      { success: false, error: t("Only owner or contributors can update team settings") },
      { status: 403 }
    );
  }

  const body = await req.json();
  const allowed = ["image", "description"];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: t("No valid fields to update") },
      { status: 400 }
    );
  }

  const updated = await Team.findOneAndUpdate(
    { teamWalletAddress: address },
    { $set: updates },
    { new: true }
  ).select("-__v");

  return NextResponse.json({ success: true, data: updated });
}
