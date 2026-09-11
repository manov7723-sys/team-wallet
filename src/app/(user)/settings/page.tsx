"use client";
/**
 * Settings Component
 *
 * Manages user profile and team configuration including avatar upload,
 * team image updates, threshold proposals, and on-chain synced data display.
 *
 * @component
 *
 * @param {Object} context - Internal hooks & providers
 * @param {User} user - Authenticated user data
 * @param {string} publicKey - Connected wallet public key
 * @param {ActiveTeam} activeTeam - Current team details and permissions
 * @param {Profile} profile - User profile data from DB
 * @param {OnChainTeam} onChain - On-chain team state (voters, threshold)
 * @param {Proposal[]} pendingProposals - Active governance proposals
 *
 * @returns {JSX.Element | Promise<void> | boolean}
 * JSX.Element - Renders settings UI (profile, team, threshold, stats)
 * Promise<void> - Handles async actions (update profile, upload, proposals)
 * boolean - Validation checks (form validation, pending proposal guards)
 *
 *
 * Combines off-chain (DB) and on-chain data to provide a unified settings panel.
 * Supports avatar and team image uploads with preview and validation.
 * Enables profile updates and team metadata changes with proper permissions.
 * Handles threshold change proposals via blockchain transactions.
 */
import { useRef, useState } from "react";
import Button from "@/src/components/Button/ButtonVW";
import { useAuth } from "@/src/providers/AuthProvider";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useProfile, useUpload, useUpdateTeam } from "@/src/hooks/useApi";
import { useTeamTokenBalances } from "@/src/hooks/useTokenHooks";
import { SOL_MINT } from "@/src/lib/jupiter";
import { useTeamOnChain } from "@/src/hooks/useTeamOnChain";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useInvalidateProposals, usePendingProposals } from "@/src/hooks/usePendingProposals";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildCreateProposalIx } from "@/src/lib/web3";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCircle,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";

const NAME_MAX = 50;
const EMAIL_MAX = 100;
const BIO_MAX = 255;

