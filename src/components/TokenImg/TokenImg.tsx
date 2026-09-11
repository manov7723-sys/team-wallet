"use client";
/**
 * @component TokenImg
 *
 * Smart token image component with automatic IPFS gateway fallback.
 *
 * Attempts to load the provided src URL first. On failure, extracts the
 * IPFS CID and cycles through fallback gateways (dweb.link → Pinata →
 * ipfs.io). Falls back to a lettered placeholder div on total failure.
 * Resets gateway state when the src prop changes. Supports both rounded
 * (circle) and rounded-lg display modes.
 */
import { useState } from "react";

const FALLBACK_GATEWAYS = [
  (cid: string) => `https://${cid}.ipfs.dweb.link/`,
  (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
];

function extractCid(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("ipfs://")) return url.slice(7);
  const pathMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (pathMatch) return pathMatch[1];
  const subMatch = url.match(/([a-zA-Z0-9]+)\.ipfs\./);
  if (subMatch) return subMatch[1];
  return null;
}

interface TokenImgProps {
  src: string | null;
  alt: string;
  size: number;
  className?: string;
  rounded?: boolean;
}

export default function TokenImg({
  src,
  alt,
  size,
  className = "",
  rounded = true,
}: TokenImgProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src);
  const [fallbackIdx, setFallbackIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const [prevSrc, setPrevSrc] = useState<string | null>(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setCurrentSrc(src);
    setFallbackIdx(0);
    setFailed(false);
  }

  const handleError = () => {
    if (!src) {
      setFailed(true);
      return;
    }
    const cid = extractCid(src);
    if (cid && fallbackIdx < FALLBACK_GATEWAYS.length) {
      const nextUrl = FALLBACK_GATEWAYS[fallbackIdx](cid);
      setFallbackIdx((i) => i + 1);
      setCurrentSrc(nextUrl);
      return;
    }
    setFailed(true);
  };

  const roundedClass = rounded ? "rounded-full" : "rounded-lg";

  if (!currentSrc || failed) {
    return (
      <div
        className={`${roundedClass} bg-primary/10 text-primary flex shrink-0 items-center justify-center font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {alt?.[0] || "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      width={size}
      height={size}
      className={`${roundedClass} shrink-0 object-cover ${className}`}
      onError={handleError}
    />
  );
}
