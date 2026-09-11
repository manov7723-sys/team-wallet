/**
 * Manual Borsh decoder for Proposal accounts.
 * Uses DataView (works in browser) instead of Node.js Buffer methods.
 */

import { PublicKey } from "@solana/web3.js";

export interface DecodedProposal {
  teamWallet: string;
  proposer: string;
  action: ProposalActionDecoded;
  votesFor: number;
  votesAgainst: number;
  votersVoted: number[];
  snapshotVoters: string[];
  snapshotThreshold: number;
  executed: boolean;
  cancelled: boolean;
  createdAt: number;
  expiresAt: number;
  approved: boolean;
  approvedAt: number;
  executionWindow: number;
  bump: number;
  nonce: string;
}

export type ProposalActionDecoded =
  | { transferSol: { amount: number; recipient: string } }
  | { transferToken: { amount: number; recipient: string; mint: string } }
  | {
      swap: {
        inputMint: string;
        outputMint: string;
        amountIn: number;
        minAmountOut: number;
        slippageBps: number;
      };
    }
  | { changeThreshold: { newThreshold: number } }
  | { addVoter: { voter: string } }
  | { removeVoter: { voter: string } }
  | { addContributor: { contributor: string } }
  | { removeContributor: { contributor: string } }
  | { upgradeProgram: { programId: string; buffer: string; spill: string } }
  | { deleteProgram: { programId: string; spill: string } }
  | { tokenMint: { mint: string; amount: number; recipient: string } }
  | { tokenBurn: { mint: string; amount: number } }
  | { tokenFreeze: { mint: string; account: string } }
  | { tokenThaw: { mint: string; account: string } }
  | { tokenSetMintAuthority: { mint: string; newAuthority: string | null } }
  | { tokenSetFreezeAuthority: { mint: string; newAuthority: string | null } }
  | { tokenUpdateMetadata: { mint: string; name: string; symbol: string; uri: string } }
  | { unknown: { variantIndex: number } };

class BorshReader {
  private data: Uint8Array;
  private view: DataView;
  private offset: number;

  constructor(data: Uint8Array | Buffer) {
    this.data = new Uint8Array(data);
    this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    this.offset = 0;
  }

  readU8(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  readU16LE(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readU32LE(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readU64LE(): number {
    const lo = this.view.getUint32(this.offset, true);
    const hi = this.view.getUint32(this.offset + 4, true);
    this.offset += 8;
    return lo + hi * 0x100000000;
  }

  readI64LE(): number {
    const lo = this.view.getUint32(this.offset, true);
    const hi = this.view.getInt32(this.offset + 4, true);
    this.offset += 8;
    return lo + hi * 0x100000000;
  }

  readBool(): boolean {
    return this.readU8() === 1;
  }

  readPubkey(): string {
    const bytes = this.data.slice(this.offset, this.offset + 32);
    this.offset += 32;
    return new PublicKey(bytes).toBase58();
  }

  readBytes(): Uint8Array {
    const len = this.readU32LE();
    const bytes = this.data.slice(this.offset, this.offset + len);
    this.offset += len;
    return bytes;
  }

  readVecPubkey(): string[] {
    const len = this.readU32LE();
    const keys: string[] = [];
    for (let i = 0; i < len; i++) {
      keys.push(this.readPubkey());
    }
    return keys;
  }

  readString(): string {
    const len = this.readU32LE();
    const bytes = this.data.slice(this.offset, this.offset + len);
    this.offset += len;
    return new TextDecoder().decode(bytes);
  }

  readOptionPubkey(): string | null {
    const isSome = this.readU8();
    if (isSome === 1) return this.readPubkey();
    return null;
  }

  skip(n: number) {
    this.offset += n;
  }

  getOffset(): number {
    return this.offset;
  }
}

function readAction(r: BorshReader): ProposalActionDecoded {
  const variant = r.readU8();
  switch (variant) {
    case 0:
      return { transferSol: { amount: r.readU64LE(), recipient: r.readPubkey() } };
    case 1:
      return {
        transferToken: { amount: r.readU64LE(), recipient: r.readPubkey(), mint: r.readPubkey() },
      };
    case 2:
      return {
        swap: {
          inputMint: r.readPubkey(),
          outputMint: r.readPubkey(),
          amountIn: r.readU64LE(),
          minAmountOut: r.readU64LE(),
          slippageBps: r.readU16LE(),
        },
      };
    case 3:
      return { changeThreshold: { newThreshold: r.readU8() } };
    case 4:
      return { addVoter: { voter: r.readPubkey() } };
    case 5:
      return { removeVoter: { voter: r.readPubkey() } };
    case 6:
      return { addContributor: { contributor: r.readPubkey() } };
    case 7:
      return { removeContributor: { contributor: r.readPubkey() } };
    case 8:
      return {
        upgradeProgram: {
          programId: r.readPubkey(),
          buffer: r.readPubkey(),
          spill: r.readPubkey(),
        },
      };
    case 9:
      return { deleteProgram: { programId: r.readPubkey(), spill: r.readPubkey() } };
    case 10:
      return {
        tokenMint: { mint: r.readPubkey(), amount: r.readU64LE(), recipient: r.readPubkey() },
      };
    case 11:
      return { tokenBurn: { mint: r.readPubkey(), amount: r.readU64LE() } };
    case 12:
      return { tokenFreeze: { mint: r.readPubkey(), account: r.readPubkey() } };
    case 13:
      return { tokenThaw: { mint: r.readPubkey(), account: r.readPubkey() } };
    case 14:
      return {
        tokenSetMintAuthority: { mint: r.readPubkey(), newAuthority: r.readOptionPubkey() },
      };
    case 15:
      return {
        tokenSetFreezeAuthority: { mint: r.readPubkey(), newAuthority: r.readOptionPubkey() },
      };
    case 16:
      return {
        tokenUpdateMetadata: {
          mint: r.readPubkey(),
          name: r.readString(),
          symbol: r.readString(),
          uri: r.readString(),
        },
      };
    default:
      return { unknown: { variantIndex: variant } };
  }
}

export function decodeProposal(data: Uint8Array | Buffer): DecodedProposal {
  const r = new BorshReader(data);

  r.skip(8);

  const teamWallet = r.readPubkey();
  const proposer = r.readPubkey();
  const action = readAction(r);
  const votesFor = r.readU8();
  const votesAgainst = r.readU8();
  const votersVotedBytes = r.readBytes();
  const votersVoted = Array.from(votersVotedBytes);
  const snapshotVoters = r.readVecPubkey();
  const OLD_PROPOSAL_SPACE = 1509;
  const hasSnapshotThreshold = data.length > OLD_PROPOSAL_SPACE;
  const snapshotThreshold = hasSnapshotThreshold ? r.readU8() : 0;

  const executed = r.readBool();
  const cancelled = r.readBool();
  const createdAt = r.readI64LE();
  const expiresAt = r.readI64LE();
  const approved = r.readBool();
  const approvedAt = r.readI64LE();
  const executionWindow = r.readI64LE();
  const bump = r.readU8();
  const nonce = r.readPubkey();

  return {
    teamWallet,
    proposer,
    action,
    votesFor,
    votesAgainst,
    votersVoted,
    snapshotVoters,
    snapshotThreshold,
    executed,
    cancelled,
    createdAt,
    expiresAt,
    approved,
    approvedAt,
    executionWindow,
    bump,
    nonce,
  };
}
