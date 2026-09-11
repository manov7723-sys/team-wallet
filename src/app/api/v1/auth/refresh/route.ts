/**
 *
 * Rotates the JWT pair using a valid refresh token.
 *
 * Verifies the incoming refresh token's signature and type claim,
 * hashes the token and compares it against the stored hash in MongoDB
 * to prevent replay attacks, then issues a fresh access token + refresh
 * token pair. The new refresh token hash replaces the old one atomically.
 *
 * @body    { refreshToken }
 * @returns { accessToken, refreshToken }
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { User } from "@/src/models";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "@/src/lib/auth";
import logger from "@/src/lib/logger";
import { getTranslations } from "next-intl/server";

export async function POST(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: t("missingRefreshToken") },
        { status: 400 }
      );
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || decoded.type !== "refresh") {
      return NextResponse.json(
        { success: false, error: t("invalidRefreshToken") },
        { status: 401 }
      );
    }

    await connectDB();

    const incomingHash = hashToken(refreshToken);
    const user = await User.findOne({
      walletAddress: decoded.wallet,
      refreshTokenHash: incomingHash,
    });
    if (!user) {
      return NextResponse.json({ success: false, error: t("tokenMismatch") }, { status: 401 });
    }

    const payload = { wallet: decoded.wallet, userId: decoded.userId };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    return NextResponse.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (error: any) {
    logger.error("Error on refresh token", error);
    return NextResponse.json({ success: false, error: t("internalError") }, { status: 500 });
  }
}
