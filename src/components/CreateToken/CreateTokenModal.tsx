"use client";
/**
 * CreateTokenModal Component
 *
 * A modal component for creating a fungible token or NFT on Solana using Token 2022 standard.
 * Supports uploading images to IPFS, setting metadata, configuring extensions (transfer fees, non-transferable, interest-bearing),
 * and building/executing Solana transactions.
 *
 * @component
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {() => void} props.onClose - Callback to close the modal
 * @param {(mintAddress: string) => void} [props.onCreated] - Optional callback called after successful token creation with the mint address
 *
 * @returns {JSX.Element | null} - The modal JSX when open, otherwise null
 *
 *
 * @typedef {"fungible" | "nft"} TokenType - Type of token
 *
 * @property {string} trait_type - Name/type of attribute
 * @property {string} value - Value of attribute
 */
import { useRef, useState } from "react";
import Button from "@/src/components/Button/ButtonVW";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useSaveToken } from "@/src/hooks/useApi";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { buildCreateTokenIx } from "@/src/lib/web3";
import { uploadImageToPinata, uploadMetadataJsonToPinata } from "@/src/lib/pinata";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Image as ImageLucide,
  Info,
  Key,
  Layers,
  Lock,
  Loader2,
  PackagePlus,
  Plus,
  Snowflake,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

type TokenType = "fungible" | "nft";
type Step = 1 | 2 | 3 | 4;

interface Attribute {
  trait_type: string;
  value: string;
}

interface CreateTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (mintAddress: string) => void;
}

