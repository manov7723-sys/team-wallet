"use client";
/**
 * ProgramsPage
 *
 * Handles Solana program management with on-chain proposals, including adding programs,
 * upgrading deployments, closing programs  with blockchain state.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} [props.children] - Optional children (if extended usage)
 * @param {string} activeTeam.teamWalletAddress - Current team wallet address
 * @param {boolean} activeTeam.isOwner - Whether current user is owner
 * @param {boolean} activeTeam.isContributor - Whether user can manage programs
 * @param {string} publicKey - Connected wallet public key
 * @param {ProgramData[]} programs - List of tracked programs from DB
 * @param {OnChainProgram} onChain - On-chain program details (authority, balance, size)
 * @param {Proposal[]} pendingProposals - Pending upgrade/close proposals
 *
 * @returns {JSX.Element | Promise<void> | boolean | string}
 * JSX.Element - Main UI rendering (program cards, stats, modals)
 * Promise<void> - Async actions (add, upgrade, delete via proposals)
 * boolean - Validation checks (authority, buffer validity, permissions)
 *
 * Combines on-chain and database program data to provide a unified view.
 * Validates program and buffer addresses before executing any action.
 * Upgrade and delete operations are performed through multisig proposals
 * requiring team approval based on governance rules.
 *
 * Ensures consistency by tracking pending proposals and refreshing state
 * after transactions, keeping UI and blockchain data in sync.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Button from "@/src/components/Button/ButtonVW";
import Input from "@/src/components/Input/InputVW";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import {
  usePrograms,
  useSaveProgram,
  useAddUpgradeLog,
  useRemoveProgram,
  useProgramOnChain,
} from "@/src/hooks/useProgramHooks";
import { usePendingProposals } from "@/src/hooks/usePendingProposals";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useInvalidateProposals } from "@/src/hooks/usePendingProposals";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  buildCreateProposalIx,
  buildSetBufferAuthorityIx,
  type ProposalAction,
} from "@/src/lib/web3";
import { explorerAddressLink } from "@/src/lib/explorer";
import type { ProgramData } from "@/src/lib/api";
import {
  Check,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  History,
  Info,
  LayoutGrid,
  Lock,
  Loader2,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

type ModalType = "add" | "upgrade" | "delete" | null;

function ProgramCard({
  prog,
  teamAddress,
  canManage,
  pendingActionType,
  onUpgrade,
  onDelete,
  onRemove,
  onExpand,
  isExpanded,
}: {
  prog: ProgramData;
  teamAddress: string;
  canManage: boolean;
  pendingActionType: string | null;
  onUpgrade: () => void;
  onDelete: () => void;
  onRemove: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const { data: onChain, isLoading } = useProgramOnChain(prog.programId);
  const t = useTranslations("program");
  const short = (addr: string, chars = 4) => `${addr.slice(0, chars)}...${addr.slice(-chars)}`;

  const isTeamAuth = onChain?.authority === teamAddress;
  const isImmutable = onChain && !onChain.authority;
  const showActions = canManage && isTeamAuth && !isImmutable;

  return (
    <div className="bg-base-100 border-base-200 overflow-hidden rounded-2xl border shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="bg-primary/10 border-primary/20 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border">
              <Code2 className="text-primary h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-lg font-bold">{prog.name}</h4>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-neutral-content max-w-50 truncate font-mono text-sm sm:max-w-none">
                  {prog.programId}
                </span>

                <Button
                  label={<Copy size={12} />}
                  variant="ghost"
                  size="xs"
                  className="btn-square"
                  onClick={() => {
                    navigator.clipboard.writeText(prog.programId);
                    toast.success("Copied");
                  }}
                />
                <a
                  href={explorerAddressLink(prog.programId)}
                  target="_blank"
                  rel="noopener"
                  className="text-neutral-content hover:text-primary shrink-0"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
              {prog.description && (
                <p className="text-neutral-content mt-1 text-xs">{prog.description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {showActions && !pendingActionType && (
              <>
                <button
                  onClick={onUpgrade}
                  className="hover:bg-primary/10 text-neutral-content hover:text-primary rounded-lg p-2 transition-colors"
                  title="Upgrade"
                >
                  <UploadCloud className="size-4.5" />
                </button>
                <button
                  onClick={onDelete}
                  className="hover:bg-error/10 text-neutral-content hover:text-error rounded-lg p-2 transition-colors"
                  title="Close"
                >
                  <Trash2 className="size-4.5" />
                </button>
              </>
            )}
            <button
              onClick={onExpand}
              className={`hover:bg-base-200 text-neutral-content rounded-lg p-2 transition-all ${isExpanded ? "rotate-90" : ""}`}
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        </div>

        {pendingActionType && (
          <div className="bg-info/5 border-info/20 mt-3 flex items-center gap-2 rounded-xl border p-2.5">
            <Clock className="text-info size-4.5 shrink-0" />
            <p className="text-info text-xs font-medium">
              {pendingActionType === "upgrade"
                ? "Upgrade"
                : pendingActionType === "delete"
                  ? "Close"
                  : "Transfer"}{" "}
              {t("proposal pending actions locked")}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-base-200/40 h-16 animate-pulse rounded-xl p-3" />
            ))}
          </div>
        ) : onChain ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="bg-base-200/40 rounded-xl p-3">
              <p className="text-neutral-content mb-0.5 text-xs font-medium tracking-wider uppercase">
                {t("Authority")}
              </p>
              <div className="flex items-center gap-1.5">
                {isTeamAuth ? (
                  <ShieldCheck className="text-success h-3.5 w-3.5" />
                ) : onChain.authority ? (
                  <Shield className="text-warning h-3.5 w-3.5" />
                ) : (
                  <Lock className="text-neutral-content/40 h-3.5 w-3.5" />
                )}
                <span
                  className={`text-xs font-medium ${isTeamAuth ? "text-success" : onChain.authority ? "text-warning" : "text-neutral-content/50"}`}
                >
                  {isTeamAuth ? "Team Wallet" : onChain.authority ? "External" : "Immutable"}
                </span>
              </div>
            </div>
            <div className="bg-base-200/40 rounded-xl p-3">
              <p className="text-neutral-content mb-0.5 text-xs font-medium tracking-wider uppercase">
                {t("Balance")}
              </p>
              <p className="text-sm font-semibold">{onChain.balance.toFixed(4)} SOL</p>
            </div>
            <div className="bg-base-200/40 rounded-xl p-3">
              <p className="text-neutral-content mb-0.5 text-xs font-medium tracking-wider uppercase">
                {t("Data Size")}
              </p>
              <p className="text-sm font-semibold">{(onChain.dataSize / 1024).toFixed(1)} KB</p>
            </div>
            <div className="bg-base-200/40 rounded-xl p-3">
              <p className="text-neutral-content mb-0.5 text-xs font-medium tracking-wider uppercase">
                {t("Deploy Slot")}
              </p>
              <p className="font-mono text-sm font-semibold">
                {onChain.lastDeploySlot > 0 ? onChain.lastDeploySlot.toLocaleString() : "—"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {isExpanded && (
        <div className="border-base-200 border-t">
          {showActions && !pendingActionType && (
            <div className="bg-base-200/20 flex flex-wrap items-center gap-2 px-5 py-3">
              <Button
                label={
                  <>
                    <UploadCloud className="h-3.5 w-3.5" />
                    {t("Upgrade")}
                  </>
                }
                variant="primary"
                size="xs"
                onClick={onUpgrade}
              />
              <div className="flex-1" />
              <Button
                label={
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("Close Program")}
                  </>
                }
                variant="outline"
                size="xs"
                className="btn-error"
                onClick={onDelete}
              />
              <button
                onClick={onRemove}
                className="text-neutral-content hover:text-error text-xs underline"
              >
                {t("Remove tracking")}
              </button>
            </div>
          )}
          {!showActions && canManage && (
            <div className="bg-base-200/20 flex items-center gap-2 px-5 py-3">
              <p className="text-neutral-content flex-1 text-xs">
                {isImmutable
                  ? "This program is immutable — no actions available."
                  : pendingActionType
                    ? "A proposal is pending for this program."
                    : "Team wallet is not the upgrade authority."}
              </p>
              <button
                onClick={onRemove}
                className="text-neutral-content hover:text-error text-xs underline"
              >
                {t("Remove tracking")}
              </button>
            </div>
          )}

          <div className="px-5 py-4">
            <h5 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <History className="text-info size-4.5" />
              {t("Upgrade History")}
            </h5>
            {prog.upgradeLogs.length === 0 ? (
              <p className="text-neutral-content py-4 text-center text-sm">
                {t("No upgrades recorded")}
              </p>
            ) : (
              <div className="space-y-2">
                {[...prog.upgradeLogs].reverse().map((log, i) => (
                  <div
                    key={log._id || i}
                    className="bg-base-200/30 border-base-200 flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${log.executedAt ? "bg-success/10" : "bg-info/10"}`}
                      >
                        {log.executedAt ? (
                          <Check className="text-success size-4.5" />
                        ) : (
                          <Clock className="text-info size-4.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {log.notes || "Program upgrade"}
                        </p>
                        <p className="text-neutral-content text-xs">
                          {t("Buffer")}{" "}
                          <span className="font-mono">{short(log.bufferAddress, 6)}</span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${log.executedAt ? "bg-success/10 text-success" : "bg-info/10 text-info"}`}
                    >
                      {log.executedAt ? "Executed" : "Proposed"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgramsPage() {
  const { activeTeam } = useActiveTeam();
  const { publicKey } = useWallet();
  const t = useTranslations("program");
  const { connection } = useConnection();
  const tx = useTransaction();
  const invalidateProposals = useInvalidateProposals();
  const { data: programs, isLoading } = usePrograms(activeTeam?.teamWalletAddress);
  const { data: pendingProposals } = usePendingProposals(activeTeam?.teamWalletAddress);
  const saveProgram = useSaveProgram();
  const addUpgradeLog = useAddUpgradeLog();
  const removeProgram = useRemoveProgram();

  const teamAddress = activeTeam?.teamWalletAddress || "";
  const canManage = activeTeam?.isOwner || activeTeam?.isContributor;

  const pendingByProgram = useMemo(() => {
    const map = new Map<string, string>();
    if (!pendingProposals) return map;
    for (const p of pendingProposals) {
      const a = p.action as any;
      if (a.upgradeProgram) map.set(a.upgradeProgram.programId, "upgrade");
      if (a.deleteProgram) map.set(a.deleteProgram.programId, "delete");
    }
    return map;
  }, [pendingProposals]);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedProg, setSelectedProg] = useState<ProgramData | null>(null);
  const [expandedProg, setExpandedProg] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [bufferAddress, setBufferAddress] = useState("");
  const [upgradeNotes, setUpgradeNotes] = useState("");
  const [refundAddress, setRefundAddress] = useState("");

  const { data: lookupInfo, isLoading: lookupLoading } = useProgramOnChain(
    newAddress.length >= 32 ? newAddress : null
  );

  const { data: bufferInfo } = useQuery<{ authority: string | null } | null>({
    queryKey: ["bufferAuthority", bufferAddress],
    queryFn: async () => {
      if (!bufferAddress || bufferAddress.length < 32) return null;
      try {
        const pk = new PublicKey(bufferAddress);
        const info = await connection.getAccountInfo(pk);
        if (!info) return null;
        const hasAuth = info.data[4] === 1;
        return { authority: hasAuth ? new PublicKey(info.data.slice(5, 37)).toBase58() : null };
      } catch {
        return null;
      }
    },
    enabled: !!bufferAddress && bufferAddress.length >= 32 && activeModal === "upgrade",
    staleTime: 30 * 1000,
  });

  const bufferAuthStatus = useMemo(() => {
    if (!bufferInfo || !bufferAddress || bufferAddress.length < 32) return null;
    if (!bufferInfo.authority) return "no-authority";
    if (bufferInfo.authority === teamAddress) return "team";
    if (bufferInfo.authority === publicKey?.toBase58()) return "user";
    return "other";
  }, [bufferInfo, teamAddress, publicKey, bufferAddress]);

  const short = (addr: string, chars = 4) => `${addr.slice(0, chars)}...${addr.slice(-chars)}`;

  const closeModal = () => {
    setActiveModal(null);
    setSelectedProg(null);
    setNewName("");
    setNewAddress("");
    setNewDesc("");
    setBufferAddress("");
    setUpgradeNotes("");
    setRefundAddress("");
    tx.reset();
  };

  const openAction = (prog: ProgramData, modal: ModalType) => {
    setSelectedProg(prog);
    setActiveModal(modal);
    tx.reset();
    setBufferAddress("");
    setUpgradeNotes("");
    setRefundAddress("");
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newAddress.trim() || !activeTeam) return;
    try {
      new PublicKey(newAddress.trim());
    } catch {
      toast.error(t("Invalid program address"));
      return;
    }
    try {
      await saveProgram.mutateAsync({
        programId: newAddress.trim(),
        teamWalletAddress: teamAddress,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      toast.success(t("Program added"));
      closeModal();
    } catch (err: any) {
      toast.error(err.message || t("failedToAdd"));
    }
  };

  const handleUpgrade = async () => {
    if (!publicKey || !activeTeam || !selectedProg || !bufferAddress.trim()) return;
    const provider = tx.getProvider();
    if (!provider) return;

    try {
      const teamPDA = new PublicKey(teamAddress);
      const buffer = new PublicKey(bufferAddress.trim());

      const bufferInfo = await connection.getAccountInfo(buffer);
      if (!bufferInfo) {
        toast.error(t("Buffer account not found onchain"));
        return;
      }

      const hasAuthority = bufferInfo.data[4] === 1;
      const bufferAuthority = hasAuthority ? new PublicKey(bufferInfo.data.slice(5, 37)) : null;

      if (!bufferAuthority) {
        toast.error(t("Buffer has no authority set"));
        return;
      }

      const allInstructions = [];

      if (bufferAuthority.equals(publicKey)) {
        allInstructions.push(buildSetBufferAuthorityIx(buffer, publicKey, teamPDA));
      } else if (!bufferAuthority.equals(teamPDA)) {
        toast.error(
          t("invalidBufferAuthority", {
            address: `${bufferAuthority.toBase58().slice(0, 8)}...`,
          })
        );
        return;
      }

      const action: ProposalAction = {
        upgradeProgram: {
          programId: new PublicKey(selectedProg.programId),
          buffer,
          spill: refundAddress.trim() ? new PublicKey(refundAddress.trim()) : publicKey,
        },
      };
      const { instructions: proposalIxs } = await buildCreateProposalIx(provider, teamPDA, action);
      allInstructions.push(...proposalIxs);

      await tx.execute(allInstructions, {
        accountKeys: [teamPDA],
        successMessage: "Upgrade proposal created!",
        onConfirmed: async () => {
          await addUpgradeLog.mutateAsync({
            programId: selectedProg.programId,
            teamWalletAddress: teamAddress,
            upgradeLog: {
              bufferAddress: bufferAddress.trim(),
              notes: upgradeNotes.trim() || undefined,
            },
          });
          invalidateProposals();
          closeModal();
        },
      });
    } catch (err: any) {
      if (err?.message?.includes("User rejected")) return;
      toast.error(err.message || t("Failed"));
    }
  };

  const handleDelete = async () => {
    if (!publicKey || !activeTeam || !selectedProg) return;
    const provider = tx.getProvider();
    if (!provider) return;
    try {
      const teamPDA = new PublicKey(teamAddress);
      const action: ProposalAction = {
        deleteProgram: {
          programId: new PublicKey(selectedProg.programId),
          spill: refundAddress.trim() ? new PublicKey(refundAddress.trim()) : publicKey,
        },
      };
      const { instructions } = await buildCreateProposalIx(provider, teamPDA, action);
      await tx.execute(instructions, {
        accountKeys: [teamPDA],
        successMessage: "Close proposal created!",
        onConfirmed: () => {
          invalidateProposals();
          closeModal();
        },
      });
    } catch (err: any) {
      if (err?.message?.includes("User rejected")) return;
      toast.error(err.message || t("Failed"));
    }
  };

  const handleRemoveTracking = async (prog: ProgramData) => {
    if (!activeTeam) return;
    try {
      await removeProgram.mutateAsync({
        programId: prog.programId,
        teamWalletAddress: teamAddress,
      });
      toast.success(t("Program removed from tracking"));
    } catch (err: any) {
      toast.error(err.message || t("Failed"));
    }
  };

  const statusMsg = tx.isBuilding
    ? "Building..."
    : tx.isSigning
      ? "Confirm in wallet..."
      : tx.isConfirming
        ? "Confirming..."
        : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">{t("Programs")}</h3>
          <p className="text-neutral-content mt-1 text-sm">
            {t("Manage onchain program deployments upgrades authority")}
          </p>
        </div>
        {canManage && (
          <Button
            label={
              <>
                <Plus className="size-4.5" />
                {t("Add Program")}
              </>
            }
            variant="primary"
            size="sm"
            onClick={() => setActiveModal("add")}
          />
        )}
      </div>

      {programs && programs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="border-base-200 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
            <Code2 className="text-primary h-3.5 w-3.5" />
            <span className="font-semibold">{programs.length}</span>
            <span className="text-neutral-content">{t("programs")}</span>
          </div>
          <div className="border-base-200 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
            <History className="text-info h-3.5 w-3.5" />
            <span className="font-semibold">
              {programs.reduce((sum, p) => sum + p.upgradeLogs.length, 0)}
            </span>
            <span className="text-neutral-content">{t("upgrades")}</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {!isLoading && (!programs || programs.length === 0) && (
        <div className="bg-base-100 border-base-200 flex flex-col items-center justify-center rounded-2xl border py-20 text-center shadow-sm">
          <div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <LayoutGrid className="text-primary h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold">{t("No Programs Yet")}</h3>
          <p className="text-neutral-content mt-2 max-w-sm text-sm">
            {t("Add your first program to manage upgrades and authorities with multisig security")}
          </p>
          {canManage && (
            <Button
              label={
                <>
                  <Plus className="size-5" />
                  Add Program
                </>
              }
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => setActiveModal("add")}
            />
          )}
        </div>
      )}

      {programs && programs.length > 0 && (
        <div className="space-y-4">
          {programs.map((prog) => (
            <ProgramCard
              key={prog.programId}
              prog={prog}
              teamAddress={teamAddress}
              canManage={!!canManage}
              pendingActionType={pendingByProgram.get(prog.programId) || null}
              onUpgrade={() => openAction(prog, "upgrade")}
              onDelete={() => openAction(prog, "delete")}
              onRemove={() => handleRemoveTracking(prog)}
              onExpand={() =>
                setExpandedProg(expandedProg === prog.programId ? null : prog.programId)
              }
              isExpanded={expandedProg === prog.programId}
            />
          ))}
        </div>
      )}

      {activeModal === "add" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-program-title"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeModal}
          />
          <div className="bg-base-100 border-base-200 relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-base-200 border-b px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <h3 id="add-program-title" className="flex items-center gap-2 text-lg font-bold">
                  <Plus className="text-primary h-5 w-5" />
                  {t("Add Program")}
                </h3>

                <Button
                  label={<X className="size-4" />}
                  size="xs"
                  aria-label="Close modal"
                  onClick={closeModal}
                  className="btn-square"
                />
              </div>
              <p className="text-neutral-content mt-1 text-sm">
                {t("Track a deployed program for multisig management")}
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <Input
                label="Program Name"
                placeholder="e.g. Staking Contract v2"
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 64))}
                maxLength={64}
                required
              />
              <Input
                label="Program Address"
                placeholder="Enter deployed program address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value.trim())}
                maxLength={44}
                required
              />

              {lookupLoading && newAddress.length >= 32 && (
                <div className="bg-base-200/40 flex items-center gap-2 rounded-lg p-2.5">
                  <Loader2 className="text-primary size-4.5 animate-spin" />
                  <p className="text-neutral-content text-xs">{t("Looking up onchain")}</p>
                </div>
              )}
              {lookupInfo && !lookupLoading && (
                <div
                  className={`rounded-lg border p-3 ${lookupInfo.authority === teamAddress ? "bg-success/5 border-success/20" : lookupInfo.authority ? "bg-warning/5 border-warning/20" : "bg-base-200/40 border-base-300"}`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    {lookupInfo.authority === teamAddress ? (
                      <ShieldCheck className="text-success size-4.5" />
                    ) : lookupInfo.authority ? (
                      <Shield className="text-warning size-4.5" />
                    ) : (
                      <Lock className="text-neutral-content/40 size-4.5" />
                    )}
                    <p
                      className={`text-xs font-medium ${lookupInfo.authority === teamAddress ? "text-success" : lookupInfo.authority ? "text-warning" : "text-neutral-content"}`}
                    >
                      {lookupInfo.authority === teamAddress
                        ? "Authority matches team wallet"
                        : lookupInfo.authority
                          ? `Authority: ${short(lookupInfo.authority)}`
                          : "Immutable (no authority)"}
                    </p>
                  </div>
                  <p className="text-neutral-content text-xs">
                    Size: {(lookupInfo.dataSize / 1024).toFixed(1)} KB · Balance:{" "}
                    {lookupInfo.balance.toFixed(4)} {t("SOL")}
                  </p>
                </div>
              )}
              {newAddress.length >= 32 && !lookupLoading && !lookupInfo && (
                <div className="bg-error/5 border-error/20 flex items-center gap-2 rounded-lg border p-2.5">
                  <X className="text-error size-4.5 shrink-0" />
                  <p className="text-error text-xs">{t("Program not found onchain")}</p>
                </div>
              )}

              <Input
                label="Description (optional)"
                placeholder="Brief description"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value.slice(0, 500))}
                maxLength={500}
              />
              <div className="bg-info/5 border-info/10 flex items-start gap-2 rounded-xl border p-3">
                <Info className="text-info mt-0.5 size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  {t("This only tracks the program you can transfer upgrade authority separately")}
                </p>
              </div>
            </div>
            <div className="border-base-200 flex gap-3 border-t px-6 py-4">
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onClick={closeModal}
                className="flex-1"
              />
              <Button
                label={
                  saveProgram.isPending ? (
                    <>
                      <Loader2 className="size-4.5 animate-spin" />
                      {t("Adding")}
                    </>
                  ) : (
                    "Add Program"
                  )
                }
                variant="primary"
                fullWidth
                onClick={handleAdd}
                disabled={
                  !newName.trim() || !newAddress.trim() || !lookupInfo || saveProgram.isPending
                }
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}

      {activeModal === "upgrade" && selectedProg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-program-title"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeModal}
          />
          <div className="bg-base-100 border-base-200 relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-base-200 border-b px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <h3
                  id="upgrade-program-title"
                  className="flex items-center gap-2 text-lg font-bold"
                >
                  <UploadCloud className="text-primary h-5 w-5" />
                  {t("Upgrade Program")}
                </h3>

                <Button
                  label={<X className="size-4" />}
                  size="xs"
                  aria-label="Close modal"
                  onClick={closeModal}
                  className="btn-square"
                />
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="bg-base-200/40 border-base-300 flex items-center gap-3 rounded-xl border p-4">
                <Code2 className="text-primary h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{selectedProg.name}</p>
                  <p className="text-neutral-content truncate font-mono text-xs">
                    {selectedProg.programId}
                  </p>
                </div>
              </div>

              <Input
                label="Buffer Address"
                placeholder="Deployed buffer account address"
                value={bufferAddress}
                onChange={(e) => setBufferAddress(e.target.value.trim())}
                maxLength={44}
                required
              />

              {bufferAuthStatus === "user" && (
                <div className="bg-info/5 border-info/20 flex items-center gap-2 rounded-lg border p-2.5">
                  <ShieldCheck className="text-info size-4.5 shrink-0" />
                  <p className="text-neutral-content text-xs">
                    {t("Buffer authority will be transferred to team wallet automatically")}
                  </p>
                </div>
              )}
              {bufferAuthStatus === "team" && (
                <div className="bg-success/5 border-success/20 flex items-center gap-2 rounded-lg border p-2.5">
                  <Check className="text-success size-4.5 shrink-0" />
                  <p className="text-success text-xs">
                    {t("Buffer authority already set to team wallet")}
                  </p>
                </div>
              )}
              {bufferAuthStatus === "other" && (
                <div className="bg-error/5 border-error/20 flex items-center gap-2 rounded-lg border p-2.5">
                  <X className="text-error size-4.5 shrink-0" />
                  <p className="text-error text-xs">
                    {t(
                      "Buffer authority belongs to another wallet Transfer it to your wallet or the team PDA first"
                    )}
                  </p>
                </div>
              )}
              {bufferAuthStatus === "no-authority" && (
                <div className="bg-error/5 border-error/20 flex items-center gap-2 rounded-lg border p-2.5">
                  <X className="text-error size-4.5 shrink-0" />
                  <p className="text-error text-xs">{t("Buffer has no authority set")}</p>
                </div>
              )}
              {bufferAddress.length >= 32 && !bufferInfo && !bufferAuthStatus && (
                <div className="bg-base-200/40 flex items-center gap-2 rounded-lg p-2.5">
                  <Loader2 className="text-primary size-4.5 shrink-0 animate-spin" />
                  <p className="text-neutral-content text-xs">{t("Checking buffer")}</p>
                </div>
              )}

              <div>
                <div className="mb-1 flex justify-between">
                  <label className="text-neutral-content text-sm font-medium">
                    {t("Upgrade Notes optional")}
                  </label>
                  <span className="text-neutral-content/50 font-mono text-xs">
                    {upgradeNotes.length}/500
                  </span>
                </div>
                <textarea
                  placeholder="Describe what changed in this upgrade..."
                  value={upgradeNotes}
                  onChange={(e) => setUpgradeNotes(e.target.value.slice(0, 500))}
                  rows={3}
                  className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 w-full resize-none rounded-xl border px-3 py-2 text-sm transition-colors outline-none"
                />
              </div>

              <Input
                label="Refund Address (optional)"
                placeholder="Leftover rent recipient (default: your wallet)"
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value.trim())}
                maxLength={44}
              />

              <div className="bg-warning/5 border-warning/10 flex items-start gap-2 rounded-xl border p-3">
                <Zap className="text-warning mt-0.5 size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  {t(
                    "Buffer authority will be auto transferred to the team wallet Then a proposal is created requiring team approval"
                  )}
                </p>
              </div>

              {statusMsg && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-2 rounded-xl border p-3">
                  <Loader2 className="text-primary size-4.5 animate-spin" />
                  <p className="text-sm">{statusMsg}</p>
                </div>
              )}
              {tx.isError && tx.error && (
                <div className="bg-error/5 border-error/20 flex items-start gap-2 rounded-xl border p-3">
                  <p className="text-error flex-1 text-sm">{tx.error}</p>
                  <button
                    onClick={() => tx.reset()}
                    className="text-error/50 hover:text-error shrink-0"
                  >
                    <span className="text-lg leading-none">&times;</span>
                  </button>
                </div>
              )}
            </div>
            <div className="border-base-200 flex gap-3 border-t px-6 py-4">
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onClick={closeModal}
                disabled={tx.isProcessing}
                className="flex-1"
              />
              <Button
                label="Submit"
                variant="primary"
                fullWidth
                onClick={handleUpgrade}
                disabled={
                  !bufferAddress.trim() ||
                  tx.isProcessing ||
                  bufferAuthStatus === "other" ||
                  bufferAuthStatus === "no-authority"
                }
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}

      {activeModal === "delete" && selectedProg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-program-title"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeModal}
          />
          <div className="bg-base-100 border-base-200 relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-base-200 border-b px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <h3
                  id="close-program-title"
                  className="text-error flex items-center gap-2 text-lg font-bold"
                >
                  <Trash2 className="h-5 w-5" />
                  {t("Close Program")}
                </h3>

                <Button
                  label={<X className="size-4" />}
                  size="xs"
                  aria-label="Close modal"
                  onClick={closeModal}
                  className="btn-square"
                />
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="bg-base-200/40 border-base-300 rounded-xl border p-4">
                <p className="text-sm font-semibold">{selectedProg.name}</p>
                <p className="text-neutral-content truncate font-mono text-xs">
                  {selectedProg.programId}
                </p>
              </div>
              <Input
                label="Refund Address (optional)"
                placeholder="Where rent SOL goes (default: your wallet)"
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value.trim())}
                maxLength={44}
              />
              <div className="bg-error/5 border-error/10 flex items-start gap-2 rounded-xl border p-3">
                <Trash2 className="text-error mt-0.5 size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  <strong className="text-error">{t("Irreversible")}</strong>{" "}
                  {t("The program will be closed and rent returned to the refund address")}
                </p>
              </div>
              {statusMsg && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-2 rounded-xl border p-3">
                  <Loader2 className="text-primary size-4.5 animate-spin" />
                  <p className="text-sm">{statusMsg}</p>
                </div>
              )}
              {tx.isError && tx.error && (
                <div className="bg-error/5 border-error/20 flex items-start gap-2 rounded-xl border p-3">
                  <p className="text-error flex-1 text-sm">{tx.error}</p>
                  <button
                    onClick={() => tx.reset()}
                    className="text-error/50 hover:text-error shrink-0"
                  >
                    <span className="text-lg leading-none">&times;</span>
                  </button>
                </div>
              )}
            </div>
            <div className="border-base-200 flex gap-3 border-t px-6 py-4">
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onClick={closeModal}
                disabled={tx.isProcessing}
                className="flex-1"
              />
              <Button
                label="Submit"
                variant="primary"
                fullWidth
                onClick={handleDelete}
                disabled={tx.isProcessing}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
