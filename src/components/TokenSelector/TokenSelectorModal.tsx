"use client";
/**
 * @component TokenSelectorModal
 *
 * Searchable full-screen modal for selecting a Jupiter-verified SPL token.
 *
 * Loads the verified token list, sorts tokens with wallet holdings first,
 * popular tokens (SOL, USDC, USDT, JUP, BONK) second, and the rest after.
 * Filters in real-time by symbol, name, or mint address prefix as the user
 * types. Shows quick-select chips for popular tokens when search is empty.
 * Closes on Escape key, backdrop click, or token selection.
 *
 * @dependencies
 * - `useJupiterTokenList` — verified token list with metadata and USD prices
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useJupiterTokenList } from "@/src/hooks/useTradeHooks";
import { SOL_MINT } from "@/src/lib/jupiter";
import { useTranslations } from "next-intl";
import Button from "../Button/ButtonVW";

export interface TokenOption {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  balance?: number;
  price?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenOption) => void;
  selectedMint?: string;
  title?: string;
  balances?: Record<string, { raw: string; ui: number }>;
}

const POPULAR = [
  SOL_MINT,
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
];

function Img({ src, alt, size }: { src: string | null; alt: string; size: number }) {
  const [err, setErr] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setErr(false);
  }
  if (!src || err)
    return (
      <div
        className="bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full font-bold"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {alt?.[0] || "?"}
      </div>
    );

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      onError={() => setErr(true)}
    />
  );
}

export default function TokenSelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedMint,
  title = "Select a token",
  balances,
}: Props) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: jupiterTokens, isLoading, error } = useJupiterTokenList();
  const t = useTranslations("token");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(isOpen);
    setSearch("");
  }
  if (!isOpen && prevIsOpen) {
    setPrevIsOpen(isOpen);
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const allTokens = useMemo((): TokenOption[] => {
    if (!jupiterTokens) return [];
    return jupiterTokens.map((t) => ({
      mint: t.address,
      symbol: t.symbol,
      name: t.name,
      logo: t.logoURI,
      decimals: t.decimals,
      balance: balances?.[t.address]?.ui,
      price: t.usdPrice,
    }));
  }, [jupiterTokens, balances]);

  const sorted = useMemo(() => {
    const w: TokenOption[] = [];
    const p: TokenOption[] = [];
    const r: TokenOption[] = [];
    for (const t of allTokens) {
      if (t.balance && t.balance > 0) w.push(t);
      else if (POPULAR.includes(t.mint)) p.push(t);
      else r.push(t);
    }
    w.sort((a, b) => (b.balance || 0) - (a.balance || 0));
    return [...w, ...p, ...r];
  }, [allTokens]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase().trim();
    return sorted.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.mint.toLowerCase().startsWith(q)
    );
  }, [sorted, search]);

  const pops = useMemo(() => allTokens.filter((t) => POPULAR.includes(t.mint)), [allTokens]);

  function pick(token: TokenOption) {
    onSelect(token);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center p-4 pt-[10vh] sm:pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-selector-title"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="bg-base-100 border-base-200 relative w-full max-w-105 overflow-hidden rounded-2xl border shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 id="token-selector-title" className="text-base font-bold">
            {title}
          </h3>

          <Button
            label={<X className="size-4" />}
            aria-label="Close token selector"
            size="xs"
            onClick={onClose}
            className="btn-square"
          />
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="text-neutral-content pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search name or paste address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tokens"
              className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/50 h-11 w-full rounded-xl border pr-4 pl-10 text-sm transition-colors outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="text-neutral-content hover:text-base-content absolute top-1/2 right-3.5 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {!search && pops.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex flex-wrap gap-2">
              {pops.map((t, i) => (
                <div
                  key={`p${i}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => pick(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(t);
                    }
                  }}
                  aria-label={`Select ${t.symbol}`}
                  className={`hover:border-primary/30 hover:bg-primary/5 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${selectedMint === t.mint ? "border-primary/40 bg-primary/5 text-primary" : "border-base-300 bg-base-200/40"}`}
                >
                  <Img src={t.logo} alt={t.symbol} size={20} />
                  {t.symbol}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-base-200 border-t" />

        <div
          className="max-h-90 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: "thin" }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="text-primary h-5 w-5 animate-spin" />
              <span className="text-neutral-content text-sm">{t("Loading tokens")}</span>
            </div>
          ) : error ? (
            <div className="px-5 py-10 text-center">
              <p className="text-error text-sm">{t("Failed to load tokens")}</p>
              <p className="text-neutral-content mt-1 text-xs">{String(error)}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-neutral-content text-sm">{t("No tokens found")}</p>
            </div>
          ) : (
            filtered.slice(0, 200).map((t, i) => {
              const sel = selectedMint === t.mint;
              return (
                <div
                  key={`t${i}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!sel) pick(t);
                  }}
                  onKeyDown={(e) => {
                    if (!sel && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      pick(t);
                    }
                  }}
                  aria-label={`${sel ? "Selected: " : "Select "}${t.symbol}`}
                  aria-pressed={sel || undefined}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${sel ? "bg-primary/5 cursor-default" : "hover:bg-base-200/50 cursor-pointer"}`}
                >
                  <Img src={t.logo} alt={t.symbol} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{t.symbol}</p>
                    <p className="text-neutral-content truncate text-xs">{t.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {t.balance !== undefined && t.balance > 0 && (
                      <p className="font-mono text-sm font-medium">
                        {t.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                    )}
                    {t.price && t.price > 0 && (
                      <p className="text-neutral-content text-xs">
                        ${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                  {sel && <div className="bg-primary h-2 w-2 shrink-0 rounded-full" />}
                </div>
              );
            })
          )}
        </div>

        <div className="border-base-200 border-t px-5 py-3">
          <p className="text-neutral-content text-center text-xs">
            {isLoading ? "Loading..." : `${filtered.length} tokens`}
          </p>
        </div>
      </div>
    </div>
  );
}
