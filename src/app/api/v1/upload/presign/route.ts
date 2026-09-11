/**
 * @module POST /api/v1/upload/presign
 *
 * Generates a pre-signed S3 PUT URL for direct client-to-S3 uploads.
 *
 * The client receives a short-lived (5-minute) signed URL and uploads
 * the file directly to S3 without the file passing through the server,
 * keeping AWS credentials entirely server-side. Only active when
 * UPLOAD_MODE=s3. Validates MIME type against an allow-list before
 * issuing the signed URL. Sanitises the filename to prevent S3 key
 * injection.
 *
 * @body    { fileName, contentType, folder? }
 * @returns { uploadUrl, publicUrl, key, expiresIn }
 */
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getTranslations } from "next-intl/server";

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const uploadMode = process.env.UPLOAD_MODE || process.env.NEXT_PUBLIC_UPLOAD_MODE;
  if (uploadMode !== "s3") {
    return NextResponse.json(
      { success: false, error: t("S3 uploads not enabled") },
      { status: 400 }
    );
  }

  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_S3_REGION || "us-east-1";

  if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return NextResponse.json({ success: false, error: t("S3 not configured") }, { status: 500 });
  }

  try {
    const { fileName, contentType, folder = "general" } = await req.json();
    if (!fileName || !contentType) {
      return NextResponse.json(
        { success: false, error: t("fileName and contentType required") },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ success: false, error: t("Invalid file type") }, { status: 400 });
    }

    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${folder}/${Date.now()}-${cleanName}`;

    const s3 = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      data: { uploadUrl, publicUrl, key, expiresIn: 300 },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `S3 error: ${error?.message || t("Unknown")}` },
      { status: 500 }
    );
  }
}
