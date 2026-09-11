/**
 * @module GET | PUT /api/v1/users/me
 *
 * Current user profile endpoints.
 *
 *   GET
 *     Returns the authenticated user's profile document, excluding
 *     the refresh token hash and internal Mongoose fields.
 *
 *   PUT body: { name?, email?, bio?, avatar? }
 *     Updates mutable profile fields via an allow-list to prevent
 *     mass-assignment. After saving, syncs the updated name and avatar
 *     to all Team.members entries for this wallet so the members page
 *     always reflects the latest profile data.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { User, Team } from "@/src/models";
import logger from "@/src/lib/logger";
import { getTranslations } from "next-intl/server";

function getWallet(req: NextRequest): string | null {
  return req.headers.get("x-wallet-address");
}

export async function GET(req: NextRequest) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ walletAddress: wallet }).select("-refreshTokenHash -__v");
  if (!user)
    return NextResponse.json({ success: false, error: t("User not found") }, { status: 404 });

  return NextResponse.json({ success: true, data: user });
}

export async function PUT(req: NextRequest) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const body = await req.json();
  const allowed = ["name", "email", "bio", "avatar"];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: t("No valid fields") }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOneAndUpdate(
    { walletAddress: wallet },
    { $set: updates },
    { new: true }
  ).select("-refreshTokenHash -__v");

  if (!user)
    return NextResponse.json({ success: false, error: t("User not found") }, { status: 404 });

  const memberSync: Record<string, any> = {};
  if (updates.name !== undefined) memberSync["members.$.name"] = updates.name;
  if (updates.avatar !== undefined) memberSync["members.$.avatar"] = updates.avatar;

  if (Object.keys(memberSync).length > 0) {
    await Team.updateMany({ "members.key": wallet, isActive: true }, { $set: memberSync }).catch(
      (err) => logger.warn("[Profile sync] Team member update failed:", err)
    );
  }

  return NextResponse.json({ success: true, data: user });
}
