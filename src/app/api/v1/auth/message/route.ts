/**
 *
 * Generates a one-time sign message for wallet authentication.
 *
 * Creates a cryptographically random nonce, builds the sign message,
 * persists a Nonce document to MongoDB with a 5-minute TTL, and returns
 * the nonce + message for the client to present to the wallet for signing.
 * Expired documents are cleaned up automatically via a MongoDB TTL index —
 * no manual cleanup is required.
 *
 * @returns { message, nonce, expiresAt }
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/src/lib/mongodb";
import { Nonce } from "@/src/models";
import { generateNonce, buildSignMessage } from "@/src/lib/auth";
import logger from "@/src/lib/logger";
import { getTranslations } from "next-intl/server";

export async function POST() {
  const t = await getTranslations("errormessageapi");
  try {
    const nonce = generateNonce();
    const message = buildSignMessage(nonce);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await connectDB();
    await Nonce.create({ nonce, message, expiresAt });

    return NextResponse.json({
      success: true,
      data: { message, nonce, expiresAt: expiresAt.getTime() },
    });
  } catch (error: any) {
    logger.error("Error on refresh token", error);
    return NextResponse.json({ success: false, error: t("internalError") }, { status: 500 });
  }
}
