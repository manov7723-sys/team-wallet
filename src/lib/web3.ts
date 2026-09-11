/**
 * Web3 Utilities — Team Wallet Program
 *
 * This module provides full instruction builders, helpers, and error handling
 * for interacting with the on-chain Team Wallet program on Solana.
 *
 * Program ID: 2CeVF4gvaMV6GGF7pSbZgyrP7YtWwALRVAi8CcPP3t72
 *
 * - getProgram(provider): Returns an Anchor program instance.
 * - createProvider(connection, wallet): Creates an AnchorProvider for a connection and wallet.
 * - getTeamWalletPDA(owner, name): Derives the PDA for a team wallet given the owner and name.
 * - getProposalPDA(teamWallet): Generates a new proposal PDA with a random nonce.
 * - getProposalPDAWithNonce(teamWallet, nonce): Derives a proposal PDA using a specific nonce.
 * - buildInitializeTeamWalletIx(provider, teamWalletPDA, name, threshold, voters): Builds instructions to initialize a team wallet.
 * - fetchTeamWallet(provider, teamWalletPDA): Fetches the team wallet account from-chain.
 * - buildCreateProposalIx(provider, teamWalletPDA, action): Builds instructions to create a new proposal.
 * - buildVoteProposalIx(provider, proposalPDA, teamWalletPDA, voteFor): Builds instructions to vote on a proposal.
 * - buildExecuteProposalIx(provider, proposalPDA, teamWalletPDA, decodedAction?, swapData?, jupiterSwapAccounts?): Builds instructions to execute a proposal.
 * - buildCancelProposalIx(provider, proposalPDA, teamWalletPDA): Builds instructions to cancel a proposal.
 * - prepareJupiterSwap(connection, teamWalletPDA, action): Prepares Jupiter swap instructions and accounts for a swap proposal.
 * - buildCloseProposalIx(provider, proposalPDA, teamWalletPDA, rentReceiver): Builds instructions to close a proposal account.
 * - buildTransferMintAuthorityIx(provider, teamWalletPDA, mint): Builds instructions to transfer mint authority of a token to the team PDA.
 * - buildTransferFreezeAuthorityIx(provider, teamWalletPDA, mint): Builds instructions to transfer freeze authority of a token to the team PDA.
 * - buildTransferProgramAuthorityIx(provider, teamWalletPDA, programAddress, currentAuthority): Builds instructions to transfer program authority.
 * - buildSetBufferAuthorityIx(bufferAddress, currentAuthority, newAuthority): Builds instructions to set authority on a BPF buffer.
 * - buildCreateTokenIx(connection, params): Builds all instructions to create a Token-2022 token with metadata and optional features.
 * - getRecentPriorityFee(connection, accountKeys?): Fetches recent Solana prioritization fee (for V0 transactions).
 * - buildComputeBudgetIxs(computeUnits?, microLamports?): Returns instructions to set compute unit limit and price.
 * - prepareV0Transaction(provider, instructions, options?): Prepares a versioned transaction (V0) with compute budget and optional priority fees.
 * - sendAndConfirmTransaction(connection, signedTx, blockhash, lastValidBlockHeight, commitment?): Sends a signed transaction and confirms it with timeout protection.
 * - isUserRejection(err): Checks if an error corresponds to user rejection of a transaction.
 * - getTxErrorMessage(err): Returns a human-readable error message from a transaction failure.
 * - validateSolanaAddress(address): Validates if a string is a valid Solana address.
 *
 * These utilities handle Solana account derivation (PDAs), proposal management, token creation,
 * authority transfers, swap preparation (Jupiter), compute budget management, transaction preparation,
 * and enhanced error handling for Team Wallet programs.
 */
import { IDL, PROGRAM_ID_STRING } from "@/src/lib/programidl";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createInitializeMetadataPointerInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeNonTransferableMintInstruction,
  createInitializeInterestBearingMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getMintLen,
  ExtensionType,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createInitializeInstruction as createInitializeMetadataInstruction,
  pack as packTokenMetadata,
  type TokenMetadata,
} from "@solana/spl-token-metadata";

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);
const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

export function getProgram(provider: AnchorProvider): anchor.Program {
  return new anchor.Program(IDL as unknown as anchor.Idl, provider);
}

export function createProvider(connection: Connection, wallet: anchor.Wallet): AnchorProvider {
  return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
}

export function getTeamWalletPDA(owner: PublicKey, name: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("team_wallet"), owner.toBuffer(), Buffer.from(name)],
    PROGRAM_ID
  );
}

