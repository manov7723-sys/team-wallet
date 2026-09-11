/**
 *
 * Wallet-based authentication endpoint.
 *
 * Validates the submitted nonce against MongoDB using an atomic
 * findOneAndDelete (ensuring single-use), verifies the Ed25519 wallet
 * signature against the stored message, upserts the User document,
 * and issues a JWT access token (1h) + refresh token (7d).
 * The refresh token is stored as a SHA-256 hash — raw JWTs are never
 * persisted to the database.
 *
 * @body  { walletAddress, signature, nonce }
 * @returns { user, accessToken, refreshToken }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { User, Nonce } from "@/src/models";
import {
  verifySignature,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "@/src/lib/auth";
import logger from "@/src/lib/logger";
import { getTranslations } from "next-intl/server";

export async function POST(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  try {
    const { walletAddress, signature, nonce } = await req.json();

    if (!walletAddress || !signature || !nonce) {
      return NextResponse.json({ success: false, error: t("missingFields") }, { status: 400 });
    }

    await connectDB();

    const stored = await Nonce.findOneAndDelete({ nonce });
    if (!stored) {
      return NextResponse.json({ success: false, error: t("invalidNonce") }, { status: 400 });
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: t("nonceExpired") }, { status: 400 });
    }

    const isValid = verifySignature(walletAddress, stored.message, signature);
    if (!isValid) {
      return NextResponse.json({ success: false, error: t("invalidSignature") }, { status: 401 });
    }

    // ── Registration gate: only allow existing wallets ───────
    const user = await User.findOne({ walletAddress });
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "New registrations are currently restricted. Please contact Tecneural to get access.",
        },
        { status: 403 },
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = { wallet: walletAddress, userId: user._id.toString() };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    return NextResponse.json({
      success: true,
      data: {
        user: {
          walletAddress: user.walletAddress,
          name: user.name,
          avatar: user.avatar,
          email: user.email,
          bio: user.bio,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    logger.error("Error on login", error);
    return NextResponse.json({ success: false, error: t("internalError") }, { status: 500 });
  }
}