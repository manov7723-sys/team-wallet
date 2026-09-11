import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { Team } from "@/src/models";
import { getTranslations } from "next-intl/server";

function getWallet(req: NextRequest): string | null {
  return req.headers.get("x-wallet-address");
}

type Params = { params: Promise<{ address: string }> };

/**
 * POST /api/v1/teams/[address]/members
 *
 * Add a new member to Team.members or update their role if they already exist.
 * Called at proposal creation time so the display name is persisted in the DB
 * before the proposal is voted on / executed.
 *
 * Body: { key: string, name?: string, role: "voter" | "contributor" }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const { address } = await params;
  const body = await req.json();
  const { key, name, role } = body;

  if (!key || !role || !["voter", "contributor"].includes(role)) {
    return NextResponse.json(
      { success: false, error: "Missing key or invalid role" },
      { status: 400 }
    );
  }

  await connectDB();

  const team = await Team.findOne({ teamWalletAddress: address, isActive: true });
  if (!team)
    return NextResponse.json({ success: false, error: t("teamNotFound") }, { status: 404 });

  const isOwner = team.owner === wallet;
  const callerMember = team.members.find((m) => m.key === wallet);
  const isContributor = callerMember?.hasContributor || false;

  if (!isOwner && !isContributor) {
    return NextResponse.json(
      { success: false, error: "Only owner or contributors can add members" },
      { status: 403 }
    );
  }

  const existing = team.members.find((m) => m.key === key);

  if (existing) {
    const update: Record<string, any> = {};
    if (role === "voter") update["members.$.hasVoter"] = true;
    if (role === "contributor") update["members.$.hasContributor"] = true;
    if (name) update["members.$.name"] = name;

    await Team.updateOne({ teamWalletAddress: address, "members.key": key }, { $set: update });
  } else {
    await Team.updateOne(
      { teamWalletAddress: address },
      {
        $push: {
          members: {
            key,
            name: name || undefined,
            isOwner: false,
            hasVoter: role === "voter",
            hasContributor: role === "contributor",
            addedAt: new Date(),
          },
        },
      }
    );
  }

  const updated = await Team.findOne({ teamWalletAddress: address }).select("-__v");
  return NextResponse.json({ success: true, data: updated });
}

/**
 * PATCH /api/v1/teams/[address]/members
 *
 * Sync a member's role in the DB after a member proposal is executed on-chain.
 * Handles all four member actions: addVoter, removeVoter, addContributor, removeContributor.
 *
 * Body: { key: string, action: "addVoter" | "removeVoter" | "addContributor" | "removeContributor" }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const wallet = getWallet(req);
  const t = await getTranslations("errormessageapi");
  if (!wallet)
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });

  const { address } = await params;
  const body = await req.json();
  const { key, action } = body;

  const validActions = ["addVoter", "removeVoter", "addContributor", "removeContributor"];
  if (!key || !action || !validActions.includes(action)) {
    return NextResponse.json(
      { success: false, error: "Missing key or invalid action" },
      { status: 400 }
    );
  }

  await connectDB();

  const team = await Team.findOne({ teamWalletAddress: address, isActive: true });
  if (!team)
    return NextResponse.json({ success: false, error: t("teamNotFound") }, { status: 404 });
  const isMember = team.owner === wallet || team.members.some((m) => m.key === wallet);
  if (!isMember) {
    return NextResponse.json({ success: false, error: "Not a member" }, { status: 403 });
  }

  const existing = team.members.find((m) => m.key === key);

  if (action === "addVoter" || action === "addContributor") {
    const roleFlag =
      action === "addVoter" ? { "members.$.hasVoter": true } : { "members.$.hasContributor": true };

    if (existing) {
      await Team.updateOne({ teamWalletAddress: address, "members.key": key }, { $set: roleFlag });
    } else {
      await Team.updateOne(
        { teamWalletAddress: address },
        {
          $push: {
            members: {
              key,
              isOwner: false,
              hasVoter: action === "addVoter",
              hasContributor: action === "addContributor",
              addedAt: new Date(),
            },
          },
        }
      );
    }
  } else {
    if (existing) {
      const roleFlag =
        action === "removeVoter"
          ? { "members.$.hasVoter": false }
          : { "members.$.hasContributor": false };

      await Team.updateOne({ teamWalletAddress: address, "members.key": key }, { $set: roleFlag });

      const refreshed = await Team.findOne({ teamWalletAddress: address });
      const member = refreshed?.members.find((m) => m.key === key);
      if (member && !member.isOwner && !member.hasVoter && !member.hasContributor) {
        await Team.updateOne({ teamWalletAddress: address }, { $pull: { members: { key } } });
      }
    }
  }

  const updated = await Team.findOne({ teamWalletAddress: address }).select("-__v");
  return NextResponse.json({ success: true, data: updated });
}
