/**
 * React hook to build, sign, and send Solana transactions using Anchor and Wallet Adapter.
 *
 * Handles transaction states (`idle`, `building`, `signing`, `confirming`, `done`, `error`),
 * user rejection, and optional success/rejection notifications via `react-toastify`.
 *
 * @returns An object containing:
 * - `execute` - function to execute a list of `TransactionInstruction`s with options.
 * - `getProvider` - returns an `AnchorProvider` if wallet is connected.
 * - `reset` - resets status, error, and signature to initial state.
 * - `status` - current transaction status
 * - `error` - last error message (if any)
 * - `signature` - transaction signature once confirmed
 * - Boolean flags for each status (`isIdle`, `isBuilding`, `isSigning`, `isConfirming`, `isDone`, `isError`, `isProcessing`)

 * Transaction status values.
 *
 * @typedef TxStatus
 * @type {"idle" | "building" | "signing" | "confirming" | "done" | "error"}
 */
import { useCallback, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { toast } from "react-toastify";
import {
  prepareV0Transaction,
  sendAndConfirmTransaction,
  isUserRejection,
  getTxErrorMessage,
} from "@/src/lib/web3";
import { useTranslations } from "next-intl";

export type TxStatus = "idle" | "building" | "signing" | "confirming" | "done" | "error";

export interface TxOptions {
  computeUnits?: number;
  priorityFeeMicroLamports?: number;
  skipPriorityFee?: boolean;
  accountKeys?: PublicKey[];
  signers?: Keypair[];
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  commitment?: "confirmed" | "finalized";
  successMessage?: string;
  rejectionMessage?: string;
  onConfirmed?: (signature: string) => Promise<void> | void;
}

export interface TxResult {
  signature: string;
  success: boolean;
}

export function useTransaction() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, wallet } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const inProgress = useRef(false);
  const t = useTranslations("transaction");

  const getProvider = useCallback((): AnchorProvider | null => {
    if (!publicKey || !wallet) return null;
    return new AnchorProvider(connection, wallet.adapter as any, { commitment: "confirmed" });
  }, [connection, publicKey, wallet]);

  const execute = useCallback(
    async (
      instructions: TransactionInstruction[],
      options?: TxOptions
    ): Promise<TxResult | null> => {
      if (!publicKey || !signTransaction || !wallet || inProgress.current) {
        toast.error(t("Wallet not connected"));
        return null;
      }

      inProgress.current = true;
      setStatus("building");
      setError(null);
      setSignature(null);

      try {
        const provider = new AnchorProvider(connection, wallet.adapter as any, {
          commitment: "confirmed",
        });
        const { tx, blockhash, lastValidBlockHeight } = await prepareV0Transaction(
          provider,
          instructions,
          {
            computeUnits: options?.computeUnits,
            priorityFeeMicroLamports: options?.priorityFeeMicroLamports,
            skipPriorityFee: options?.skipPriorityFee,
            accountKeys: options?.accountKeys,
            addressLookupTableAccounts: options?.addressLookupTableAccounts,
          }
        );

        if (options?.signers?.length) {
          tx.sign(options.signers);
        }

        setStatus("signing");
        let signed;
        try {
          signed = await signTransaction(tx);
        } catch (signErr: any) {
          if (isUserRejection(signErr)) {
            setStatus("idle");
            toast.info(options?.rejectionMessage || t("Transaction cancelled"));
            return null;
          }
          throw signErr;
        }

        setStatus("confirming");
        const sig = await sendAndConfirmTransaction(
          connection,
          signed,
          blockhash,
          lastValidBlockHeight,
          options?.commitment || "confirmed"
        );
        setSignature(sig);

        if (options?.onConfirmed) {
          await options.onConfirmed(sig);
        }

        setStatus("done");
        if (options?.successMessage) toast.success(options.successMessage);
        return { signature: sig, success: true };
      } catch (err: any) {
        if (isUserRejection(err)) {
          setStatus("idle");
          toast.info(options?.rejectionMessage || t("Transaction cancelled"));
          return null;
        }

        const errorMsg = getTxErrorMessage(err);
        setStatus("error");
        setError(errorMsg);
        toast.error(t("Transaction Failed"), { autoClose: 2000 });
        return null;
      } finally {
        inProgress.current = false;
      }
    },
    [connection, publicKey, signTransaction, wallet, t]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setSignature(null);
  }, []);

  return {
    execute,
    getProvider,
    reset,
    status,
    error,
    signature,
    isIdle: status === "idle",
    isBuilding: status === "building",
    isSigning: status === "signing",
    isConfirming: status === "confirming",
    isDone: status === "done",
    isError: status === "error",
    isProcessing: status === "building" || status === "signing" || status === "confirming",
  };
}
