"use client";
/**
 * Members Component
 *
 * Handles team member management with on-chain proposals, including adding members,
 * assigning/removing roles, validating inputs, and syncing UI with blockchain state.
 *
 * @component
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} [props.children] - Optional children (if extended usage)
 * @param {string} activeTeam.teamWalletAddress - Current team wallet address
 * @param {boolean} activeTeam.isOwner - Whether current user is owner
 * @param {boolean} activeTeam.isContributor - Whether user can manage members
 * @param {string} publicKey - Connected wallet public key
 * @param {OnChainData} onChain - On-chain team data (owner, voters, contributors)
 * @param {TeamDB} teamDb - Database member metadata (name, avatar)
 * @param {OnChainProposal[]} proposals - Pending proposals list
 *
 * @returns {JSX.Element | Promise<void> | boolean | string}
 * JSX.Element - Main UI rendering (members, proposals, modals)
 * Promise<void> - Async actions (add/remove member, role updates via proposals)
 * boolean - Validation and pending checks (duplicate proposals, role checks)
 * string - Helper outputs (formatted proposal descriptions)
 *
 * Combines on-chain and database data to build a unified member list.
 * Validates wallet addresses and prevents duplicate or invalid operations.
 * All role changes (add/remove voter or contributor) are executed via
 * blockchain proposals requiring approval based on voting threshold.
 *
 * Ensures consistency by tracking recently submitted actions and
 * re-fetching updated data after transactions complete.
 */
import { useState, useMemo } from "react";
import Button from "@/src/components/Button/ButtonVW";
import Input from "@/src/components/Input/InputVW";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useTeamDb } from "@/src/hooks/useApi";
import { useAddTeamMember } from "@/src/hooks/useTeamHooks";
import { useTeamOnChain } from "@/src/hooks/useTeamOnChain";
import {
  usePendingProposals,
  useInvalidateProposals,
  type OnChainProposal,
} from "@/src/hooks/usePendingProposals";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildCreateProposalIx, validateSolanaAddress } from "@/src/lib/web3";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Crown,
  Info,
  Loader2,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  UserCircle,
  Users,
  Vote,
  X,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

type ModalType = "add" | "detail" | null;

interface MemberView {
  key: string;
  name?: string;
  avatar?: string;
  isOwner: boolean;
  hasVoter: boolean;
  hasContributor: boolean;
}

