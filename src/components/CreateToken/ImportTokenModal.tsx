"use client";
/**
 * ImportTokenModal Component
 *
 * A modal component that allows importing an existing SPL token or Token-2022/NFT
 * into the team wallet by transferring its mint authority (and optionally freeze authority).
 * Fetches token metadata from on-chain and external URI, displays token info,
 * validates user permissions, and executes authority transfer transactions.
 *
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.isOpen - Whether the modal is currently open
 * @param {() => void} props.onClose - Callback function invoked when modal is closed
 * @param {(mintAddress: string) => void} [props.onImported] - Optional callback invoked after successful import with the token mint address
 *
 * @returns {JSX.Element | null} Returns the modal JSX element if `isOpen` is true; otherwise returns null
 *
 * @property {string} address - Token mint address
 * @property {string} name - Token name
 * @property {string} symbol - Token symbol
 * @property {string} uri - Metadata URI for the token
 * @property {string} imageUrl - Image URL for token/logo
 * @property {number} decimals - Number of token decimals
 * @property {string} supply - Total token supply
 * @property {string | null} mintAuthority - Current mint authority address (or null if revoked)
 * @property {string | null} freezeAuthority - Current freeze authority address (or null if none)
 * @property {boolean} isToken2022 - True if token uses Token-2022 program
 * @property {boolean} isNft - True if token is an NFT (decimals = 0, supply <= 1)

 */
import { useState } from "react";
import Button from "@/src/components/Button/ButtonVW";
import Input from "@/src/components/Input/InputVW";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useSaveToken } from "@/src/hooks/useApi";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  getMint,
  getTokenMetadata,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { buildTransferMintAuthorityIx, buildTransferFreezeAuthorityIx } from "@/src/lib/web3";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  ImageIcon,
  Info,
  Key,
  Loader2,
  Shield,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { explorerAddressLink } from "@/src/lib/explorer";
import { useTranslations } from "next-intl";

interface ImportTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: (mintAddress: string) => void;
}

interface MintInfo {
  address: string;
  name: string;
  symbol: string;
  uri: string;
  imageUrl: string;
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isToken2022: boolean;
  isNft: boolean;
}

