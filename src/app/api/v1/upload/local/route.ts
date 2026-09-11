/**
 * @module POST /api/v1/upload/local
 *
 * Local filesystem upload endpoint for development environments.
 *
 * Saves an uploaded image to /public/uploads/<folder>/ and returns
 * the public URL. Enforces strict input validation: allowed MIME types
 * (JPEG, PNG, GIF, WebP), 5MB file size limit, sanitised folder names
 * and file extensions, and a path-traversal defense that verifies the
 * resolved file path stays within the upload root before writing.
 *
 * Not intended for production — use the S3 presign route instead.
 *
 * @body  multipart/form-data: { file, folder? }
 * @returns { url, fileName, folder }
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import logger from "@/src/lib/logger";
import { getTranslations } from "next-intl/server";
function sanitizeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function POST(req: NextRequest) {
  const wallet = req.headers.get("x-wallet-address");
  const t = await getTranslations("errormessageapi");
  if (!wallet) {
    return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const rawFolder = (formData.get("folder") as string) || "general";

    if (!file) {
      return NextResponse.json({ success: false, error: t("No file provided") }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Invalid file type" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: t("File too large max 5MB") },
        { status: 400 }
      );
    }

    const folder = sanitizeName(rawFolder) || "general";
    const rawExt = (file.name.split(".").pop() || "png").toLowerCase();
    const ext = sanitizeName(rawExt) || "png";

    const uploadRoot = path.resolve(
      process.cwd(),
      process.env.LOCAL_UPLOAD_DIR || "public/uploads"
    );
    const uploadDir = path.join(uploadRoot, folder);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    if (!path.resolve(filePath).startsWith(uploadRoot)) {
      logger.error("Path traversal blocked", { wallet, folder: rawFolder, fileName: file.name });
      return NextResponse.json({ success: false, error: t("Invalid path") }, { status: 400 });
    }

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const publicUrl = `/uploads/${folder}/${fileName}`;

    return NextResponse.json({
      success: true,
      data: { url: publicUrl, fileName, folder },
    });
  } catch (error: any) {
    logger.error("Error on image upload", { error, wallet });
    return NextResponse.json({ success: false, error: t("Upload failed") }, { status: 500 });
  }
}