export default function CreateTokenModal({ isOpen, onClose, onCreated }: CreateTokenModalProps) {
  const { activeTeam } = useActiveTeam();
  const t = useTranslations("token");
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const tx = useTransaction();
  const saveToken = useSaveToken();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [tokenType, setTokenType] = useState<TokenType>("fungible");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [decimals, setDecimals] = useState("9");
  const [supply, setSupply] = useState("");
  const [attributes, setAttributes] = useState<Attribute[]>([{ trait_type: "", value: "" }]);
  const [externalUrl, setExternalUrl] = useState("");
  const [enableFreeze, setEnableFreeze] = useState(true);
  const [enableMintAuth, setEnableMintAuth] = useState(true);
  const [enableTransferFee, setEnableTransferFee] = useState(false);
  const [transferFeeBps, setTransferFeeBps] = useState("100");
  const [enableNonTransferable, setEnableNonTransferable] = useState(false);
  const [enableInterestBearing, setEnableInterestBearing] = useState(false);
  const [interestRate, setInterestRate] = useState("5");
  const [createStatus, setCreateStatus] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "symbol" | "supply" | "decimals", string>>
  >({});

  const reset = () => {
    setStep(1);
    setTokenType("fungible");
    setName("");
    setSymbol("");
    setDescription("");
    setImageFile(null);
    setImagePreview(null);
    setDecimals("9");
    setSupply("");
    setAttributes([{ trait_type: "", value: "" }]);
    setExternalUrl("");
    setEnableFreeze(true);
    setEnableMintAuth(true);
    setEnableTransferFee(false);
    setTransferFeeBps("100");
    setEnableNonTransferable(false);
    setEnableInterestBearing(false);
    setInterestRate("5");
    setCreateStatus("");
    setErrors({});
    tx.reset();
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("Image must be under 5MB"));
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addAttribute = () => setAttributes([...attributes, { trait_type: "", value: "" }]);
  const removeAttribute = (i: number) => setAttributes(attributes.filter((_, idx) => idx !== i));
  const updateAttribute = (i: number, field: "trait_type" | "value", val: string) => {
    const updated = [...attributes];
    updated[i] = { ...updated[i], [field]: val };
    setAttributes(updated);
  };

  const validateStep2 = () => {
    if (name.trim().length <= 2) {
      setErrors((p) => ({ ...p, name: "Token name is atleast of 3 letters" }));
      return false;
    }
    if (symbol.trim().length === 0) {
      setErrors((p) => ({ ...p, symbol: "Token symbol is required" }));
      return false;
    }
    if (!imageFile && !imagePreview) {
      toast.error(t("Please upload an image for the token"));
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!supply || parseFloat(supply) <= 0) {
      setErrors((p) => ({ ...p, supply: "Supply must be greater than 0" }));
      return false;
    }
    return true;
  };

  const canCreate = () => {
    if (name.trim().length === 0) return false;
    if (symbol.trim().length === 0) return false;
    if (!imageFile && !imagePreview) return false;
    if (!supply || parseFloat(supply) <= 0) return false;
    if (errors.supply) return false;
    return !tx.isProcessing;
  };

  const baseFee = 0.00356;
  const extensionFees =
    (enableTransferFee ? 0.0015 : 0) +
    (enableNonTransferable ? 0.001 : 0) +
    (enableInterestBearing ? 0.001 : 0);
  const metadataFee = 0.002;
  const totalFee = baseFee + extensionFees + metadataFee + 0.000005;
  const short = (addr: string, chars = 4) => `${addr.slice(0, chars)}...${addr.slice(-chars)}`;

  const handleCreate = async () => {
    if (!publicKey || !activeTeam) {
      toast.error(t("Not connected"));
      return;
    }
    if (!activeTeam.isOwner && !activeTeam.isContributor) {
      toast.error(t("Only owners and contributors can create tokens"));
      return;
    }
    const teamPDA = new PublicKey(activeTeam.teamWalletAddress);
    const dec = tokenType === "nft" ? 0 : parseInt(decimals) || 9;

    let rawSupply: bigint;
    if (tokenType === "nft") {
      rawSupply = BigInt(parseInt(supply || "1"));
    } else {
      const [intPart, fracPart = ""] = supply.split(".");
      const paddedFrac = fracPart.padEnd(dec, "0").slice(0, dec);
      rawSupply = BigInt(intPart || "0") * BigInt(10) ** BigInt(dec) + BigInt(paddedFrac || "0");
    }

    try {
      setCreateStatus(t("Uploading image to IPFS"));
      let imageGatewayUrl = "";
      if (imageFile) {
        const imgResult = await uploadImageToPinata(imageFile);
        imageGatewayUrl = imgResult.gatewayUrl;
      }

      setCreateStatus(t("Uploading metadata to IPFS"));
      const validAttrs = attributes.filter((a) => a.trait_type.trim() && a.value.trim());
      const metaResult = await uploadMetadataJsonToPinata({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim() || undefined,
        image: imageGatewayUrl,
        attributes: validAttrs.length > 0 ? validAttrs : undefined,
        external_url: externalUrl.trim() || undefined,
      });

      setCreateStatus(t("Building transaction"));
      const mintKeypair = Keypair.generate();
      const { instructions } = await buildCreateTokenIx(connection, {
        payer: publicKey,
        mintKeypair,
        teamWalletPDA: teamPDA,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        uri: metaResult.gatewayUrl,
        decimals: dec,
        initialSupply: rawSupply,
        enableMintAuthority: enableMintAuth,
        enableFreezeAuthority: enableFreeze,
        transferFee: enableTransferFee ? { bps: parseInt(transferFeeBps) || 100 } : undefined,
        nonTransferable: enableNonTransferable || undefined,
        interestBearing: enableInterestBearing ? { rate: parseInt(interestRate) || 5 } : undefined,
      });

      setCreateStatus("");
      const result = await tx.execute(instructions, {
        signers: [mintKeypair],
        accountKeys: [mintKeypair.publicKey],
        successMessage: `${tokenType === "nft" ? "NFT" : "Token"} created!`,
        onConfirmed: async () => {
          await saveToken.mutateAsync({
            mintAddress: mintKeypair.publicKey.toBase58(),
            teamWalletAddress: activeTeam.teamWalletAddress,
            name: name.trim(),
            symbol: symbol.trim().toUpperCase(),
            decimals: dec,
            tokenType,
            initialSupply: rawSupply.toString(),
            metadataUri: metaResult.gatewayUrl,
            imageUrl: imageGatewayUrl,
            description: description.trim() || undefined,
            extensions: {
              ...(enableTransferFee
                ? { transferFee: { bps: parseInt(transferFeeBps) || 100 } }
                : {}),
              ...(enableNonTransferable ? { nonTransferable: true } : {}),
              ...(enableInterestBearing
                ? { interestBearing: { rate: parseInt(interestRate) || 5 } }
                : {}),
            },
          });
        },
      });
      if (result?.success) {
        onCreated?.(mintKeypair.publicKey.toBase58());
        setTimeout(handleClose, 1000);
      }
    } catch (err: any) {
      if (err?.message?.includes("User rejected")) return;
      toast.error(err.message || t("Token creation failed"));
      setCreateStatus("");
    }
  };

  if (!isOpen) return null;

  const steps =
    tokenType === "fungible"
      ? ["Type", "Token Info", "Extensions", "Confirm"]
      : ["Type", "NFT Info", "Extensions", "Confirm"];
  const statusMsg =
    createStatus ||
    (tx.isBuilding
      ? "Building transaction..."
      : tx.isSigning
        ? "Confirm in wallet..."
        : tx.isConfirming
          ? "Confirming on Solana..."
          : tx.isDone
            ? "Done!"
            : "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[5vh] sm:pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-token-title"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={handleClose}
      />
      <div className="bg-base-100 border-base-200 relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl">
        <div className="border-base-200 shrink-0 border-b px-6 pt-6 pb-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 id="create-token-title" className="flex items-center gap-2 text-lg font-bold">
              <PackagePlus className="text-primary h-5 w-5" />
              {t("Create")} {tokenType === "nft" ? "NFT" : "Token"}
            </h3>

            <Button
              label={<X className="size-4" />}
              size="xs"
              onClick={handleClose}
              className="btn-square"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-1 items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${step > i + 1 ? "bg-success text-success-content" : step === i + 1 ? "bg-primary text-primary-content" : "bg-base-200 text-neutral-content"}`}
                >
                  {step > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span
                  className={`hidden text-xs font-medium sm:block ${step === i + 1 ? "text-primary" : "text-neutral-content"}`}
                >
                  {s}
                </span>
                {i < steps.length - 1 && (
                  <div className={`h-px flex-1 ${step > i + 1 ? "bg-success" : "bg-base-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          style={{ scrollbarWidth: "thin" }}
        >
          {step === 1 && (
            <>
              <div>
                <h4 className="text-base font-semibold">{t("Choose token type")}</h4>
                <p className="text-neutral-content mt-1 text-sm">
                  {t("All tokens use Token 2022 with metadata on IPFS")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setTokenType("fungible");
                    setDecimals("9");
                    setSupply("");
                  }}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${tokenType === "fungible" ? "border-primary bg-primary/5 shadow-sm" : "border-base-300 hover:border-primary/20"}`}
                >
                  <div
                    className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${tokenType === "fungible" ? "bg-primary/10" : "bg-base-200"}`}
                  >
                    <Coins
                      className={`h-6 w-6 ${tokenType === "fungible" ? "text-primary" : "text-neutral-content"}`}
                    />
                  </div>
                  <p className="font-bold">Fungible Token</p>
                  <p className="text-neutral-content mt-1 text-xs">
                    {t("Custom supply decimals and metadata")}
                  </p>
                </button>
                <button
                  onClick={() => {
                    setTokenType("nft");
                    setDecimals("0");
                    setSupply("1");
                  }}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${tokenType === "nft" ? "border-accent bg-accent/5 shadow-sm" : "border-base-300 hover:border-accent/20"}`}
                >
                  <div
                    className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${tokenType === "nft" ? "bg-accent/10" : "bg-base-200"}`}
                  >
                    <ImageLucide
                      className={`h-6 w-6 ${tokenType === "nft" ? "text-accent" : "text-neutral-content"}`}
                    />
                  </div>
                  <p className="font-bold">{t("NFT")}</p>
                  <p className="text-neutral-content mt-1 text-xs">
                    {t("Non fungible with image and attributes")}
                  </p>
                </button>
              </div>
              <div className="bg-info/5 border-info/10 flex items-start gap-2 rounded-xl border p-3">
                <Info className="text-info mt-0.5 size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  <strong className="text-base-content">{t("Token 2022")}</strong>{" "}
                  {t("supports metadata pointers transfer fees non transferable tokens and more")}
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h4 className="text-base font-semibold">
                  {tokenType === "nft" ? "NFT" : "Token"} {t("Information")}
                </h4>
              </div>
              <div>
                <label className="text-neutral-content mb-2 block text-sm font-medium">
                  {tokenType === "nft" ? "NFT Image" : "Token Logo"}{" "}
                  {tokenType === "nft" && <span className="text-error">*</span>}
                </label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => !imagePreview && fileRef.current?.click()}
                    className={`relative h-24 w-24 ${tokenType === "nft" ? "rounded-xl" : "rounded-full"} border-base-300 hover:border-primary/30 group bg-base-200/50 flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed transition-colors`}
                  >
                    {imagePreview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview}
                          alt="Token"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                          >
                            <Trash2 className="h-5 w-5 text-white" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <Camera className="text-neutral-content/40 group-hover:text-primary h-7 w-7 transition-colors" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {imagePreview ? "Uploaded" : "Click to upload"}
                    </p>
                    <p className="text-neutral-content text-xs">
                      {t("PNG JPG or GIF Max 5MB Stored on IPFS")}
                      {tokenType === "nft" && !imagePreview && " *Required"}
                    </p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 flex justify-between">
                    <label className="text-neutral-content text-sm font-medium">
                      {t("Name")} <span className="text-error">*</span>
                    </label>
                    <span className="text-neutral-content/50 font-mono text-xs">
                      {name.length}/32
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder={tokenType === "nft" ? "e.g. Cool Ape #1" : "e.g. My Token"}
                    value={name}
                    onChange={(e) => {
                      let value = e.target.value;
                      value = value.replace(/[^a-zA-Z ]/g, "");
                      value = value.replace(/\s{2,}/g, " ");
                      if (value.startsWith(" ")) {
                        value = value.trimStart();
                      }
                      if (value.length > 32) return;
                      setName(value);
                      if (errors.name) {
                        setErrors((p) => ({ ...p, name: undefined }));
                      }
                    }}
                    className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-10 w-full rounded-xl border px-3 text-sm transition-colors outline-none"
                  />
                  {errors.name && <p className="text-error mt-1 text-xs">{errors.name}</p>}
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <label className="text-neutral-content text-sm font-medium">
                      {t("Symbol")} <span className="text-error">*</span>
                    </label>
                    <span className="text-neutral-content/50 font-mono text-xs">
                      {symbol.length}/10
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. MTK"
                    value={symbol}
                    onChange={(e) => {
                      let value = e.target.value.toUpperCase();
                      value = value.replace(/[^A-Z]/g, "");
                      if (value.length > 10) return;
                      setSymbol(value);
                      if (errors.symbol) {
                        setErrors((p) => ({ ...p, symbol: undefined }));
                      }
                    }}
                    className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-10 w-full rounded-xl border px-3 text-sm uppercase transition-colors outline-none"
                  />
                  {errors.symbol && <p className="text-error mt-1 text-xs">{errors.symbol}</p>}
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <label className="text-neutral-content text-sm font-medium">
                    {t("Description")}
                  </label>
                  <span className="text-neutral-content/50 font-mono text-xs">
                    {description.length}/500
                  </span>
                </div>
                <textarea
                  placeholder="Describe your token..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  rows={3}
                  className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 w-full resize-none rounded-xl border px-3 py-2 text-sm transition-colors outline-none"
                />
              </div>
              {tokenType === "fungible" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-content mb-1 block text-sm font-medium">
                      {t("Initial Supply")} <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1000000"
                      value={supply}
                      onChange={(e) => {
                        let value = e.target.value;
                        if (value === "") {
                          setSupply("");
                          setErrors((p) => ({ ...p, supply: undefined }));
                          return;
                        }
                        if (!/^\d*\.?\d*$/.test(value)) return;
                        if ((value.match(/\./g) || []).length > 1) return;

                        const [integerPart = "0", fracPart] = value.split(".");
                        if (integerPart.length > 9) return;

                        const dec = parseInt(decimals) || 0;
                        if (fracPart !== undefined && fracPart.length > dec)
                          value = value.slice(0, value.length - 1);

                        setSupply(value);
                        setErrors((p) => ({ ...p, supply: undefined }));

                        if (dec > 0 && value !== "") {
                          const [intPart, fracPartRaw = ""] = value.split(".");
                          const paddedFrac = fracPartRaw.padEnd(dec, "0").slice(0, dec);
                          const rawSupply =
                            BigInt(intPart || "0") * BigInt(10) ** BigInt(dec) +
                            BigInt(paddedFrac || "0");
                          const U64_MAX = BigInt("18446744073709551615");
                          if (rawSupply > U64_MAX) {
                            const maxAllowed = U64_MAX / BigInt(10) ** BigInt(dec);
                            setErrors((p) => ({
                              ...p,
                              supply: `Maximum supply for ${dec} decimals is ${maxAllowed.toLocaleString()}`,
                            }));
                          } else {
                            setErrors((p) => ({ ...p, supply: undefined }));
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (["-", "+", "e", "E"].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      inputMode="decimal"
                      className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-10 w-full [appearance:textfield] rounded-xl border px-3 font-mono text-sm transition-colors outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    {errors.supply && <p className="text-error mt-1 text-xs">{errors.supply}</p>}
                  </div>
                  <div>
                    <label className="text-neutral-content mb-1 block text-sm font-medium">
                      {t("Decimals")}
                    </label>
                    <select
                      value={decimals}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDecimals(val);
                        if (supply && supply !== "") {
                          const dec = parseInt(val) || 0;
                          const [, fracPart = ""] = supply.split(".");
                          if (fracPart.length > dec) {
                            setErrors((p) => ({
                              ...p,
                              supply: `Supply has ${fracPart.length} decimal places but decimals is set to ${dec}. Max allowed: ${dec} decimal places.`,
                            }));
                          } else {
                            setErrors((p) => ({ ...p, supply: undefined }));
                          }
                        }
                      }}
                      className="bg-base-200/60 border-base-300 focus:border-primary/40 h-10 w-full cursor-pointer rounded-xl border px-3 text-sm transition-colors outline-none"
                    >
                      {[0, 2, 4, 6, 8, 9].map((d) => (
                        <option key={d} value={d}>
                          {d}{" "}
                          {d === 9
                            ? "(like SOL)"
                            : d === 6
                              ? "(like USDC)"
                              : d === 0
                                ? "(whole)"
                                : ""}
                        </option>
                      ))}
                    </select>
                    {errors.decimals && (
                      <p className="text-error mt-1 text-xs">{errors.decimals}</p>
                    )}
                  </div>
                </div>
              )}
              {tokenType === "nft" && (
                <div>
                  <label className="text-neutral-content mb-1 block text-sm font-medium">
                    {t("Supply")}
                  </label>
                  <input
                    type="number"
                    placeholder="1"
                    value={supply}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setSupply("");
                        return;
                      }
                      const num = parseInt(val);
                      if (!isNaN(num) && num >= 1) {
                        setSupply(val);
                      }
                    }}
                    min="1"
                    className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-10 w-full [appearance:textfield] rounded-xl border px-3 font-mono text-sm transition-colors outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <p className="text-neutral-content mt-1 text-xs">
                    {t("Default is 1 for a unique NFT Set higher for editions")}
                  </p>
                </div>
              )}
              {tokenType === "nft" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-neutral-content text-sm font-medium">
                      {t("Attributes")}
                    </label>
                    <button
                      onClick={addAttribute}
                      className="text-primary flex items-center gap-1 text-xs hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      {t("Add")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {attributes.map((attr, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Trait type"
                          value={attr.trait_type}
                          onChange={(e) => updateAttribute(i, "trait_type", e.target.value)}
                          className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-9 flex-1 rounded-lg border px-3 text-sm outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={attr.value}
                          onChange={(e) => updateAttribute(i, "value", e.target.value)}
                          className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-9 flex-1 rounded-lg border px-3 text-sm outline-none"
                        />
                        <button
                          onClick={() => removeAttribute(i)}
                          disabled={attributes.length <= 1}
                          className={`rounded-lg p-1.5 ${attributes.length <= 1 ? "text-neutral-content/20" : "text-neutral-content hover:text-error hover:bg-error/10"} transition-colors`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="text-neutral-content mb-1 block text-sm font-medium">
                      {t("External URL optional")}
                    </label>
                    <input
                      type="url"
                      placeholder="https://myproject.com"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-9 w-full rounded-lg border px-3 text-sm outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h4 className="text-base font-semibold">{t("Token 2022 Extensions")}</h4>
                <p className="text-neutral-content mt-1 text-sm">
                  {t("Configure on-chain extensions and authority settings")}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-neutral-content text-xs font-semibold tracking-wider uppercase">
                  {t("Authority")}
                </p>
                <label className="bg-base-200/40 border-base-300 hover:border-primary/20 flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-success/10 flex h-8 w-8 items-center justify-center rounded-lg">
                      <Key className="text-success size-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("Mint Authority")}</p>
                      <p className="text-neutral-content text-xs">
                        {t("Can mint additional supply")}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={enableMintAuth}
                    onChange={(e) => setEnableMintAuth(e.target.checked)}
                  />
                </label>
                <label className="bg-base-200/40 border-base-300 hover:border-primary/20 flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-warning/10 flex h-8 w-8 items-center justify-center rounded-lg">
                      <Snowflake className="text-warning size-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("Freeze Authority")}</p>
                      <p className="text-neutral-content text-xs">
                        {t("Can freezethaw token accounts")}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={enableFreeze}
                    onChange={(e) => setEnableFreeze(e.target.checked)}
                  />
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-neutral-content text-xs font-semibold tracking-wider uppercase">
                  {t("Extensions")}
                </p>
                <label className="bg-base-200/40 border-base-300 hover:border-primary/20 flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-accent/10 flex h-8 w-8 items-center justify-center rounded-lg">
                      <Coins className="text-accent size-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("Transfer Fee")}</p>
                      <p className="text-neutral-content text-xs">
                        {t("Collect fee on every transfer")}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={enableTransferFee}
                    onChange={(e) => setEnableTransferFee(e.target.checked)}
                  />
                </label>
                {enableTransferFee && (
                  <div className="border-accent/20 ml-11 border-l-2 pl-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="100"
                        value={transferFeeBps}
                        onChange={(e) => setTransferFeeBps(e.target.value)}
                        className="bg-base-200/60 border-base-300 focus:border-primary/40 h-8 w-24 [appearance:textfield] rounded-lg border px-3 font-mono text-sm outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-neutral-content text-xs">
                        {t("bps")} ({((parseInt(transferFeeBps) || 0) / 100).toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                )}
                <label className="bg-base-200/40 border-base-300 hover:border-primary/20 flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-error/10 flex h-8 w-8 items-center justify-center rounded-lg">
                      <Lock className="text-error size-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t("NonTransferable")}{" "}
                        {tokenType === "nft" && (
                          <span className="text-accent ml-1 text-xs">(Soulbound)</span>
                        )}
                      </p>
                      <p className="text-neutral-content text-xs">
                        {t("Cannot be transferred after minting")}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={enableNonTransferable}
                    onChange={(e) => setEnableNonTransferable(e.target.checked)}
                  />
                </label>
                {tokenType === "fungible" && (
                  <label className="bg-base-200/40 border-base-300 hover:border-primary/20 flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-info/10 flex h-8 w-8 items-center justify-center rounded-lg">
                        <Layers className="text-info size-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t("Interest Bearing")}</p>
                        <p className="text-neutral-content text-xs">
                          {t("Display accruing interest")}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={enableInterestBearing}
                      onChange={(e) => setEnableInterestBearing(e.target.checked)}
                    />
                  </label>
                )}
                {enableInterestBearing && tokenType === "fungible" && (
                  <div className="border-info/20 ml-11 border-l-2 pl-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="5"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="bg-base-200/60 border-base-300 focus:border-primary/40 h-8 w-20 [appearance:textfield] rounded-lg border px-3 font-mono text-sm outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-neutral-content text-xs">% annual</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-warning/5 border-warning/10 flex items-start gap-2 rounded-xl border p-3">
                <Info className="text-warning mt-0.5 size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  {t("Extensions are")} <strong>{t("immutable after creation")}</strong>.
                </p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <h4 className="text-base font-semibold">{t("Review  Create")}</h4>
              </div>
              <div className="bg-base-200/40 border-base-300 rounded-xl border p-4">
                <div className="mb-4 flex items-center gap-4">
                  <div
                    className={`h-16 w-16 ${tokenType === "nft" ? "rounded-xl" : "rounded-full"} bg-base-300 border-base-300 flex shrink-0 items-center justify-center overflow-hidden border`}
                  >
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageLucide className="text-neutral-content/30 h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold">{name || "Unnamed"}</p>
                      {tokenType === "nft" && (
                        <span className="bg-accent/10 text-accent border-accent/20 rounded border px-1.5 py-0.5 text-xs font-bold">
                          {t("NFT")}
                        </span>
                      )}
                    </div>
                    <p className="text-neutral-content text-sm">{symbol || "???"}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Program")}</span>
                    <span className="font-mono font-medium">{t("Token 2022")}</span>
                  </div>
                  {tokenType === "fungible" && (
                    <div className="flex justify-between">
                      <span className="text-neutral-content">{t("Supply")}</span>
                      <span className="ml-20 truncate font-mono font-medium">
                        {parseFloat(supply || "0").toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: parseInt(decimals) || 0,
                        })}
                      </span>
                    </div>
                  )}
                  {tokenType === "fungible" && (
                    <div className="flex justify-between">
                      <span className="text-neutral-content">{t("Decimals")}</span>
                      <span className="font-mono font-medium">{decimals}</span>
                    </div>
                  )}
                  {tokenType === "nft" && (
                    <div className="flex justify-between">
                      <span className="text-neutral-content">{t("Supply")}</span>
                      <span className="font-mono font-medium">
                        {parseInt(supply || "1").toLocaleString()} (Non-fungible)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Mint Auth")}</span>
                    <span
                      className={
                        enableMintAuth ? "text-success font-medium" : "text-neutral-content/50"
                      }
                    >
                      {enableMintAuth ? "Team Wallet" : "Revoked"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Freeze Auth")}</span>
                    <span
                      className={
                        enableFreeze ? "text-warning font-medium" : "text-neutral-content/50"
                      }
                    >
                      {enableFreeze ? "Team Wallet" : "None"}
                    </span>
                  </div>
                  {(enableTransferFee || enableNonTransferable || enableInterestBearing) && (
                    <div className="border-base-300 mt-2 border-t pt-2">
                      <p className="text-neutral-content mb-1.5 text-xs font-semibold">
                        {t("Extensions")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {enableTransferFee && (
                          <span className="bg-accent/10 text-accent border-accent/20 rounded-full border px-2 py-0.5 text-xs font-medium">
                            {t("Fee")} {((parseInt(transferFeeBps) || 0) / 100).toFixed(2)}%
                          </span>
                        )}
                        {enableNonTransferable && (
                          <span className="bg-error/10 text-error border-error/20 rounded-full border px-2 py-0.5 text-xs font-medium">
                            {tokenType === "nft" ? "Soulbound" : "Non-Transferable"}
                          </span>
                        )}
                        {enableInterestBearing && (
                          <span className="bg-info/10 text-info border-info/20 rounded-full border px-2 py-0.5 text-xs font-medium">
                            {t("Interest:")} {interestRate}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {tokenType === "nft" && attributes.some((a) => a.trait_type && a.value) && (
                    <div className="border-base-300 mt-2 border-t pt-2">
                      <p className="text-neutral-content mb-1.5 text-xs font-semibold">
                        {t("Attributes")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {attributes
                          .filter((a) => a.trait_type && a.value)
                          .map((a, i) => (
                            <span
                              key={i}
                              className="bg-base-300 rounded-full px-2 py-0.5 text-xs font-medium"
                            >
                              {a.trait_type}: <strong>{a.value}</strong>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-warning/20 bg-warning/5 space-y-2 rounded-xl border p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Zap className="text-warning size-4.5" />
                  {t("Estimated Fees")}
                </h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Account rent")}</span>
                    <span className="font-mono">
                      {baseFee} {t("SOL")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Metadata")}</span>
                    <span className="font-mono">
                      {metadataFee} {t("SOL")}
                    </span>
                  </div>
                  {extensionFees > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-content">{t("Extensions")}</span>
                      <span className="font-mono">
                        {extensionFees.toFixed(4)} {t("SOL")}
                      </span>
                    </div>
                  )}
                  <div className="border-warning/20 flex justify-between border-t pt-1.5">
                    <span className="font-semibold">{t("Total")}</span>
                    <span className="text-warning font-mono font-bold">
                      ~{totalFee.toFixed(6)} {t("SOL")}
                    </span>
                  </div>
                </div>
              </div>
              {activeTeam && (
                <div className="bg-info/5 border-info/10 flex items-start gap-2 rounded-xl border p-3">
                  <Info className="text-info mt-0.5 size-4.5 shrink-0" />
                  <p className="text-neutral-content text-xs">
                    {t("Authorities")}{" "}
                    <span className="text-base-content font-mono">
                      {short(activeTeam.teamWalletAddress)}
                    </span>
                    . {t("Future actions require proposals")}
                  </p>
                </div>
              )}
              {statusMsg && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-3 rounded-xl border p-4">
                  {tx.isDone ? (
                    <Check className="text-success h-5 w-5 shrink-0" />
                  ) : (
                    <Loader2 className="text-primary h-5 w-5 shrink-0 animate-spin" />
                  )}
                  <p className="text-sm font-medium">{statusMsg}</p>
                </div>
              )}
              {tx.isError && tx.error && (
                <div className="bg-error/5 border-error/20 rounded-xl border p-3">
                  <p className="text-error text-sm">{tx.error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-base-200 flex shrink-0 gap-3 border-t px-6 py-4">
          {step > 1 && (
            <Button
              label={
                <>
                  <ChevronLeft className="size-4.5" />
                  {t("Back")}
                </>
              }
              variant="outline"
              onClick={() => setStep((step - 1) as Step)}
              disabled={tx.isProcessing || !!createStatus}
            />
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <Button
              label={
                <>
                  {t("Next")}
                  <ChevronRight className="size-4.5" />
                </>
              }
              variant="primary"
              onClick={() => {
                if (step === 2) {
                  if (!validateStep2()) return;
                }
                if (step === 3 && tokenType === "fungible") {
                  if (!validateStep3()) return;
                }
                setStep((step + 1) as Step);
              }}
              disabled={
                step === 2 &&
                (!name || !symbol || !!errors.supply || !!errors.name || !!errors.symbol)
              }
              className="flex-1"
            />
          ) : (
            <Button
              label={
                tx.isDone ? (
                  <>
                    <Check className="size-4.5" />
                    {t("Created")}
                  </>
                ) : (
                  <>
                    <Zap className="size-4.5" />
                    {t("Create")} {tokenType === "nft" ? "NFT" : "Token"}
                  </>
                )
              }
              variant="primary"
              onClick={handleCreate}
              disabled={!canCreate() || tx.isDone || !!createStatus}
              className="flex-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}