export function getProposalPDA(teamWallet: PublicKey): [PublicKey, PublicKey, number] {
  const nonce = Keypair.generate().publicKey;
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), teamWallet.toBuffer(), nonce.toBuffer()],
    PROGRAM_ID
  );
  return [pda, nonce, bump];
}

export function getProposalPDAWithNonce(
  teamWallet: PublicKey,
  nonce: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), teamWallet.toBuffer(), nonce.toBuffer()],
    PROGRAM_ID
  );
}

export type ProposalAction =
  | { transferSol: { amount: anchor.BN; recipient: PublicKey } }
  | { transferToken: { amount: anchor.BN; recipient: PublicKey; mint: PublicKey } }
  | {
      swap: {
        inputMint: PublicKey;
        outputMint: PublicKey;
        amountIn: anchor.BN;
        minAmountOut: anchor.BN;
        slippageBps: number;
      };
    }
  | { changeThreshold: { newThreshold: number } }
  | { addVoter: { voter: PublicKey } }
  | { removeVoter: { voter: PublicKey } }
  | { addContributor: { contributor: PublicKey } }
  | { removeContributor: { contributor: PublicKey } }
  | { upgradeProgram: { programId: PublicKey; buffer: PublicKey; spill: PublicKey } }
  | { deleteProgram: { programId: PublicKey; spill: PublicKey } }
  | { tokenMint: { mint: PublicKey; amount: anchor.BN; recipient: PublicKey } }
  | { tokenBurn: { mint: PublicKey; amount: anchor.BN } }
  | { tokenFreeze: { mint: PublicKey; account: PublicKey } }
  | { tokenThaw: { mint: PublicKey; account: PublicKey } }
  | { tokenSetMintAuthority: { mint: PublicKey; newAuthority: PublicKey | null } }
  | { tokenSetFreezeAuthority: { mint: PublicKey; newAuthority: PublicKey | null } }
  | { tokenUpdateMetadata: { mint: PublicKey; name: string; symbol: string; uri: string } };

export interface InstructionResult {
  instructions: TransactionInstruction[];
}

export interface ProposalInstructionResult extends InstructionResult {
  proposalPDA: PublicKey;
  nonce: PublicKey;
}