export default function Settings() {
  const { user } = useAuth();
  const { publicKey } = useWallet();
  const { activeTeam } = useActiveTeam();
  const t = useTranslations("settings");
  const { profile, updateProfile, isUpdating } = useProfile();
  const { data: balances } = useTeamTokenBalances(activeTeam?.teamWalletAddress);
  const solBalance = balances?.[SOL_MINT];
  const solAvailable = solBalance ? Math.max(0, solBalance.ui - (solBalance.rentReserve || 0)) : 0;
  const { data: onChain } = useTeamOnChain(activeTeam?.teamWalletAddress);
  const uploadMutation = useUpload();
  const updateTeamMutation = useUpdateTeam();
  const txHook = useTransaction();
  const invalidateProposals = useInvalidateProposals();

  const { data: pendingProposals } = usePendingProposals(activeTeam?.teamWalletAddress);
  const hasPendingThreshold =
    pendingProposals?.some((p) => p.action && "changeThreshold" in p.action) ?? false;

  const teamImageRef = useRef<HTMLInputElement>(null);
  const userAvatarRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    bio: "",
  });
  const [profileErrors, setProfileErrors] = useState<{ name?: string; email?: string }>({});

  const syncSource = profile || user;
  const syncKey = syncSource
    ? `${syncSource.name}-${syncSource.email}-${(syncSource as any).bio ?? ""}`
    : null;
  const [lastSyncedKey, setLastSyncedKey] = useState<string | null>(null);
  if (syncKey && lastSyncedKey !== syncKey) {
    setLastSyncedKey(syncKey);
    setProfileForm({
      name: syncSource!.name || "",
      email: syncSource!.email || "",
      bio: (syncSource as any).bio || "",
    });
  }

  const [teamImage, setTeamImage] = useState<string | null>(null);
  const [teamImageFile, setTeamImageFile] = useState<File | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [newThreshold, setNewThreshold] = useState(onChain?.voteThreshold || 2);

  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeTeamImage, setRemoveTeamImage] = useState(false);

  const walletAddress = publicKey?.toBase58() || "";
  const canEditTeam = activeTeam?.isOwner || activeTeam?.isContributor;
  const voterCount = onChain?.voters.length || activeTeam?.memberCount || 0;

  const displayAvatar = removeAvatar ? null : userAvatar || profile?.avatar || user?.avatar;
  const displayTeamImage = removeTeamImage ? null : teamImage || activeTeam?.image;

  const validateProfile = (): boolean => {
    const errors: { name?: string; email?: string } = {};

    if (!profileForm.name.trim()) {
      errors.name = "Display name is required";
    } else if (profileForm.name.trim().length < 2) {
      errors.name = "Must be at least 2 characters";
    }

    if (profileForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profileForm.email.trim())) {
        errors.email = "Invalid email format";
      }
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;

    try {
      if (canEditTeam && activeTeam) {
        if (removeTeamImage) {
          await updateTeamMutation.mutateAsync({
            address: activeTeam.teamWalletAddress,
            input: { image: "" },
          });
          setRemoveTeamImage(false);
          setTeamImage(null);
          setTeamImageFile(null);
        } else if (teamImageFile) {
          const uploaded = await uploadMutation.mutateAsync({
            file: teamImageFile,
            folder: "teams",
          });
          await updateTeamMutation.mutateAsync({
            address: activeTeam.teamWalletAddress,
            input: { image: uploaded.url },
          });
          setTeamImageFile(null);
        }
      }

      updateProfile(
        {
          name: profileForm.name.trim(),
          email: profileForm.email.trim(),
          bio: profileForm.bio.trim(),
          ...(removeAvatar ? { avatar: "" } : {}),
        },
        {
          onSuccess: () => {
            setRemoveAvatar(false);
            toast.success(t("Profile updated"));
          },
          onError: (err: any) => toast.error(err.message || t("Update failed")),
        }
      );
    } catch (err: any) {
      toast.error(err.message || t("Update failed"));
    }
  };

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserAvatar(null);
    setRemoveAvatar(true);
  };

  const handleRemoveTeamImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTeamImage(null);
    setTeamImageFile(null);
    setRemoveTeamImage(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("Max 5MB"));
      return;
    }
    setRemoveAvatar(false);
    const reader = new FileReader();
    reader.onloadend = () => setUserAvatar(reader.result as string);
    reader.readAsDataURL(file);
    try {
      const result = await uploadMutation.mutateAsync({ file, folder: "avatars" });
      updateProfile(
        { avatar: result.url },
        {
          onSuccess: () => toast.success(t("Avatar uploaded")),
          onError: (err: any) => toast.error(err.message || t("Upload failed")),
        }
      );
    } catch (err: any) {
      toast.error(err.message || t("Upload failed"));
    }
  };

  const handleTeamImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("Max 5MB"));
      return;
    }
    setRemoveTeamImage(false);
    setTeamImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setTeamImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleProposeThreshold = async () => {
    const provider = txHook.getProvider();
    if (!provider || !activeTeam) return;

    if (hasPendingThreshold) {
      toast.warning(
        t("A threshold change proposal is already pending Resolve it before creating a new one")
      );
      return;
    }

    const teamPDA = new PublicKey(activeTeam.teamWalletAddress);
    const action = { changeThreshold: { newThreshold } };
    const { instructions } = await buildCreateProposalIx(provider, teamPDA, action as any);
    await txHook.execute(instructions, {
      accountKeys: [teamPDA],
      successMessage: "Threshold change proposal created!",
      onConfirmed: () => {
        invalidateProposals();
        setShowThresholdModal(false);
      },
    });
  };

  const isSaving = isUpdating || uploadMutation.isPending || updateTeamMutation.isPending;

  return (
    <>
      <h3 className="text-xl font-bold">{t("Settings")}</h3>
      <p className="text-neutral-content mt-1 text-sm">
        {t("Manage your profile and team configuration")}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-5 max-lg:grid-cols-1">
        <div className="lg:col-span-2">
          {canEditTeam && (
            <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
              <h4 className="mb-4 text-base font-bold">{t("Team Image")}</h4>
              <div className="flex items-center gap-5">
                <div
                  onClick={() => !displayTeamImage && teamImageRef.current?.click()}
                  className="border-base-300 hover:border-primary/30 group bg-base-200/50 relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors"
                >
                  {displayTeamImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayTeamImage}
                        alt="Team"
                        className="h-full w-full object-cover"
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={handleRemoveTeamImage}
                      >
                        <Trash2 className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera
                      className="text-neutral-content/40 group-hover:text-primary h-6 w-6 transition-colors"
                      onClick={() => teamImageRef.current?.click()}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {displayTeamImage ? "Click to change" : "Click to upload"}
                  </p>
                  <p className="text-neutral-content text-xs">
                    {t("JPG or PNG  max 5MB Visible to all members")}
                  </p>
                  {(removeTeamImage || teamImageFile) && (
                    <p className="text-warning mt-1 text-xs">
                      {t("Pending click Save Changes to apply")}
                    </p>
                  )}
                </div>
                <input
                  ref={teamImageRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handleTeamImageUpload}
                />
              </div>
            </div>
          )}

          <div className="bg-base-100 border-base-200 mt-5 rounded-2xl border p-6 shadow-sm">
            <h4 className="mb-5 text-base font-bold">{t("Personal Information")}</h4>
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <div
                  onClick={() => !displayAvatar && userAvatarRef.current?.click()}
                  className="border-base-300 hover:border-primary/30 group bg-base-200/50 relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors"
                >
                  {displayAvatar ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayAvatar}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={handleRemoveAvatar}
                      >
                        <Trash2 className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <UserCircle
                      className="text-neutral-content/40 group-hover:text-primary h-8 w-8 transition-colors"
                      onClick={() => userAvatarRef.current?.click()}
                    />
                  )}
                </div>
                <p className="text-xs font-medium">{t("Profile Photo")}</p>
                {removeAvatar && (
                  <p className="text-warning text-center text-xs">{t("Save to remove")}</p>
                )}
                <input
                  ref={userAvatarRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-1">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-neutral-content text-sm font-medium">
                      {t("Display Name")} <span className="text-error">*</span>
                    </label>
                    <span
                      className={`font-mono text-xs ${profileForm.name.length > NAME_MAX - 5 ? "text-warning" : "text-neutral-content/50"}`}
                    >
                      {profileForm.name.length}/{NAME_MAX}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter name"
                    value={profileForm.name}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, name: e.target.value.slice(0, NAME_MAX) });
                      setProfileErrors((p) => ({ ...p, name: undefined }));
                    }}
                    className={`bg-base-200/60 focus:border-primary/40 placeholder:text-neutral-content/50 h-10 w-full rounded-xl border px-3 text-sm transition-colors outline-none ${profileErrors.name ? "border-error" : "border-base-300"}`}
                    maxLength={NAME_MAX}
                  />
                  {profileErrors.name && (
                    <p className="text-error mt-1 text-xs">{profileErrors.name}</p>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-neutral-content text-sm font-medium">{t("Email")}</label>
                    <span
                      className={`font-mono text-xs ${profileForm.email.length > EMAIL_MAX - 10 ? "text-warning" : "text-neutral-content/50"}`}
                    >
                      {profileForm.email.length}/{EMAIL_MAX}
                    </span>
                  </div>
                  <input
                    type="email"
                    placeholder="Enter email"
                    value={profileForm.email}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, email: e.target.value.slice(0, EMAIL_MAX) });
                      setProfileErrors((p) => ({ ...p, email: undefined }));
                    }}
                    className={`bg-base-200/60 focus:border-primary/40 placeholder:text-neutral-content/50 h-10 w-full rounded-xl border px-3 text-sm transition-colors outline-none ${profileErrors.email ? "border-error" : "border-base-300"}`}
                    maxLength={EMAIL_MAX}
                  />
                  {profileErrors.email && (
                    <p className="text-error mt-1 text-xs">{profileErrors.email}</p>
                  )}
                </div>

                <div className="">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-neutral-content text-sm font-medium">{t("Bio")}</label>
                    <span
                      className={`font-mono text-xs ${profileForm.bio.length > BIO_MAX - 20 ? "text-warning" : "text-neutral-content/50"}`}
                    >
                      {profileForm.bio.length}/{BIO_MAX}
                    </span>
                  </div>
                  <textarea
                    placeholder="Tell us about yourself"
                    value={profileForm.bio}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, bio: e.target.value.slice(0, BIO_MAX) })
                    }
                    rows={3}
                    className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/50 w-full resize-none rounded-xl border px-3 py-2 text-sm transition-colors outline-none"
                    maxLength={BIO_MAX}
                  />
                </div>

                <div>
                  <p className="text-neutral-content mb-2 text-xs">{t("Wallet Address")}</p>
                  <div className="bg-base-200/60 border-base-300 flex items-center gap-2 rounded-xl border px-4 py-3">
                    <span className="flex-1 truncate font-mono text-sm">{walletAddress}</span>

                    <Button
                      label={<Copy size={12} />}
                      variant="ghost"
                      size="xs"
                      className="btn-square"
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress);
                        toast.success("Copied");
                      }}
                    />
                  </div>
                </div>

                <div className="text-end">
                  <Button
                    label={
                      isSaving ? (
                        <>
                          <Loader2 className="size-4.5 animate-spin" />
                          {t("Saving")}
                        </>
                      ) : (
                        "Save Changes"
                      )
                    }
                    size="md"
                    variant="primary"
                    className="rounded-lg"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          {activeTeam && (
            <div className="grid grid-cols-1 gap-4 max-lg:grid-cols-3 max-md:grid-cols-1">
              <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h6 className="text-base font-bold">{t("Team Balance")}</h6>
                    <h2 className="text-primary mt-1 text-2xl font-bold">
                      {solAvailable.toFixed(4)} SOL
                    </h2>
                    <div className="mt-1 flex items-center gap-1">
                      <p className="text-neutral-content font-mono text-xs">
                        {activeTeam.teamWalletAddress.slice(0, 8)}...
                        {activeTeam.teamWalletAddress.slice(-4)}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeTeam.teamWalletAddress);
                          toast.success("Copied");
                        }}
                        className="hover:text-primary"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-primary/10 rounded-xl p-3">
                    <Wallet className="text-primary h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h6 className="text-base font-bold">{t("Members")}</h6>
                    <h2 className="text-warning mt-1 text-2xl font-bold">
                      {onChain ? onChain.voters.length : activeTeam.memberCount}
                    </h2>
                    <p className="text-neutral-content mt-1 text-xs">
                      {onChain
                        ? `${onChain.voters.length} voters · ${onChain.contributors.length} contributors`
                        : `${activeTeam.memberCount} total`}
                    </p>
                  </div>
                  <div className="bg-warning/10 rounded-xl p-3">
                    <Users className="text-warning h-6 w-6" />
                  </div>
                </div>
              </div>

              {activeTeam && (
                <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h6 className="text-base font-bold">{t("Threshold")}</h6>
                      <h2 className="text-success mt-1 text-2xl font-extrabold">
                        {onChain?.voteThreshold || activeTeam.threshold}
                        <span className="text-neutral-content text-lg font-normal">
                          {" "}
                          / {voterCount} {t("voters")}
                        </span>
                      </h2>
                      <p className="text-neutral-content mt-1 text-xs">
                        {t("Required approvals to execute a proposal")}
                      </p>
                    </div>
                    <div className="bg-success/10 rounded-xl p-3">
                      <ShieldCheck className="text-success h-6 w-6" />
                    </div>
                  </div>

                  {hasPendingThreshold && (
                    <div className="bg-warning/10 border-warning/20 mt-4 flex items-start gap-2 rounded-xl border p-3">
                      <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-warning text-xs font-medium">
                        {t(
                          "A threshold change proposal is already pending Resolve it before proposing a new one"
                        )}
                      </p>
                    </div>
                  )}

                  {canEditTeam && (
                    <Button
                      label={
                        <>
                          <div className="line-clamp-1">{t("Propose Threshold Change")}</div>
                          <ChevronRight className="size-4.5" />
                        </>
                      }
                      variant="outline"
                      size="md"
                      fullWidth
                      onClick={() => {
                        setNewThreshold(onChain?.voteThreshold || activeTeam.threshold);
                        setShowThresholdModal(true);
                        txHook.reset();
                      }}
                      disabled={hasPendingThreshold}
                      className="btn-success max-xl:btn-sm mt-5"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showThresholdModal && activeTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="threshold-modal-title"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setShowThresholdModal(false)}
          />
          <div className="bg-base-100 border-base-200 relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-base-200 border-b px-6 pt-6 pb-4">
              <h3 id="threshold-modal-title" className="text-lg font-bold">
                {t("Propose Threshold Change")}
              </h3>
              <p className="text-neutral-content mt-1 text-sm">
                {t("Creates a proposal requiring voter approval")}
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-content text-sm">{t("Current threshold")}</span>
                <span className="font-bold">
                  {onChain?.voteThreshold || activeTeam.threshold} / {voterCount}
                </span>
              </div>
              <div>
                <label className="text-neutral-content mb-2 block text-sm font-medium">
                  {t("New threshold")}
                </label>
                <input
                  type="range"
                  min={1}
                  max={voterCount || 1}
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(parseInt(e.target.value))}
                  className="range range-success range-sm w-full"
                />
                <div className="text-neutral-content mt-1 flex justify-between px-0.5 text-xs">
                  {Array.from({ length: voterCount || 1 }, (_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <p className="text-success mt-2 text-center text-2xl font-bold">{newThreshold}</p>
              </div>
              <div className="bg-info/5 border-info/10 flex items-start gap-2 rounded-xl border p-3">
                <Info className="text-info mt-0.5 size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  {t("Needs")} {onChain?.voteThreshold || activeTeam.threshold}{" "}
                  {t("approvals to execute")}
                </p>
              </div>

              {hasPendingThreshold && (
                <div className="bg-warning/10 border-warning/20 flex items-start gap-2 rounded-xl border p-3">
                  <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-warning text-xs font-medium">
                    {t("A threshold change proposal is already pending Please resolve it first")}
                  </p>
                </div>
              )}

              {txHook.isProcessing && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-3 rounded-xl border p-3">
                  <Loader2 className="text-primary size-4.5 animate-spin" />
                  <p className="text-sm">
                    {txHook.isSigning ? "Confirm in wallet..." : "Processing..."}
                  </p>
                </div>
              )}
              {txHook.isError && txHook.error && (
                <p className="text-error text-sm">{txHook.error}</p>
              )}
            </div>
            <div className="border-base-200 flex gap-3 border-t px-6 py-4">
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onClick={() => setShowThresholdModal(false)}
                disabled={txHook.isProcessing}
                className="flex-1"
              />
              <Button
                label={
                  <>
                    <Zap className="size-4.5" />
                    {t("Create Proposal")}
                  </>
                }
                variant="primary"
                fullWidth
                onClick={handleProposeThreshold}
                disabled={
                  txHook.isProcessing ||
                  hasPendingThreshold ||
                  newThreshold === (onChain?.voteThreshold || activeTeam.threshold)
                }
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