export default function Members() {
  const { activeTeam } = useActiveTeam();
  const { publicKey } = useWallet();
  const t = useTranslations("members");
  const { data: onChain, refetch: refetchOnChain } = useTeamOnChain(activeTeam?.teamWalletAddress);
  const { data: teamDb } = useTeamDb(activeTeam?.teamWalletAddress);
  const { data: proposals } = usePendingProposals(activeTeam?.teamWalletAddress);
  const tx = useTransaction();
  const invalidateProposals = useInvalidateProposals();
  const addMember = useAddTeamMember();

  const memberInfoMap = useMemo(() => {
    const map = new Map<string, { name?: string; avatar?: string }>();
    if (teamDb?.members) {
      for (const m of teamDb.members) {
        if (m.key) map.set(m.key, { name: m.name, avatar: m.avatar });
      }
    }
    return map;
  }, [teamDb]);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedMember, setSelectedMember] = useState<MemberView | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"voter" | "contributor">("voter");
  const [addressError, setAddressError] = useState<string | null>(null);

  const [recentlySubmitted, setRecentlySubmitted] = useState<Set<string>>(new Set());

  const walletAddress = publicKey?.toBase58() || "";
  const canManage = activeTeam?.isOwner || activeTeam?.isContributor;
  const teamPDA = activeTeam ? new PublicKey(activeTeam.teamWalletAddress) : null;

  const members: MemberView[] = useMemo(() => {
    if (!onChain) return [];
    const memberMap = new Map<string, MemberView>();

    const ownerInfo = memberInfoMap.get(onChain.owner);
    const ownerIsVoter = onChain.voters.includes(onChain.owner);
    const ownerIsContributor = onChain.contributors.includes(onChain.owner);
    memberMap.set(onChain.owner, {
      key: onChain.owner,
      name: ownerInfo?.name,
      avatar: ownerInfo?.avatar,
      isOwner: true,
      hasVoter: ownerIsVoter,
      hasContributor: ownerIsContributor,
    });

    for (const v of onChain.voters) {
      if (memberMap.has(v)) {
        memberMap.get(v)!.hasVoter = true;
      } else {
        const info = memberInfoMap.get(v);
        memberMap.set(v, {
          key: v,
          name: info?.name,
          avatar: info?.avatar,
          isOwner: false,
          hasVoter: true,
          hasContributor: false,
        });
      }
    }

    for (const c of onChain.contributors) {
      if (memberMap.has(c)) {
        memberMap.get(c)!.hasContributor = true;
      } else {
        const info = memberInfoMap.get(c);
        memberMap.set(c, {
          key: c,
          name: info?.name,
          avatar: info?.avatar,
          isOwner: false,
          hasVoter: false,
          hasContributor: true,
        });
      }
    }

    return Array.from(memberMap.values());
  }, [onChain, memberInfoMap]);

  const memberProposals = useMemo(() => {
    if (!proposals) {
      return [];
    }

    const filtered = proposals.filter((p) => {
      const a = p.action as any;
      return a.addVoter || a.removeVoter || a.addContributor || a.removeContributor;
    });
    return filtered;
  }, [proposals]);

  const validateNewAddress = (address: string) => {
    if (!address.trim()) {
      setAddressError(null);
      return;
    }
    if (!validateSolanaAddress(address)) {
      setAddressError(t("invalidAddress"));
      return;
    }
    if (address === onChain?.owner) {
      setAddressError(t("isOwner"));
      return;
    }

    if (onChain?.voters.includes(address) && newRole === "voter") {
      setAddressError(t("alreadyVoter"));
      return;
    }
    if (onChain?.contributors.includes(address) && newRole === "contributor") {
      setAddressError(t("alreadyContributor"));
      return;
    }

    const submitKey = `${address}-${newRole}`;
    if (recentlySubmitted.has(submitKey)) {
      setAddressError(t("recentlySubmitted"));
      return;
    }

    const hasPending = memberProposals.some((p) => {
      const a = p.action;
      const target = (a as any).addVoter?.voter || (a as any).addContributor?.contributor;
      return target === address;
    });
    if (hasPending) {
      setAddressError(t("alreadyPending"));
      return;
    }

    setAddressError(null);
  };

  const shortenAddr = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const voters = members.filter((m) => m.hasVoter);
  const contributors = members.filter((m) => m.hasContributor);

  const handleAddMember = async () => {
    if (!teamPDA || addressError || !newAddress.trim()) return;
    const provider = tx.getProvider();
    if (!provider) return;

    const addressToAdd = newAddress.trim();
    const roleToAdd = newRole;
    const nameToAdd = newName.trim();

    const memberPubkey = new PublicKey(addressToAdd);
    if (!PublicKey.isOnCurve(memberPubkey.toBytes())) {
      toast.error(t("Address is a PDA not a valid wallet address"));
      return;
    }
    const action =
      roleToAdd === "voter"
        ? { addVoter: { voter: memberPubkey } }
        : { addContributor: { contributor: memberPubkey } };

    const { instructions } = await buildCreateProposalIx(provider, teamPDA, action as any);

    await tx.execute(instructions, {
      accountKeys: [teamPDA],
      successMessage: `Proposal to add ${roleToAdd} created!`,
      onConfirmed: async () => {
        const submitKey = `${addressToAdd}-${roleToAdd}`;
        setRecentlySubmitted((prev) => new Set(prev).add(submitKey));

        if (activeTeam?.teamWalletAddress) {
          await addMember
            .mutateAsync({
              address: activeTeam.teamWalletAddress,
              input: {
                key: addressToAdd,
                name: nameToAdd || undefined,
                role: roleToAdd,
              },
            })
            .catch(() => {});
        }

        setActiveModal(null);
        setNewAddress("");
        setNewName("");

        await invalidateProposals();
        await refetchOnChain();

        setTimeout(() => {
          setRecentlySubmitted((prev) => {
            const next = new Set(prev);
            next.delete(submitKey);
            return next;
          });
        }, 10_000);
      },
    });
  };

  const hasRemovePending = (memberKey: string, role: "voter" | "contributor"): boolean => {
    const key = `remove-${memberKey}-${role}`;
    if (recentlySubmitted.has(key)) return true;
    return memberProposals.some((p) => {
      const a = p.action as any;
      if (role === "voter" && a.removeVoter) return a.removeVoter.voter === memberKey;
      if (role === "contributor" && a.removeContributor)
        return a.removeContributor.contributor === memberKey;
      return false;
    });
  };

  const hasAddPending = (memberKey: string, role: "voter" | "contributor"): boolean => {
    const key = `add-${memberKey}-${role}`;
    if (recentlySubmitted.has(key)) return true;
    return memberProposals.some((p) => {
      const a = p.action as any;
      if (role === "voter" && a.addVoter) return a.addVoter.voter === memberKey;
      if (role === "contributor" && a.addContributor)
        return a.addContributor.contributor === memberKey;
      return false;
    });
  };

  const handleRemoveMember = async (member: MemberView, role: "voter" | "contributor") => {
    if (!teamPDA) return;

    if (role === "voter" && voters.length <= 3) {
      toast.error(t("minVoters"));
      return;
    }

    if (hasRemovePending(member.key, role)) {
      toast.error(t("removeExists", { role }));
      return;
    }

    const provider = tx.getProvider();
    if (!provider) return;

    const memberPubkey = new PublicKey(member.key);
    const action =
      role === "voter"
        ? { removeVoter: { voter: memberPubkey } }
        : { removeContributor: { contributor: memberPubkey } };

    const { instructions } = await buildCreateProposalIx(provider, teamPDA, action as any);

    await tx.execute(instructions, {
      accountKeys: [teamPDA],
      successMessage: `Proposal to remove ${role} created!`,
      onConfirmed: async () => {
        const submitKey = `remove-${member.key}-${role}`;
        setRecentlySubmitted((prev) => new Set(prev).add(submitKey));
        setActiveModal(null);
        await invalidateProposals();
        await refetchOnChain();
        setTimeout(() => {
          setRecentlySubmitted((prev) => {
            const n = new Set(prev);
            n.delete(submitKey);
            return n;
          });
        }, 10_000);
      },
    });
  };

  const handleAddRole = async (member: MemberView, newRole: "voter" | "contributor") => {
    if (!teamPDA) return;

    if (hasAddPending(member.key, newRole)) {
      toast.error(t("addExists", { role: newRole }));
      return;
    }

    const provider = tx.getProvider();
    if (!provider) return;

    const memberPubkey = new PublicKey(member.key);
    const action =
      newRole === "voter"
        ? { addVoter: { voter: memberPubkey } }
        : { addContributor: { contributor: memberPubkey } };

    const { instructions } = await buildCreateProposalIx(provider, teamPDA, action as any);

    await tx.execute(instructions, {
      accountKeys: [teamPDA],
      successMessage: `Proposal to add ${newRole} role created!`,
      onConfirmed: async () => {
        const submitKey = `add-${member.key}-${newRole}`;
        setRecentlySubmitted((prev) => new Set(prev).add(submitKey));
        setActiveModal(null);
        await invalidateProposals();
        await refetchOnChain();
        setTimeout(() => {
          setRecentlySubmitted((prev) => {
            const n = new Set(prev);
            n.delete(submitKey);
            return n;
          });
        }, 10_000);
      },
    });
  };

  const getProposalDesc = (p: OnChainProposal): string => {
    const a = p.action as any;
    if (a.addVoter) return `Add voter: ${shortenAddr(a.addVoter.voter || "?")}`;
    if (a.removeVoter) return `Remove voter: ${shortenAddr(a.removeVoter.voter || "?")}`;
    if (a.addContributor)
      return `Add contributor: ${shortenAddr(a.addContributor.contributor || "?")}`;
    if (a.removeContributor)
      return `Remove contributor: ${shortenAddr(a.removeContributor.contributor || "?")}`;
    return "Member change";
  };
  const resetAddMemberForm = () => {
    setActiveModal(null);
    setNewAddress("");
    setNewName("");
    setAddressError(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">{t("Members")}</h3>
          <p className="text-neutral-content mt-1 text-sm">{t("Manage team access permissions")}</p>
        </div>
        {canManage && (
          <Button
            label={
              <>
                <Plus className="size-4.5 stroke-3" />
                {t("Add Member")}
              </>
            }
            size="sm"
            variant="primary"
            className="rounded-lg"
            onClick={() => {
              setActiveModal("add");
              setNewAddress("");
              setAddressError(null);
              tx.reset();
            }}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="border-base-200 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
          <Users className="text-primary h-3.5 w-3.5" />
          <span className="font-semibold">{members.length}</span>
          <span className="text-neutral-content">{t("members")}</span>
        </div>
        <div className="border-base-200 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
          <Vote className="text-info h-3.5 w-3.5" />
          <span className="font-semibold">{voters.length}</span>
          <span className="text-neutral-content">{t("voters")}</span>
        </div>
        <div className="border-base-200 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
          <ShieldCheck className="text-success h-3.5 w-3.5" />
          <span className="font-semibold">{contributors.length}</span>
          <span className="text-neutral-content">{t("contributors")}</span>
        </div>
        <div className="border-base-200 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
          <Shield className="text-warning h-3.5 w-3.5" />
          <span className="text-neutral-content">{t("Threshold")}</span>
          <span className="font-semibold">
            {onChain?.voteThreshold || activeTeam?.threshold} / {voters.length}
          </span>
        </div>
      </div>

      {memberProposals.length > 0 && (
        <div className="mt-5 space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="text-info size-4.5" />
            {t("Pending Member Proposals")} ({memberProposals.length})
          </h4>
          {memberProposals.map((p) => {
            const myIndex = p.snapshotVoters.indexOf(walletAddress);
            const hasVoted = myIndex !== -1 && p.votersVoted.includes(myIndex);
            const threshold = onChain?.voteThreshold || activeTeam?.threshold || 2;
            return (
              <div
                key={p.publicKey}
                className="bg-base-100 border-info/20 flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{getProposalDesc(p)}</p>
                  <div className="text-neutral-content mt-1 flex items-center gap-3 text-xs">
                    <span>
                      {t("By")}
                      {shortenAddr(p.proposer)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="text-success h-3 w-3" />
                      {p.votesFor}/{threshold} {t("votes")}
                    </span>
                  </div>
                  <div className="bg-base-300 mt-2 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-success h-full rounded-full transition-all"
                      style={{ width: `${Math.min((p.votesFor / threshold) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                {hasVoted && (
                  <span className="text-success shrink-0 text-xs font-medium">{t("Voted")}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {members.map((m) => (
          <div
            key={m.key}
            onClick={() => {
              setSelectedMember(m);
              setActiveModal("detail");
            }}
            className="bg-base-100 border-base-200 hover:border-primary/20 group relative cursor-pointer rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${m.isOwner ? "from-warning/20 to-warning/5 border-warning/20 border bg-linear-to-br" : "bg-base-200/80 border-base-300 border"}`}
              >
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt={m.name || ""} className="h-full w-full object-cover" />
                ) : m.isOwner ? (
                  <Crown className="text-warning h-5 w-5" />
                ) : (
                  <UserCircle className="text-neutral-content h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{m.name || shortenAddr(m.key)}</p>
                  <div className="flex gap-2">
                    {m.key === walletAddress && (
                      <span className="bg-primary/10 text-primary border-primary/20 flex items-center rounded-full border px-1.5 py-2 text-xs leading-0 font-bold uppercase">
                        {t("You")}
                      </span>
                    )}
                    {m.isOwner && (
                      <span className="bg-warning/10 text-warning border-warning/20 flex items-center rounded-full border px-1.5 py-2 text-xs leading-0 font-bold uppercase">
                        {t("Owner")}
                      </span>
                    )}{" "}
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-neutral-content font-mono">{shortenAddr(m.key)}</span>

                  <Button
                    label={<Copy size={12} />}
                    variant="ghost"
                    size="xs"
                    className="btn-square"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(m.key);
                      toast.success("Copied");
                    }}
                  />
                </div>
              </div>
              {!m.isOwner && canManage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const role = m.hasVoter ? "voter" : "contributor";
                    if (m.hasVoter && voters.length <= 3) {
                      toast.error(t("minVoters"));
                      return;
                    }
                    if (hasRemovePending(m.key, role)) {
                      toast.error(t("Remove proposal already pending"));
                      return;
                    }
                    handleRemoveMember(m, role);
                  }}
                  className="hover:bg-error/10 text-neutral-content hover:text-error shrink-0 rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Propose removal"
                >
                  <Trash2 className="size-4.5" />
                </button>
              )}
            </div>
            <div className="border-base-200 mt-4 flex items-center gap-1.5 border-t pt-3">
              {m.hasVoter && (
                <span className="bg-info/10 text-info border-info/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                  <Vote className="h-3 w-3" />
                  {t("Voter")}
                </span>
              )}
              {m.hasContributor && (
                <span className="bg-success/10 text-success border-success/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                  <ShieldCheck className="h-3 w-3" />
                  {t("Contributor")}
                </span>
              )}
              {m.isOwner && (
                <span className="bg-warning/10 text-warning border-warning/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                  <Crown className="h-3 w-3" />
                  {t("Owner")}
                </span>
              )}
            </div>
          </div>
        ))}
        {canManage && (
          <button
            onClick={() => {
              setActiveModal("add");
              setNewAddress("");
              setAddressError(null);
              tx.reset();
            }}
            className="border-base-300 hover:border-primary/30 hover:bg-primary/5 group flex min-h-35 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-5 transition-all"
          >
            <div className="bg-base-200 group-hover:bg-primary/10 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors">
              <Plus className="text-neutral-content group-hover:text-primary h-6 w-6 transition-colors" />
            </div>
            <p className="text-neutral-content group-hover:text-primary text-sm font-medium transition-colors">
              {t("Propose Add Member")}
            </p>
          </button>
        )}
      </div>

      {activeModal === "add" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-title"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={resetAddMemberForm}
          />
          <div className="bg-base-100 border-base-200 relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-base-200 border-b px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <h3 id="add-member-title" className="text-lg font-bold">
                  {t("Propose Add Member")}
                </h3>
                <button
                  onClick={resetAddMemberForm}
                  aria-label="Close modal"
                  className="btn-square"
                />
              </div>
              <p className="text-neutral-content mt-1 text-sm">
                {t("This creates a proposal that needs voter approval")}
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <Input
                  label="Wallet Address"
                  placeholder="Enter Solana wallet address"
                  value={newAddress}
                  onChange={(e) => {
                    setNewAddress(e.target.value);
                    validateNewAddress(e.target.value);
                  }}
                  maxLength={44}
                  required
                />
                {addressError && <p className="text-error mt-1 text-xs">{addressError}</p>}
              </div>
              <Input
                label="Display Name (optional)"
                placeholder="e.g. Alice"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={50}
              />
              <div>
                <label className="text-neutral-content mb-2 block text-sm font-medium">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setNewRole("voter");
                      if (newAddress) validateNewAddress(newAddress);
                    }}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${newRole === "voter" ? "border-info bg-info/5" : "border-base-300 hover:border-info/30"}`}
                  >
                    <Vote
                      className={`mb-1 h-5 w-5 ${newRole === "voter" ? "text-info" : "text-neutral-content"}`}
                    />
                    <p className="text-sm font-medium">{t("Voter")}</p>
                    <p className="text-neutral-content text-xs">
                      {t("Can approve reject proposals")}
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      setNewRole("contributor");
                      if (newAddress) validateNewAddress(newAddress);
                    }}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${newRole === "contributor" ? "border-success bg-success/5" : "border-base-300 hover:border-success/30"}`}
                  >
                    <ShieldCheck
                      className={`mb-1 h-5 w-5 ${newRole === "contributor" ? "text-success" : "text-neutral-content"}`}
                    />
                    <p className="text-sm font-medium">{t("Contributor")}</p>
                    <p className="text-neutral-content text-xs">{t("Can create proposals")}</p>
                  </button>
                </div>
              </div>
              <div className="bg-info/5 border-info/10 flex items-start gap-2 rounded-xl border p-3">
                <Info className="text-info size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  Requires {onChain?.voteThreshold || activeTeam?.threshold} approvals. Member
                  changes are on-chain proposals.
                </p>
              </div>
              {tx.isProcessing && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-3 rounded-xl border p-3">
                  <Loader2 className="text-primary size-4.5 animate-spin" />
                  <p className="text-sm">
                    {tx.isSigning
                      ? "Confirm in wallet..."
                      : tx.isConfirming
                        ? "Confirming on Solana..."
                        : "Building..."}
                  </p>
                </div>
              )}
              {tx.isError && tx.error && <p className="text-error text-sm">{tx.error}</p>}
            </div>
            <div className="border-base-200 flex gap-3 border-t px-6 py-4">
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onClick={resetAddMemberForm}
                disabled={tx.isProcessing}
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
                onClick={handleAddMember}
                disabled={!newAddress.trim() || !!addressError || tx.isProcessing}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}

      {activeModal === "detail" && selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-detail-title"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setActiveModal(null)}
          />
          <div className="bg-base-100 border-base-200 relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-base-200 border-b px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <h3 id="member-detail-title" className="text-lg font-bold">
                  {t("Member Details")}
                </h3>

                <Button
                  label={<X className="size-4" />}
                  size="xs"
                  onClick={() => setActiveModal(null)}
                  className="btn-square"
                />
              </div>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl ${selectedMember.isOwner ? "from-warning/20 to-warning/5 border-warning/20 border bg-linear-to-br" : "bg-base-200 border-base-300 border"}`}
                >
                  {selectedMember.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedMember.avatar}
                      alt={selectedMember.name || ""}
                      className="h-full w-full object-cover"
                    />
                  ) : selectedMember.isOwner ? (
                    <Crown className="text-warning h-7 w-7" />
                  ) : (
                    <UserCircle className="text-neutral-content h-7 w-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold">
                      {selectedMember.name || shortenAddr(selectedMember.key)}
                    </p>
                    <div className="flex gap-2">
                      {selectedMember.key === walletAddress && (
                        <span className="bg-primary/10 text-primary border-primary/20 rounded-full border px-1.5 py-2 text-xs leading-0 font-bold uppercase">
                          {t("You")}
                        </span>
                      )}
                      {selectedMember.isOwner && (
                        <span className="bg-warning/10 text-warning border-warning/20 rounded-full border px-1.5 py-2 text-xs leading-0 font-bold uppercase">
                          {t("Owner")}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-neutral-content mt-0.5 font-mono">
                    {shortenAddr(selectedMember.key)}
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    {selectedMember.isOwner && (
                      <span className="bg-warning/10 text-warning rounded-full px-2 py-0.5 text-xs font-medium">
                        {t("Owner")}
                      </span>
                    )}
                    {selectedMember.hasVoter && (
                      <span className="bg-info/10 text-info rounded-full px-2 py-0.5 text-xs font-medium">
                        {t("Voter")}
                      </span>
                    )}
                    {selectedMember.hasContributor && (
                      <span className="bg-success/10 text-success rounded-full px-2 py-0.5 text-xs font-medium">
                        {t("Contributor")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-neutral-content mb-1.5 text-xs font-medium">
                  {t("Wallet Address")}
                </p>
                <div className="glass-card flex items-center gap-2 rounded-xl px-4 py-3">
                  <span className="flex-1 font-mono text-sm break-all">{selectedMember.key}</span>

                  <Button
                    label={<Copy size={12} />}
                    variant="ghost"
                    size="xs"
                    className="btn-square"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedMember.key);
                      toast.success("Copied");
                    }}
                  />
                </div>
              </div>
              <div className="bg-warning/5 border-warning/10 flex items-start gap-2 rounded-xl border p-3">
                <AlertTriangle className="text-warning mt-0.5 size-4.5 shrink-0" />
                <p className="text-neutral-content text-xs">
                  {t(
                    "Role changes require a proposal and voter approval They cannot be toggled directly"
                  )}
                </p>
              </div>

              {!selectedMember.isOwner && canManage && (
                <div>
                  <p className="text-neutral-content mb-2 font-medium">{t("Add Role")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {!selectedMember.hasContributor && (
                      <button
                        onClick={() => handleAddRole(selectedMember, "contributor")}
                        disabled={
                          tx.isProcessing || hasAddPending(selectedMember.key, "contributor")
                        }
                        className="glass-card hover:border-success/30! hover:bg-success/5! rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ShieldCheck className="text-success mb-1 size-4.5" />
                        <p className="text-xs font-medium">{t("Add Contributor")}</p>
                        <p className="text-neutral-content text-xs">{t("Can create proposals")}</p>
                        {hasAddPending(selectedMember.key, "contributor") && (
                          <p className="text-warning mt-1 text-xs">{t("Pending")}</p>
                        )}
                      </button>
                    )}
                    {!selectedMember.hasVoter && (
                      <button
                        onClick={() => handleAddRole(selectedMember, "voter")}
                        disabled={tx.isProcessing || hasAddPending(selectedMember.key, "voter")}
                        className="border-base-300 hover:border-info/30 hover:bg-info/5 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Vote className="text-info mb-1 size-4.5" />
                        <p className="text-xs font-medium">{t("Add Voter")}</p>
                        <p className="text-neutral-content text-xs">{t("Can approve reject")}</p>
                        {hasAddPending(selectedMember.key, "voter") && (
                          <p className="text-warning mt-1 text-xs">{t("Pending")}</p>
                        )}
                      </button>
                    )}
                    {selectedMember.hasVoter && selectedMember.hasContributor && (
                      <p className="text-neutral-content bg-base-200/40 border-base-300 col-span-2 rounded-xl border p-3 text-center text-xs">
                        {t("Member already has both roles")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tx.isProcessing && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-2 rounded-xl border p-3">
                  <Loader2 className="text-primary size-4.5 animate-spin" />
                  <p className="text-xs">
                    {tx.isSigning
                      ? "Confirm in wallet..."
                      : tx.isConfirming
                        ? "Confirming..."
                        : "Processing..."}
                  </p>
                </div>
              )}
              {tx.isError && tx.error && <p className="text-error text-xs">{tx.error}</p>}
            </div>
            <div className="border-base-200 flex flex-wrap items-center gap-3 border-t px-6 py-4">
              {!selectedMember.isOwner &&
                canManage &&
                selectedMember.hasVoter &&
                voters.length > 3 && (
                  <Button
                    label={
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("Remove Voter")}
                      </>
                    }
                    variant="outline"
                    className="btn-error"
                    size="sm"
                    onClick={() => handleRemoveMember(selectedMember, "voter")}
                    disabled={tx.isProcessing || hasRemovePending(selectedMember.key, "voter")}
                  />
                )}
              {!selectedMember.isOwner && canManage && selectedMember.hasContributor && (
                <Button
                  label={
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("Remove Contributor")}
                    </>
                  }
                  variant="outline"
                  className="btn-error"
                  size="sm"
                  onClick={() => handleRemoveMember(selectedMember, "contributor")}
                  disabled={tx.isProcessing || hasRemovePending(selectedMember.key, "contributor")}
                />
              )}
              {!selectedMember.isOwner &&
                (hasRemovePending(selectedMember.key, "voter") ||
                  hasRemovePending(selectedMember.key, "contributor")) && (
                  <span className="text-warning flex items-center gap-1 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    {t("Removal pending")}
                  </span>
                )}
              <div className="flex-1" />
              <Button
                label="Close"
                variant="outline"
                size="sm"
                onClick={() => setActiveModal(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