export async function buildInitializeTeamWalletIx(
  provider: AnchorProvider,
  teamWalletPDA: PublicKey,
  name: string,
  threshold: number,
  voters: PublicKey[]
): Promise<InstructionResult> {
  const program = getProgram(provider);
  const ix = await program.methods
    .initializeTeamWallet(name, threshold, voters)
    .accounts({
      teamWallet: teamWalletPDA,
      owner: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return { instructions: [ix] };
}

export async function fetchTeamWallet(
  provider: AnchorProvider,
  teamWalletPDA: PublicKey
): Promise<any> {
  const program = getProgram(provider);
  return (program.account as any).teamWallet.fetch(teamWalletPDA);
}

export async function buildCreateProposalIx(
  provider: AnchorProvider,
  teamWalletPDA: PublicKey,
  action: ProposalAction
): Promise<ProposalInstructionResult> {
  const program = getProgram(provider);
  const [proposalPDA, nonce] = getProposalPDA(teamWalletPDA);

  const ix = await program.methods
    .createProposal(action, nonce)
    .accounts({
      proposal: proposalPDA,
      teamWallet: teamWalletPDA,
      proposer: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return { instructions: [ix], proposalPDA, nonce };
}

export async function buildVoteProposalIx(
  provider: AnchorProvider,
  proposalPDA: PublicKey,
  teamWalletPDA: PublicKey,
  voteFor: boolean
): Promise<InstructionResult> {
  const program = getProgram(provider);
  const ix = await program.methods
    .voteProposal(voteFor)
    .accounts({
      proposal: proposalPDA,
      teamWallet: teamWalletPDA,
      voter: provider.wallet.publicKey,
    })
    .instruction();
  return { instructions: [ix] };
}

export async function buildExecuteProposalIx(
  provider: AnchorProvider,
  proposalPDA: PublicKey,
  teamWalletPDA: PublicKey,
  decodedAction?: any,
  swapData: Buffer | null = null,
  jupiterSwapAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = []
): Promise<InstructionResult> {
  const connection = provider.connection;

  let action = decodedAction;
  if (!action) {
    const { decodeProposal } = await import("@/src/lib/proposalDecoder");
    const accountInfo = await connection.getAccountInfo(proposalPDA);
    if (!accountInfo) throw new Error("Proposal account not found");
    const decoded = decodeProposal(accountInfo.data);
    action = decoded.action;
  }

  const toPk = (addr: string | any): PublicKey => {
    if (typeof addr === "string") return new PublicKey(addr);
    if (addr instanceof PublicKey) return addr;
    if (addr?.toBase58) return addr;
    throw new Error(`Cannot convert to PublicKey: ${addr}`);
  };

  const instructions: TransactionInstruction[] = [];
  const remainingAccounts: any[] = [];

  if (action.transferSol) {
    remainingAccounts.push({
      pubkey: toPk(action.transferSol.recipient),
      isSigner: false,
      isWritable: true,
    });
  } else if (action.transferToken) {
    const mint = toPk(action.transferToken.mint);
    const recipient = toPk(action.transferToken.recipient);
    const mintInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    const teamAta = await getAssociatedTokenAddress(mint, teamWalletPDA, true, tokenProgramId);
    const isRecipientPDA = !PublicKey.isOnCurve(recipient.toBytes());
    const recipientAta = await getAssociatedTokenAddress(
      mint,
      recipient,
      isRecipientPDA,
      tokenProgramId
    );

    try {
      await connection.getTokenAccountBalance(recipientAta);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          provider.wallet.publicKey,
          recipientAta,
          recipient,
          mint,
          tokenProgramId
        )
      );
    }
    remainingAccounts.push(
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: teamAta, isSigner: false, isWritable: true },
      { pubkey: recipientAta, isSigner: false, isWritable: true },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false }
    );
  } else if (action.tokenMint) {
    const mint = toPk(action.tokenMint.mint);
    const recipient = toPk(action.tokenMint.recipient);
    const mintInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    const recipientAta = await getAssociatedTokenAddress(
      mint,
      recipient,
      !PublicKey.isOnCurve(recipient.toBytes()),
      tokenProgramId
    );
    try {
      await connection.getTokenAccountBalance(recipientAta);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          provider.wallet.publicKey,
          recipientAta,
          recipient,
          mint,
          tokenProgramId
        )
      );
    }
    remainingAccounts.push(
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: recipientAta, isSigner: false, isWritable: true },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false }
    );
  } else if (action.tokenBurn) {
    const mint = toPk(action.tokenBurn.mint);
    const mintInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    const teamAta = await getAssociatedTokenAddress(mint, teamWalletPDA, true, tokenProgramId);
    remainingAccounts.push(
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: teamAta, isSigner: false, isWritable: true },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false }
    );
  } else if (action.tokenFreeze || action.tokenThaw) {
    const data = action.tokenFreeze || action.tokenThaw;
    const mint = toPk(data.mint);
    const mintInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    remainingAccounts.push(
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: toPk(data.account), isSigner: false, isWritable: true },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false }
    );
  } else if (action.tokenSetMintAuthority || action.tokenSetFreezeAuthority) {
    const data = action.tokenSetMintAuthority || action.tokenSetFreezeAuthority;
    const mint = toPk(data.mint);
    const mintInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    remainingAccounts.push(
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false }
    );
  } else if (action.tokenUpdateMetadata) {
    const mint = toPk(action.tokenUpdateMetadata.mint);
    const mintInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    remainingAccounts.push(
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false }
    );
  } else if (action.upgradeProgram) {
    const programId = toPk(action.upgradeProgram.programId);
    const buffer = toPk(action.upgradeProgram.buffer);
    const spill = toPk(action.upgradeProgram.spill);
    const [programDataPDA] = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_LOADER_UPGRADEABLE
    );
    const SYSVAR_RENT = new PublicKey("SysvarRent111111111111111111111111111111111");
    const SYSVAR_CLOCK = new PublicKey("SysvarC1ock11111111111111111111111111111111");
    remainingAccounts.push(
      { pubkey: programId, isSigner: false, isWritable: true },
      { pubkey: programDataPDA, isSigner: false, isWritable: true },
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: spill, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK, isSigner: false, isWritable: false },
      { pubkey: BPF_LOADER_UPGRADEABLE, isSigner: false, isWritable: false }
    );
  } else if (action.deleteProgram) {
    const programId = toPk(action.deleteProgram.programId);
    const spill = toPk(action.deleteProgram.spill);
    const [programDataPDA] = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_LOADER_UPGRADEABLE
    );
    remainingAccounts.push(
      { pubkey: programId, isSigner: false, isWritable: true },
      { pubkey: programDataPDA, isSigner: false, isWritable: true },
      { pubkey: spill, isSigner: false, isWritable: true },
      { pubkey: BPF_LOADER_UPGRADEABLE, isSigner: false, isWritable: false }
    );
  } else if (action.swap && jupiterSwapAccounts.length > 0) {
    remainingAccounts.push(...jupiterSwapAccounts);
  }

  const executeIxDef = IDL.instructions.find((ix: any) => ix.name === "execute_proposal");
  if (!executeIxDef?.discriminator) {
    throw new Error("execute_proposal instruction not found in IDL — IDL may have changed");
  }
  const EXECUTE_DISCRIMINATOR = Buffer.from(executeIxDef.discriminator);

  let swapDataBuf: Buffer;
  if (swapData) {
    swapDataBuf = Buffer.alloc(1 + 4 + swapData.length);
    swapDataBuf.writeUInt8(1, 0);
    swapDataBuf.writeUInt32LE(swapData.length, 1);
    swapData.copy(swapDataBuf, 5);
  } else {
    swapDataBuf = Buffer.from([0]);
  }

  const ixData = Buffer.concat([EXECUTE_DISCRIMINATOR, swapDataBuf]);

  const keys = [
    { pubkey: proposalPDA, isSigner: false, isWritable: true },
    { pubkey: teamWalletPDA, isSigner: false, isWritable: true },
    { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ...remainingAccounts,
  ];

  const executeIx = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: ixData,
  });

  instructions.push(executeIx);
  return { instructions };
}

