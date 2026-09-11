/**
 *
 * Server-side proxy for Pinata IPFS uploads.
 *
 * Keeps the PINATA_JWT secret server-side away from the browser.
 * Dispatches to one of two upload handlers based on the `type` query param:
 *   - `?type=image`    — multipart file upload via pinFileToIPFS
 *   - `?type=metadata` — JSON metadata upload via pinJSONToIPFS
 *
 * Both handlers return { cid, ipfsUri, gatewayUrl } on success.
 * Required fields for metadata: name, symbol, image.
 *
 * @returns { cid, ipfsUri, gatewayUrl }
 */
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || ""; 
const PINATA_API = "https://api.pinata.cloud";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export async function POST(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  if (!PINATA_JWT) {
    return NextResponse.json({ success: false, error: t("notConfigured") }, { status: 500 });
  }

  const type = req.nextUrl.searchParams.get("type");

  try {
    if (type === "image") {
      return await handleImageUpload(req);
    } else if (type === "metadata") {
      return await handleMetadataUpload(req);
    } else {
      return NextResponse.json({ success: false, error: t("invalidType") }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || t("uploadFailed") },
      { status: 500 }
    );
  }
}

async function handleImageUpload(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) {
    return NextResponse.json({ success: false, error: t("noFile") }, { status: 400 });
  }

  const pinataForm = new FormData();
  pinataForm.append("file", file);
  pinataForm.append(
    "pinataMetadata",
    JSON.stringify({ name: `token-image-${Date.now()}-${file.name}` })
  );
  pinataForm.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: pinataForm,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    return NextResponse.json(
      { success: false, error: `${t("imageUploadFailed")} (${res.status}): ${errText}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json({
    success: true,
    data: {
      cid: data.IpfsHash,
      ipfsUri: `ipfs://${data.IpfsHash}`,
      gatewayUrl: `${PINATA_GATEWAY}/${data.IpfsHash}`,
    },
  });
}

async function handleMetadataUpload(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const body = await req.json();
  const { name, symbol, description, image, attributes, external_url } = body;

  if (!name || !symbol || !image) {
    return NextResponse.json({ success: false, error: t("metadataRequired") }, { status: 400 });
  }

  const jsonBody = {
    name,
    symbol,
    description: description || "",
    image,
    ...(attributes?.length ? { attributes } : {}),
    ...(external_url ? { external_url } : {}),
  };

  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: jsonBody,
      pinataMetadata: { name: `token-metadata-${symbol}-${Date.now()}.json` },
      pinataOptions: { cidVersion: 1 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    return NextResponse.json(
      { success: false, error: `${t("jsonUploadFailed")} (${res.status}): ${errText}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json({
    success: true,
    data: {
      cid: data.IpfsHash,
      ipfsUri: `ipfs://${data.IpfsHash}`,
      gatewayUrl: `${PINATA_GATEWAY}/${data.IpfsHash}`,
    },
  });
}