export default function ImportTokenModal({ isOpen, onClose, onImported }: ImportTokenModalProps) {
  const { activeTeam } = useActiveTeam();
  const { publicKey } = useWallet();
  const t = useTranslations("token");
  const { connection } = useConnection();
  const tx = useTransaction();
  const saveToken = useSaveToken();

  const [mintAddress, setMintAddress] = useState("");
  const [mintInfo, setMintInfo] = useState<MintInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferFreeze, setTransferFreeze] = useState(true);

  const walletAddress = publicKey?.toBase58() || "";
  const teamAddress = activeTeam?.teamWalletAddress || "";

  const reset = () => {
    setMintAddress("");
    setMintInfo(null);
    setLoading(false);
    setError(null);
    setTransferFreeze(true);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleLookup = async () => {
    setError(null);
    setMintInfo(null);
    const addr = mintAddress.trim();
    if (!addr) {
      setError(t("Enter a mint address"));
      return;
    }

    let pk: PublicKey;
    try {
      pk = new PublicKey(addr);
    } catch {
      setError(t("Invalid address"));
      return;
    }

    setLoading(true);
    try {
      let mintData: any;
      let isToken2022 = true;
      try {
        mintData = await getMint(connection, pk, "confirmed", TOKEN_2022_PROGRAM_ID);
      } catch {
        mintData = await getMint(connection, pk, "confirmed", TOKEN_PROGRAM_ID);
        isToken2022 = false;
      }

      let name = "",
        symbol = "",
        uri = "",
        imageUrl = "";
      try {
        const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
        const meta = await getTokenMetadata(connection, pk, "confirmed", programId);
        if (meta) {
          name = meta.name || "";
          symbol = meta.symbol || "";
          uri = meta.uri || "";
        }
      } catch {}

      if (uri) {
        try {
          const res = await fetch(uri);
          const json = await res.json();
          imageUrl = json.image || json.icon || "";
        } catch {}
      }

      const isNft = mintData.decimals === 0 && Number(mintData.supply) <= 1;

      setMintInfo({
        address: addr,
        name: name || (isNft ? `NFT ${addr.slice(0, 6)}` : addr.slice(0, 8)),
        symbol: symbol || "???",
        uri,
        imageUrl,
        isToken2022,
        isNft,
        decimals: mintData.decimals,
        supply: mintData.supply.toString(),
        mintAuthority: mintData.mintAuthority?.toBase58() || null,
        freezeAuthority: mintData.freezeAuthority?.toBase58() || null,
      });
    } catch {
      setError(t("Token not found onchain"));
    } finally {
      setLoading(false);
    }
  };

  const isContributorOrOwner = activeTeam?.isOwner || activeTeam?.isContributor;
  const canImport = mintInfo && mintInfo.mintAuthority === walletAddress && isContributorOrOwner;
  const alreadyTeamOwned = mintInfo?.mintAuthority === teamAddress;

  const handleImport = async () => {
    if (!publicKey || !activeTeam || !mintInfo) return;
    if (!isContributorOrOwner) {
      toast.error(t("Only owners and contributors can import tokens"));
      return;
    }
    if (mintInfo.mintAuthority !== walletAddress) {
      toast.error(t("You must be the current mint authority"));
      return;
    }

    const provider = tx.getProvider();
    if (!provider) {
      toast.error(t("Wallet not connected"));
      return;
    }

    const mint = new PublicKey(mintInfo.address);
    const teamPDA = new PublicKey(teamAddress);
    const instructions = [];

    const { instructions: mintAuthIxs } = await buildTransferMintAuthorityIx(
      provider,
      teamPDA,
      mint
    );
    instructions.push(...mintAuthIxs);

    if (transferFreeze && mintInfo.freezeAuthority === walletAddress) {
      const { instructions: freezeAuthIxs } = await buildTransferFreezeAuthorityIx(
        provider,
        teamPDA,
        mint
      );
      instructions.push(...freezeAuthIxs);
    }

    const result = await tx.execute(instructions, {
      accountKeys: [mint, teamPDA],
      successMessage: "Token imported!",
      onConfirmed: async () => {
        await saveToken.mutateAsync({
          mintAddress: mintInfo.address,
          teamWalletAddress: teamAddress,
          name: mintInfo.name,
          symbol: mintInfo.symbol,
          decimals: mintInfo.decimals,
          tokenType: mintInfo.isNft ? "nft" : "fungible",
          initialSupply: mintInfo.supply,
          metadataUri: mintInfo.uri,
          imageUrl: mintInfo.imageUrl,
          imported: true,
        });
      },
    });

    if (result?.success) {
      onImported?.(mintInfo.address);
      setTimeout(handleClose, 1000);
    }
  };

  if (!isOpen) return null;

  const short = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-token-title"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={handleClose}
      />
      <div className="bg-base-100 border-base-200 relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <h3 id="import-token-title" className="flex items-center gap-2 text-lg font-bold">
            <Download className="text-primary h-5 w-5" />
            {t("Import Token")}
          </h3>

          <Button
            label={<X className="size-4" />}
            size="xs"
            onClick={handleClose}
            className="btn-square"
          />
        </div>

        <div className="space-y-4 px-6 pb-6">
          <p className="text-neutral-content text-sm">
            {t("Import an existing token by transferring its mint authority to the team wallet")}
          </p>

          <div>
            <Input
              label="Mint Address"
              placeholder="Enter SPL token mint address"
              value={mintAddress}
              onChange={(e) => {
                setMintAddress(e.target.value);
                setMintInfo(null);
                setError(null);
              }}
              maxLength={44}
            />
            <Button
              label={
                loading ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" />
                    {t("Looking up")}
                  </>
                ) : (
                  "Lookup Token"
                )
              }
              variant="primary"
              fullWidth
              onClick={handleLookup}
              disabled={loading || !mintAddress.trim()}
              className="mt-4"
            />
          </div>

          {error && (
            <div className="bg-error/5 border-error/20 flex items-center gap-2 rounded-xl border p-3">
              <AlertTriangle className="text-error size-4.5 shrink-0" />
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {mintInfo && (
            <div className="space-y-3">
              <div className="bg-base-200/40 border-base-300 rounded-xl border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="bg-base-300 border-base-300 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
                    {mintInfo.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mintInfo.imageUrl}
                        alt={mintInfo.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="text-neutral-content/30 h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{mintInfo.name}</p>
                    <p className="text-neutral-content text-xs">
                      {mintInfo.symbol} · {mintInfo.isToken2022 ? "Token-2022" : "SPL Token"}
                    </p>
                  </div>
                  <a
                    href={explorerAddressLink(mintInfo.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-base-200 text-neutral-content hover:text-primary rounded-lg p-1.5"
                  >
                    <ExternalLink className="size-4.5" />
                  </a>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Supply")}</span>
                    <span className="font-mono">{parseInt(mintInfo.supply).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Decimals")}</span>
                    <span className="font-mono">{mintInfo.decimals}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-content flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      {t("Mint Auth")}
                    </span>
                    <span
                      className={`font-mono text-xs ${mintInfo.mintAuthority === walletAddress ? "text-success" : mintInfo.mintAuthority ? "text-warning" : "text-neutral-content/50"}`}
                    >
                      {mintInfo.mintAuthority ? short(mintInfo.mintAuthority) : "Revoked"}
                      {mintInfo.mintAuthority === walletAddress && " (you)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-content flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {t("Freeze Auth")}
                    </span>
                    <span
                      className={`font-mono text-xs ${mintInfo.freezeAuthority === walletAddress ? "text-success" : mintInfo.freezeAuthority ? "text-warning" : "text-neutral-content/50"}`}
                    >
                      {mintInfo.freezeAuthority ? short(mintInfo.freezeAuthority) : "None"}
                      {mintInfo.freezeAuthority === walletAddress && " (you)"}
                    </span>
                  </div>
                </div>
              </div>

              {alreadyTeamOwned && (
                <div className="bg-info/5 border-info/20 flex items-center gap-2 rounded-xl border p-3">
                  <Info className="text-info size-4.5 shrink-0" />
                  <p className="text-neutral-content text-sm">
                    {t("This token is already controlled by the team wallet")}
                  </p>
                </div>
              )}

              {!alreadyTeamOwned && !isContributorOrOwner && (
                <div className="bg-warning/5 border-warning/20 flex items-start gap-2 rounded-xl border p-3">
                  <AlertTriangle className="text-warning mt-0.5 size-4.5 shrink-0" />
                  <p className="text-neutral-content text-xs">
                    {t("Only team owners and contributors can import tokens")}
                  </p>
                </div>
              )}

              {!alreadyTeamOwned &&
                isContributorOrOwner &&
                mintInfo.mintAuthority !== walletAddress && (
                  <div className="bg-warning/5 border-warning/20 flex items-start gap-2 rounded-xl border p-3">
                    <AlertTriangle className="text-warning mt-0.5 size-4.5 shrink-0" />
                    <p className="text-neutral-content text-xs">
                      {t(
                        "You must be the current mint authority to import this token Current authority"
                      )}
                      :{" "}
                      <span className="font-mono">
                        {mintInfo.mintAuthority ? short(mintInfo.mintAuthority) : "revoked"}
                      </span>
                    </p>
                  </div>
                )}

              {canImport && mintInfo.freezeAuthority === walletAddress && (
                <label className="bg-base-200/40 border-base-300 flex cursor-pointer items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("Also transfer freeze authority")}</p>
                    <p className="text-neutral-content text-xs">
                      {t("Recommended for full team control")}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={transferFreeze}
                    onChange={(e) => setTransferFreeze(e.target.checked)}
                  />
                </label>
              )}

              {tx.isProcessing && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-3 rounded-xl border p-3">
                  <Loader2 className="text-primary size-4.5 animate-spin" />
                  <p className="text-sm">
                    {tx.isSigning ? "Confirm in wallet..." : "Confirming..."}
                  </p>
                </div>
              )}
              {tx.isError && tx.error && (
                <div className="bg-error/5 border-error/20 rounded-xl border p-3">
                  <p className="text-error text-sm">{tx.error}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              label="Cancel"
              variant="outline"
              fullWidth
              onClick={handleClose}
              disabled={tx.isProcessing}
              className="flex-1"
            />
            {mintInfo && canImport && (
              <Button
                label={
                  tx.isDone ? (
                    <>
                      <Check className="size-4.5" />
                      {t("Imported")}
                    </>
                  ) : (
                    "Import Token"
                  )
                }
                variant="primary"
                fullWidth
                onClick={handleImport}
                disabled={tx.isProcessing || tx.isDone}
                className="flex-1"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