export async function buildCancelProposalIx(
  provider: AnchorProvider,
  proposalPDA: PublicKey,
  teamWalletPDA: PublicKey
): Promise<InstructionResult> {
  const program = getProgram(provider);
  const ix = await program.methods
    .cancelProposal()
    .accounts({
      proposal: proposalPDA,
      teamWallet: teamWalletPDA,
      canceller: provider.wallet.publicKey,
    })
    .instruction();
  return { instructions: [ix] };
}

export async function prepareJupiterSwap(
  connection: Connection,
  teamWalletPDA: PublicKey,
  action: { inputMint: string; outputMint: string; amountIn: number | string; slippageBps: number }
): Promise<{
  swapData: Buffer;
  jupiterAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}> {
  const { getSwapBuild } = await import("@/src/lib/jupiter");

  const build = await getSwapBuild({
    inputMint: action.inputMint,
    outputMint: action.outputMint,
    amount: String(action.amountIn),
    taker: teamWalletPDA.toBase58(),
    slippageBps: action.slippageBps,
    maxAccounts: 20,
  });

  const swapIxData = Buffer.from(build.swapInstruction.data, "base64");
  const jupiterProgramId = new PublicKey(build.swapInstruction.programId);

  const outputMint = new PublicKey(action.outputMint);
  const outputAta = await getAssociatedTokenAddress(outputMint, teamWalletPDA, true);

  const jupiterAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
  jupiterAccounts.push({ pubkey: jupiterProgramId, isSigner: false, isWritable: false });
  jupiterAccounts.push({ pubkey: outputAta, isSigner: false, isWritable: true });
  for (const acc of build.swapInstruction.accounts) {
    jupiterAccounts.push({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: false,
      isWritable: acc.isWritable,
    });
  }

  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  if (build.addressesByLookupTableAddress) {
    const entries = Object.entries(build.addressesByLookupTableAddress);
    for (const [altAddr] of entries) {
      try {
        const result = await connection.getAddressLookupTable(new PublicKey(altAddr));
        if (result.value) addressLookupTableAccounts.push(result.value);
      } catch {}
    }
  }

  return { swapData: swapIxData, jupiterAccounts, addressLookupTableAccounts };
}

