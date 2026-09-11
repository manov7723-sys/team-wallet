/**
 * @module GET /api/v1/users/me/access
 *
 * Returns the authenticated wallet's team access summary.
 *
 * Queries all active teams where the wallet is owner or a listed member,
 * then maps each team to a role descriptor (isOwner, isVoter,
 * isContributor, isMember) used by ActiveTeamProvider to populate the
 * team switcher and gate UI actions across the app.
 *
 * @returns { wallet, hasTeams, teamCount, teams: TeamAccess[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { Team } from "@/src/models";
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

  const teams = await Team.find({
    $or: [{ owner: wallet }, { "members.key": wallet }],
    isActive: true,
  })
    .select("teamWalletAddress name owner members threshold image")
    .sort({ createdAt: -1 });

  const access = teams.map((team) => {
    const isOwner = team.owner === wallet;
    const member = team.members.find((m) => m.key === wallet);
    return {
      teamWalletAddress: team.teamWalletAddress,
      name: team.name,
      image: team.image,
      threshold: team.threshold,
      memberCount: team.members.length,
      isOwner,
      isVoter: member?.hasVoter ?? isOwner,
      isContributor: member?.hasContributor ?? isOwner,
      isMember: !!member || isOwner,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      wallet,
      hasTeams: teams.length > 0,
      teamCount: teams.length,
      teams: access,
    },
  });
}
