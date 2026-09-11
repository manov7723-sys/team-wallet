"use client";
/**
 * CreateTeam Component
 *
 * @description
 * A multi-step UI for creating a multi-signature team wallet on Solana.
 * Users can:
 * - Upload a team image
 * - Define a team name
 * - Add and validate member wallet addresses
 * - Configure approval threshold
 * - Deploy the team wallet on-chain
 *
 * Integrates with:
 * - Solana wallet adapter for transaction signing
 * - Backend API for persisting team data
 * - File upload service for team image
 * - Transaction handler for on-chain execution
 *
 * @returns {JSX.Element | null}
 * Returns the Create Team interface if authenticated,
 * a loading state while auth is in progress,
 * or null if the user is not authenticated.
 */
import { useRef, useState, useEffect, useMemo } from "react";
import Button from "@/src/components/Button/ButtonVW";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Trash2,
  UserCircle,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/src/providers/AuthProvider";
import { useApi, useUpload, useInvalidateTeamAccess } from "@/src/hooks/useApi";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getTeamWalletPDA, buildInitializeTeamWalletIx } from "@/src/lib/web3";
import { useTranslations } from "next-intl";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";

interface MemberEntry {
  address: string;
  name: string;
  error: string | null;
}

function validateSolanaAddress(address: string): boolean {
  try {
    const pk = new PublicKey(address);
    return PublicKey.isOnCurve(pk.toBytes());
  } catch {
    return false;
  }
}