export async function buildCloseProposalIx(
  provider: AnchorProvider,
  proposalPDA: PublicKey,
  teamWalletPDA: PublicKey,
  rentReceiver: PublicKey
): Promise<InstructionResult> {
  const program = getProgram(provider);
  const ix = await program.methods
    .closeProposal()
    .accounts({
      proposal: proposalPDA,
      teamWallet: teamWalletPDA,
      closer: provider.wallet.publicKey,
      rentReceiver,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return { instructions: [ix] };
}

export async function buildTransferMintAuthorityIx(
  provider: AnchorProvider,
  teamWalletPDA: PublicKey,
  mint: PublicKey
): Promise<InstructionResult> {
  const program = getProgram(provider);
  const mintInfo = await provider.connection.getAccountInfo(mint);
  const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
  const ix = await program.methods
    .transferMintAuthority()
    .accounts({
      teamWallet: teamWalletPDA,
      mint,
      currentAuthority: provider.wallet.publicKey,
      tokenProgram: tokenProgramId,
    })
    .instruction();
  return { instructions: [ix] };
}

export async function buildTransferFreezeAuthorityIx(
  provider: AnchorProvider,
  teamWalletPDA: PublicKey,
  mint: PublicKey
): Promise<InstructionResult> {
  const program = getProgram(provider);
  const mintInfo = await provider.connection.getAccountInfo(mint);
  const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
  const ix = await program.methods
    .transferFreezeAuthority()
    .accounts({
      teamWallet: teamWalletPDA,
      mint,
      currentAuthority: provider.wallet.publicKey,
      tokenProgram: tokenProgramId,
    })
    .instruction();
  return { instructions: [ix] };
}

export async function buildTransferProgramAuthorityIx(
  provider: AnchorProvider,
  teamWalletPDA: PublicKey,
  programAddress: PublicKey,
  currentAuthority: PublicKey
): Promise<InstructionResult> {
  const program = getProgram(provider);
  const [programDataPDA] = PublicKey.findProgramAddressSync(
    [programAddress.toBuffer()],
    BPF_LOADER_UPGRADEABLE
  );
  const ix = await program.methods
    .transferProgramAuthority()
    .accounts({
      teamWallet: teamWalletPDA,
      programId: programAddress,
      programData: programDataPDA,
      currentAuthority,
      bpfLoaderUpgradeableProgram: BPF_LOADER_UPGRADEABLE,
    })
    .instruction();
  return { instructions: [ix] };
}

export function buildSetBufferAuthorityIx(
  bufferAddress: PublicKey,
  currentAuthority: PublicKey,
  newAuthority: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(4 + 1 + 32);
  data.writeUInt32LE(4, 0);
  data.writeUInt8(1, 4);
  newAuthority.toBuffer().copy(data, 5);

  return new TransactionInstruction({
    keys: [
      { pubkey: bufferAddress, isSigner: false, isWritable: true },
      { pubkey: currentAuthority, isSigner: true, isWritable: false },
    ],
    programId: BPF_LOADER_UPGRADEABLE,
    data,
  });
}

export interface CreateTokenParams {
  payer: PublicKey;
  mintKeypair: Keypair;
  teamWalletPDA: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  initialSupply: bigint;
  enableMintAuthority: boolean;
  enableFreezeAuthority: boolean;
  transferFee?: { bps: number };
  nonTransferable?: boolean;
  interestBearing?: { rate: number };
}

export interface CreateTokenResult {
  instructions: TransactionInstruction[];
  mintKeypair: Keypair;
}

export async function buildCreateTokenIx(
  connection: Connection,
  params: CreateTokenParams
): Promise<CreateTokenResult> {
  const {
    payer,
    mintKeypair,
    teamWalletPDA,
    name,
    symbol,
    uri,
    decimals,
    initialSupply,
    enableMintAuthority,
    enableFreezeAuthority,
    transferFee,
    nonTransferable,
    interestBearing,
  } = params;

  const mint = mintKeypair.publicKey;
  const instructions: TransactionInstruction[] = [];

  const extensions: ExtensionType[] = [ExtensionType.MetadataPointer];
  if (transferFee) extensions.push(ExtensionType.TransferFeeConfig);
  if (nonTransferable) extensions.push(ExtensionType.NonTransferable);
  if (interestBearing) extensions.push(ExtensionType.InterestBearingConfig);

  const mintLen = getMintLen(extensions);

  const metadata: TokenMetadata = {
    mint,
    name,
    symbol,
    uri,
    updateAuthority: payer,
    additionalMetadata: [],
  };
  const metadataLen = packTokenMetadata(metadata).length;

  const TYPE_SIZE = 2;
  const LENGTH_SIZE = 2;
  const totalSpace = mintLen + TYPE_SIZE + LENGTH_SIZE + metadataLen;

  const lamports = await connection.getMinimumBalanceForRentExemption(totalSpace);

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );

  if (transferFee) {
    instructions.push(
      createInitializeTransferFeeConfigInstruction(
        mint,
        teamWalletPDA,
        teamWalletPDA,
        transferFee.bps,
        BigInt("18446744073709551615"),
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  if (nonTransferable) {
    instructions.push(createInitializeNonTransferableMintInstruction(mint, TOKEN_2022_PROGRAM_ID));
  }

  if (interestBearing) {
    instructions.push(
      createInitializeInterestBearingMintInstruction(
        mint,
        teamWalletPDA,
        interestBearing.rate,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  instructions.push(
    createInitializeMetadataPointerInstruction(mint, payer, mint, TOKEN_2022_PROGRAM_ID)
  );

  instructions.push(
    createInitializeMint2Instruction(
      mint,
      decimals,
      payer,
      enableFreezeAuthority ? payer : null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  instructions.push(
    createInitializeMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint,
      metadata: mint,
      mintAuthority: payer,
      name,
      symbol,
      uri,
      updateAuthority: payer,
    })
  );

  if (initialSupply > BigInt(0)) {
    const teamAta = await getAssociatedTokenAddress(
      mint,
      teamWalletPDA,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer,
        teamAta,
        teamWalletPDA,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    instructions.push(
      createMintToInstruction(mint, teamAta, payer, initialSupply, [], TOKEN_2022_PROGRAM_ID)
    );
  }

  if (enableMintAuthority) {
    instructions.push(
      createSetAuthorityInstruction(
        mint,
        payer,
        AuthorityType.MintTokens,
        teamWalletPDA,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
  } else {
    instructions.push(
      createSetAuthorityInstruction(
        mint,
        payer,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  if (enableFreezeAuthority) {
    instructions.push(
      createSetAuthorityInstruction(
        mint,
        payer,
        AuthorityType.FreezeAccount,
        teamWalletPDA,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  return { instructions, mintKeypair };
}

import { ComputeBudgetProgram } from "@solana/web3.js";
import logger from "./logger";

export async function getRecentPriorityFee(
  connection: Connection,
  accountKeys: PublicKey[] = []
): Promise<number> {
  try {
    const fees = await connection.getRecentPrioritizationFees({
      lockedWritableAccounts: accountKeys.slice(0, 5),
    });
    if (fees.length === 0) return 50_000;

    const sorted = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return Math.max(median, 1_000);
  } catch {
    return 50_000;
  }
}

export function buildComputeBudgetIxs(
  computeUnits: number = 200_000,
  microLamports: number = 50_000
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
  ];
}

export interface PreparedTransaction {
  tx: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function prepareV0Transaction(
  provider: AnchorProvider,
  instructions: TransactionInstruction[],
  options?: {
    computeUnits?: number;
    priorityFeeMicroLamports?: number;
    skipPriorityFee?: boolean;
    accountKeys?: PublicKey[];
    addressLookupTableAccounts?: AddressLookupTableAccount[];
  }
): Promise<PreparedTransaction> {
  const connection = provider.connection;
  const payer = provider.wallet.publicKey;
  const alts = options?.addressLookupTableAccounts || [];

  let priorityFee = options?.priorityFeeMicroLamports;
  if (!options?.skipPriorityFee && priorityFee === undefined) {
    priorityFee = await getRecentPriorityFee(connection, options?.accountKeys);
  }
  let computeUnits = options?.computeUnits;
  if (!computeUnits && !options?.skipPriorityFee) {
    computeUnits = await simulateComputeUnits(connection, payer, instructions, alts);
  }

  const allInstructions: TransactionInstruction[] = [];
  if (!options?.skipPriorityFee) {
    allInstructions.push(...buildComputeBudgetIxs(computeUnits || 200_000, priorityFee || 50_000));
  }
  allInstructions.push(...instructions);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: allInstructions,
  }).compileToV0Message(alts.length > 0 ? alts : undefined);

  return {
    tx: new VersionedTransaction(messageV0),
    blockhash,
    lastValidBlockHeight,
  };
}

async function simulateComputeUnits(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[],
  addressLookupTableAccounts: AddressLookupTableAccount[] = []
): Promise<number> {
  const DEFAULT = 200_000;
  try {
    const simIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      ...instructions,
    ];
    const { blockhash } = await connection.getLatestBlockhash();
    const simMessage = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: simIxs,
    }).compileToV0Message(
      addressLookupTableAccounts.length > 0 ? addressLookupTableAccounts : undefined
    );
    const simTx = new VersionedTransaction(simMessage);

    const result = await connection.simulateTransaction(simTx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });

    if (result.value.err) {
      return DEFAULT;
    }

    const consumed = result.value.unitsConsumed;
    if (!consumed || consumed === 0) return DEFAULT;

    const withMargin = Math.ceil(consumed * 1.2) + 20_000;
    return Math.min(withMargin, 1_400_000);
  } catch (err) {
    logger.error("Error from simulateComputeUnits ", err);
    return DEFAULT;
  }
}

/**
 * Send a signed transaction and confirm it with timeout protection.
 */
export async function sendAndConfirmTransaction(
  connection: Connection,
  signedTx: VersionedTransaction,
  blockhash: string,
  lastValidBlockHeight: number,
  commitment: "confirmed" | "finalized" = "confirmed"
): Promise<string> {
  const serialized = signedTx.serialize();

  const signature = await connection.sendRawTransaction(serialized, {
    skipPreflight: true,
    maxRetries: 5,
  });
  const startTime = Date.now();
  const TIMEOUT_MS = 60_000;
  const POLL_INTERVAL_MS = 2_000;

  while (Date.now() - startTime < TIMEOUT_MS) {
    try {
      const { value: statuses } = await connection.getSignatureStatuses([signature]);
      const status = statuses?.[0];

      if (status) {
        if (status.err) {
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
        }

        const level = status.confirmationStatus;
        if (commitment === "confirmed" && (level === "confirmed" || level === "finalized")) {
          return signature;
        }
        if (commitment === "finalized" && level === "finalized") {
          return signature;
        }
      }

      const blockHeight = await connection.getBlockHeight("confirmed");
      if (blockHeight > lastValidBlockHeight) {
        throw new Error("Transaction expired — blockhash no longer valid. Please try again.");
      }
    } catch (err: any) {
      if (err.message?.includes("failed on-chain") || err.message?.includes("expired")) {
        throw err;
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  try {
    const { value: statuses } = await connection.getSignatureStatuses([signature]);
    const status = statuses?.[0];
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return signature;
    }
  } catch {}

  throw new Error("Transaction confirmation timeout (60s). It may still confirm — check explorer.");
}

export function isUserRejection(err: any): boolean {
  const msg = err?.message || err?.toString() || "";
  return (
    msg.includes("User rejected") ||
    msg.includes("rejected the request") ||
    msg.includes("user rejected") ||
    msg.includes("Transaction cancelled") ||
    err?.name === "WalletSignTransactionError" ||
    err?.name === "WalletSendTransactionError"
  );
}

/**
 * Get a human-readable error message from a transaction error.
 */
const ANCHOR_ERRORS: Record<number, string> = {
  100: "Instruction missing",
  101: "Fallback instruction handler not found",
  102: "Failed to deserialize instruction",
  103: "Failed to serialize instruction",
  2000: "A mut constraint was violated",
  2001: "A has_one constraint was violated",
  2002: "A signer constraint was violated",
  2003: "A raw constraint was violated",
  2004: "An owner constraint was violated",
  2005: "A rent-exempt constraint was violated",
  2006: "A seeds constraint was violated (PDA mismatch)",
  2007: "An executable constraint was violated",
  2008: "Deprecated state constraint",
  2009: "An associated constraint was violated",
  2010: "An associated init constraint was violated",
  2011: "A close constraint was violated",
  2012: "An address constraint was violated",
  3000: "Account discriminator already set",
  3001: "Account discriminator not found",
  3002: "Account discriminator mismatch",
  3003: "Failed to deserialize account",
  3004: "Failed to serialize account",
  3005: "Not enough account keys",
  3006: "Account not mutable",
  3007: "Account owned by wrong program — the team wallet PDA may not match this program ID",
  3008: "Invalid program ID",
  3009: "Invalid program executable",
  3010: "Account did not sign the transaction",
  3011: "Account is not a system account",
  3012: "Account is not initialized",
  3013: "Account is not a PDA",
};

const PROGRAM_ERRORS: Record<number, string> = {
  6000: "Maximum voters reached (15)",
  6001: "Maximum contributors reached (15)",
  6002: "Voter already exists",
  6003: "Voter not found",
  6004: "Contributor already exists",
  6005: "Contributor not found",
  6006: "Cannot remove the owner",
  6007: "Duplicate voter",
  6008: "Owner cannot be in voters list",
  6009: "Already a voter",
  6010: "Invalid threshold",
  6011: "Not a voter or contributor",
  6012: "Not authorized to create proposals",
  6013: "Not authorized to vote",
  6014: "Already voted on this proposal",
  6015: "Proposal already executed",
  6016: "Proposal has been cancelled",
  6017: "Proposal has expired",
  6018: "Proposal has not expired yet",
  6019: "Insufficient votes to execute",
  6020: "Not authorized to cancel",
  6021: "Invalid proposal type",
  6022: "Not authorized to execute (only proposal creator)",
  6023: "Cannot swap same token",
  6024: "Slippage too high (max 50%)",
  6025: "Swap execution window expired",
  6026: "Slippage exceeded — price moved too much",
  6027: "Swap not yet approved",
  6028: "Invalid mint address",
  6029: "Invalid token account owner",
  6030: "Insufficient balance",
  6031: "Invalid amount",
  6032: "Recipient required",
  6033: "Metadata required",
  6034: "Authority missing",
  6035: "Invalid upgrade buffer",
  6036: "Invalid program data account",
  6037: "Invalid remaining accounts",
  6038: "Invalid data",
  6039: "Overflow",
};

const RUNTIME_ERRORS: Record<string, string> = {
  IncorrectProgramId:
    "Target program not found on this network. If this is a swap, it requires mainnet.",
  InvalidAccountData: "Invalid account data — account may not exist on this network",
  AccountNotFound: "Account not found on-chain",
  InsufficientFunds: "Insufficient SOL for transaction fees",
  AccountAlreadyInitialized: "Account already initialized",
  InvalidArgument: "Invalid instruction argument",
  MissingRequiredSignature: "Missing required signature",
  AccountBorrowFailed: "Account is locked by another transaction",
  ProgramFailedToComplete: "Program crashed — check logs for details",
  InvalidInstructionData: "Invalid instruction data",
  AccountDataTooSmall: "Account too small for this operation",
};

export function getTxErrorMessage(err: any): string {
  const msg = err?.message || err?.toString() || "Transaction failed";

  if (isUserRejection(err)) return "Transaction cancelled by user";

  const instrMatch = msg.match(/InstructionError.*?\[(\d+),\s*"?(\w+)"?\]/);
  if (instrMatch) {
    const errorName = instrMatch[2];
    if (RUNTIME_ERRORS[errorName]) return RUNTIME_ERRORS[errorName];
    return `Transaction failed: ${errorName}`;
  }

  const customMatch =
    msg.match(/Custom["\s:]*(\d+)/i) || msg.match(/custom program error:\s*0x([0-9a-fA-F]+)/i);
  if (customMatch) {
    const code = customMatch[0].includes("0x")
      ? parseInt(customMatch[1], 16)
      : parseInt(customMatch[1]);
    if (ANCHOR_ERRORS[code]) return ANCHOR_ERRORS[code];
    if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
    return `Program error (${code})`;
  }

  const anchorMatch = msg.match(/Error Code:\s*(\w+)/);
  if (anchorMatch) {
    const name = anchorMatch[1];
    for (const [, message] of Object.entries(PROGRAM_ERRORS)) {
      if (message.toLowerCase().includes(name.toLowerCase())) return message;
    }
    return `Program error: ${name}`;
  }

  if (msg.includes("insufficient") || msg.includes("Insufficient"))
    return "Insufficient SOL for rent + fees";
  if (msg.includes("already in use") || msg.includes("already exists"))
    return "Account already exists";
  if (msg.includes("timeout") || msg.includes("Timeout"))
    return "Transaction timed out — please try again";
  if (msg.includes("blockhash") && msg.includes("expired"))
    return "Transaction expired — please try again";
  if (msg.includes("encoding overruns")) return "Transaction too large — try a simpler swap route";
  if (msg.includes("signature verification"))
    return "Transaction signature failed — this may happen on devnet for swap routes that reference mainnet programs";
  if (msg.includes("IncorrectProgramId")) return RUNTIME_ERRORS.IncorrectProgramId;
  if (msg.includes("ProgramFailedToComplete") || msg.includes("panicked"))
    return "Program crashed — swap may not be supported on this network";
  if (msg.includes("failed on-chain")) {
    try {
      const jsonMatch = msg.match(/\{.*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.InstructionError) {
          const [, detail] = parsed.InstructionError;
          if (typeof detail === "string" && RUNTIME_ERRORS[detail]) return RUNTIME_ERRORS[detail];
          if (typeof detail === "object" && detail.Custom !== undefined) {
            const code = detail.Custom;
            if (ANCHOR_ERRORS[code]) return ANCHOR_ERRORS[code];
            if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
            return `Program error (${code})`;
          }
          if (typeof detail === "string") return `Transaction failed: ${detail}`;
        }
      }
    } catch {}
    return "Transaction failed on-chain";
  }

  const cleaned = msg
    .replace(/\s*Logs:\s*\[.*?\]/gs, "")
    .replace(/SendTransactionError:.*/gs, "")
    .trim();
  return cleaned.length > 120 ? cleaned.slice(0, 120) + "..." : cleaned || "Transaction failed";
}

export function validateSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