export default function CreateTeam() {
  const router = useRouter();
  const t = useTranslations("create");
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const api = useApi();
  const { publicKey } = useWallet();
  const uploadMutation = useUpload();
  const invalidateTeamAccess = useInvalidateTeamAccess();
  const tx = useTransaction();
  const { connection } = useConnection();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading">("idle");
  const { setActiveTeamAddress } = useActiveTeam();
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState("");
  const [teamImage, setTeamImage] = useState<string | null>(null);
  const [teamImageFile, setTeamImageFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(2);

  const MAX_NAME = 32;
  const MAX_MEMBERS = 15;

  const TEAM_WALLET_ACCOUNT_SIZE =
    8 + 32 + (4 + MAX_NAME) + (4 + 32 * MAX_MEMBERS) + (4 + 32 * MAX_MEMBERS) + 1 + 1 + 8 + 1;
  const rentLamports = useMemo(() => {
    return Math.ceil(TEAM_WALLET_ACCOUNT_SIZE * 6960 + 890880);
  }, [TEAM_WALLET_ACCOUNT_SIZE]);
  const rentSOL = rentLamports / LAMPORTS_PER_SOL;
  const txFee = 0.000005;
  const totalFee = rentSOL + txFee;

  const ownerAddress = publicKey?.toBase58() || "";
  const [members, setMembers] = useState<MemberEntry[]>([
    { address: "", name: "", error: null },
    { address: "", name: "", error: null },
    { address: "", name: "", error: null },
  ]);

  const ownerName = user?.name || "";
  if (ownerAddress && (members[0].address !== ownerAddress || members[0].name !== ownerName)) {
    setMembers((prev) => {
      const updated = [...prev];
      updated[0] = { ...updated[0], address: ownerAddress, name: ownerName };
      return updated;
    });
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="z-10 mx-auto flex w-full max-w-xl items-center justify-center py-20">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary" />
          <p className="text-neutral-content mt-3 text-sm">{t("Loading")}</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const validateMember = (index: number, address: string): string | null => {
    if (!address.trim()) return null;
    if (!validateSolanaAddress(address)) return "Invalid Solana address";
    const dupes = members.filter((m, i) => i !== index && m.address.trim() === address.trim());
    if (dupes.length > 0) return "Duplicate address";
    return null;
  };

  const updateMember = (index: number, field: "address" | "name", value: string) => {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "address") {
        updated[index].error = validateMember(index, value);
      }
      return updated;
    });
  };

  const addMember = () => {
    if (members.length >= MAX_MEMBERS) {
      toast.error(`Maximum ${MAX_MEMBERS} members`);
      return;
    }
    setMembers([...members, { address: "", name: "", error: null }]);
  };

  const removeMember = (index: number) => {
    if (index === 0) return;
    if (members.length <= 3) {
      toast.error(t("Minimum 3 members required"));
      return;
    }
    const updated = members.filter((_, i) => i !== index);
    setMembers(updated);
    if (threshold > updated.length) setThreshold(updated.length);
  };

  const filledMembers = members.filter((m) => m.address.trim() && !m.error);
  const hasErrors = members.some((m) => m.error);
  const voterCount = filledMembers.length;
  const isOddCount = voterCount % 2 === 1;

  const canProceedStep1 = teamName.trim().length >= 3;
  const canProceedStep2 = filledMembers.length >= 3 && !hasErrors && isOddCount;
  const canCreate = canProceedStep1 && canProceedStep2 && threshold >= 1 && threshold <= voterCount;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("Max 5MB"));
      return;
    }
    setTeamImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setTeamImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!publicKey) {
      toast.error(t("Wallet not connected"));
      return;
    }

    const provider = tx.getProvider();
    if (!provider) {
      toast.error(t("Wallet not connected"));
      return;
    }

    let imageUrl: string | undefined;
    if (teamImageFile) {
      setUploadStatus("uploading");
      try {
        const result = await uploadMutation.mutateAsync({ file: teamImageFile, folder: "teams" });
        imageUrl = result.url;
      } catch {}
      setUploadStatus("idle");
    }

    const name = teamName.trim();
    const [teamWalletPDA] = getTeamWalletPDA(publicKey, name);
    const existingAccount = await connection.getAccountInfo(teamWalletPDA);
    if (existingAccount !== null) {
      toast.error(t("A team with this name already exists Please choose a different name"));
      return;
    }

    const voterPubkeys = filledMembers
      .filter((m) => m.address !== ownerAddress)
      .map((m) => new PublicKey(m.address));

    const { instructions } = await buildInitializeTeamWalletIx(
      provider,
      teamWalletPDA,
      name,
      threshold,
      voterPubkeys
    );

    const result = await tx.execute(instructions, {
      accountKeys: [teamWalletPDA],
      successMessage: "Team wallet created!",
      onConfirmed: async () => {
        const memberData = filledMembers.map((m) => ({
          key: m.address,
          name: m.name || undefined,
        }));

        await api.teams.create({
          teamWalletAddress: teamWalletPDA.toBase58(),
          name,
          members: memberData,
          threshold,
          image: imageUrl,
        });
        setActiveTeamAddress(teamWalletPDA.toBase58());
        invalidateTeamAccess();
      },
    });

    if (result?.success) {
      setTimeout(() => router.push("/dashboard"), 1500);
    }
  };

  const stepLabels = ["Team Info", "Members", "Confirm"];

  const getStatusMessage = () => {
    if (uploadStatus === "uploading") return "Uploading team image...";
    if (tx.isBuilding) return "Building transaction...";
    if (tx.isSigning) return "Confirm in your wallet...";
    if (tx.isConfirming) return "Confirming on Solana...";
    if (tx.isDone) return "Team created! Redirecting...";
    return "";
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-xl">
      <div className="bg-base-100 border-base-200 rounded-2xl border shadow-md">
        <div className="border-base-200 border-b px-6 pt-6 pb-4">
          <div className="flex items-center">
            {stepLabels.map((label, i) => {
              const s = i + 1;
              const isCompleted = step > s;
              const isActive = step === s;
              return (
                <div key={s} className="flex flex-1 items-center last:flex-initial">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ring-4 transition-all duration-300 ${isCompleted ? "bg-success text-success-content ring-success/20" : isActive ? "bg-primary text-primary-content ring-primary/20" : "bg-base-200 text-neutral-content/60 ring-base-200/50"}`}
                    >
                      {isCompleted ? <Check className="size-4.5" /> : s}
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${isActive ? "text-primary" : isCompleted ? "text-success" : "text-neutral-content/60"}`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div
                      className={`mx-3 mb-5 h-0.5 flex-1 rounded-full transition-colors duration-300 ${step > s ? "bg-success" : "bg-base-200"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">{t("Create your team")}</h2>
                <p className="text-neutral-content mt-1 text-sm">
                  {t("Set up your multi-sig team wallet on Solana")}
                </p>
              </div>

              <div>
                <label className="text-neutral-content mb-2 block text-sm font-medium">
                  {t("teamImage")}
                </label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => !teamImage && fileRef.current?.click()}
                    className="border-base-300 hover:border-primary/30 group bg-base-200/50 relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors"
                  >
                    {teamImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={teamImage} alt="Team" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTeamImage(null);
                              setTeamImageFile(null);
                              if (fileRef.current) fileRef.current.value = "";
                            }}
                            className="text-white"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <Camera className="text-neutral-content/40 group-hover:text-primary h-6 w-6 transition-colors" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm">{teamImage ? "Photo uploaded" : "Click to upload"}</p>
                    <p className="text-neutral-content text-xs">{t("JPG or PNG max 5MB")}</p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-neutral-content text-sm font-medium">Team Name</label>
                  <span
                    className={`font-mono text-xs ${teamName.length > MAX_NAME - 5 ? "text-warning" : "text-neutral-content/50"}`}
                  >
                    {teamName.length}/{MAX_NAME}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Alpha Treasury"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value.slice(0, MAX_NAME))}
                  className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/50 h-11 w-full rounded-xl border px-4 text-sm transition-colors outline-none"
                  maxLength={MAX_NAME}
                />
                {teamName.trim().length > 0 && teamName.trim().length < 3 && (
                  <p className="text-error mt-1 text-xs">
                    {t("Name must be at least 3 characters")}
                  </p>
                )}
              </div>

              <div style={{ paddingTop: "8px" }}>
                <Button
                  label={
                    <>
                      {t("Next")}
                      <ChevronRight className="size-4.5" />
                    </>
                  }
                  variant="primary"
                  fullWidth
                  disabled={!canProceedStep1}
                  onClick={() => setStep(2)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">{t("Add team members")}</h2>
                <p className="text-neutral-content mt-1 text-sm">
                  {t("memberInfo", {
                    max: MAX_MEMBERS,
                    count: voterCount,
                  })}{" "}
                  {hasErrors && <span className="text-error ml-1">{t("fixErrors")}</span>}
                </p>
              </div>

              {voterCount >= 2 && !isOddCount && (
                <div className="bg-warning/5 border-warning/20 flex items-start gap-2 rounded-xl border p-3">
                  <AlertTriangle className="text-warning mt-0.5 size-4.5 shrink-0" />
                  <p className="text-neutral-content text-xs">
                    <strong className="text-warning">Odd number required.</strong> You have{" "}
                    {voterCount} members — add or remove one to get an odd count. This prevents tie
                    votes in threshold approvals.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {members.map((m, i) => {
                  const isOwner = i === 0;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-xl border p-3 ${m.error ? "bg-error/5 border-error/30" : "bg-base-200/40 border-base-300"}`}
                    >
                      <div
                        className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isOwner ? "bg-primary/20 text-primary" : "bg-base-300 text-neutral-content"}`}
                      >
                        {isOwner ? <UserCircle className="size-4.5" /> : i + 1}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Wallet address"
                          value={m.address}
                          onChange={(e) => updateMember(i, "address", e.target.value)}
                          disabled={isOwner}
                          className={`focus:border-primary/40 placeholder:text-neutral-content/40 h-9 w-full rounded-lg border px-3 font-mono text-sm transition-colors outline-none ${isOwner ? "bg-base-200/80 border-base-300 text-neutral-content cursor-not-allowed" : "bg-base-100 border-base-300"}`}
                          maxLength={44}
                        />
                        {m.error && <p className="text-error text-xs">{m.error}</p>}
                        <input
                          type="text"
                          placeholder={isOwner ? "Owner" : "Display name (optional)"}
                          value={m.name}
                          onChange={(e) => updateMember(i, "name", e.target.value)}
                          disabled={isOwner}
                          className={`focus:border-primary/40 placeholder:text-neutral-content/40 h-8 w-full rounded-lg border px-3 text-xs transition-colors outline-none ${isOwner ? "bg-base-200/80 border-base-300 text-neutral-content cursor-not-allowed" : "bg-base-100 border-base-300"}`}
                          maxLength={50}
                        />
                      </div>
                      {!isOwner && (
                        <button
                          onClick={() => removeMember(i)}
                          disabled={members.length <= 3}
                          className={`mt-1 shrink-0 rounded-lg p-1.5 transition-colors ${members.length <= 3 ? "text-neutral-content/20 cursor-not-allowed" : "text-neutral-content hover:text-error hover:bg-error/10"}`}
                        >
                          <X className="size-4.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {members.length < MAX_MEMBERS && (
                <button
                  onClick={addMember}
                  className="border-base-300 text-neutral-content hover:border-primary/30 hover:text-primary w-full rounded-xl border-2 border-dashed py-2.5 text-sm font-medium transition-colors"
                >
                  {t("Add another member")} ({members.length}/{MAX_MEMBERS})
                </button>
              )}

              <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
                <Button
                  label={
                    <>
                      <ChevronLeft className="size-4.5" />
                      {t("Back")}
                    </>
                  }
                  variant="outline"
                  fullWidth
                  onClick={() => setStep(1)}
                  className="flex-1"
                />
                <Button
                  label={
                    <>
                      {t("Next")}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  }
                  variant="primary"
                  fullWidth
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">{t("Set threshold confirm")}</h2>
                <p className="text-neutral-content mt-1 text-sm">
                  {t("Review everything before deploying on chain")}
                </p>
              </div>

              <div className="bg-base-200/40 border-base-300 space-y-4 rounded-xl border p-5">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-content text-sm">{t("Required approvals")}</span>
                  <span className="text-primary text-2xl font-bold">
                    {threshold}
                    <span className="text-neutral-content text-base font-normal">
                      {" "}
                      / {voterCount}
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={voterCount || 1}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="range range-primary range-sm w-full"
                />
                <div className="text-neutral-content flex justify-between px-0.5 text-xs">
                  {Array.from({ length: voterCount || 1 }, (_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <div className="bg-info/5 border-info/10 flex items-start gap-2 rounded-lg border p-3">
                  <Info className="text-info mt-0.5 size-4.5 shrink-0" />
                  <p className="text-neutral-content text-xs">
                    {threshold === 1
                      ? "Single signer — proposals execute immediately."
                      : threshold === voterCount
                        ? "All members must approve — maximum security."
                        : `${threshold} of ${voterCount} members must approve to execute.`}
                  </p>
                </div>
              </div>

              <div className="bg-base-200/40 border-base-300 space-y-3 rounded-xl border p-4">
                <h4 className="text-sm font-semibold">{t("Summary")}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-content flex items-center gap-2">
                      {teamImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={teamImage} alt="" className="h-5 w-5 rounded" />
                      ) : (
                        <UserCircle className="size-4.5" />
                      )}
                      {t("Team")}
                    </span>
                    <span className="font-semibold">{teamName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-content flex items-center gap-2">
                      <Users className="size-4.5" />
                      {t("Members")}
                    </span>
                    <span className="font-semibold">{filledMembers.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-content flex items-center gap-2">
                      <Zap className="size-4.5" />
                      {t("Threshold")}
                    </span>
                    <span className="font-semibold">
                      {threshold} / {voterCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-warning/20 bg-warning/5 space-y-2 rounded-xl border p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Zap className="text-warning size-4.5" />
                  {t("Estimated Fees")}
                </h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Account rent exempt")}</span>
                    <span className="font-mono">{rentSOL.toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Transaction fee")}</span>
                    <span className="font-mono">
                      {txFee} {t("SOL")}
                    </span>
                  </div>
                  <div className="border-warning/20 flex justify-between border-t pt-1.5">
                    <span className="font-medium">{t("Total")}</span>
                    <span className="text-warning font-mono font-bold">
                      {totalFee.toFixed(6)} {t("SOL")}
                    </span>
                  </div>
                </div>
                <p className="text-neutral-content text-xs">
                  {t("Paid by your connected wallet Rent is recoverable if the account is closed")}
                </p>
              </div>

              {(tx.isProcessing || tx.isDone || uploadStatus === "uploading") && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-3 rounded-xl border p-4">
                  {tx.isDone ? (
                    <Check className="text-success h-5 w-5 shrink-0" />
                  ) : (
                    <Loader2 className="text-primary h-5 w-5 shrink-0 animate-spin" />
                  )}
                  <p className="text-sm font-medium">{getStatusMessage()}</p>
                </div>
              )}

              {tx.isError && tx.error && (
                <div className="bg-error/5 border-error/20 flex items-start gap-3 rounded-xl border p-4">
                  <AlertTriangle className="text-error mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-error text-sm font-medium">{t("Transaction failed")}</p>
                    <p className="text-neutral-content mt-0.5 text-xs">{tx.error}</p>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
                <Button
                  label={
                    <>
                      <ChevronLeft className="size-4.5" />
                      {t("Back")}
                    </>
                  }
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setStep(2);
                    tx.reset();
                  }}
                  disabled={tx.isProcessing}
                  className="flex-1"
                />
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
                        {t("Create Team")}
                      </>
                    )
                  }
                  variant="primary"
                  fullWidth
                  onClick={handleSubmit}
                  disabled={!canCreate || tx.isProcessing || tx.isDone}
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
