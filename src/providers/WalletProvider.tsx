"use client";
/**
 * @component WalletProvider
 *
 * Configures the Solana wallet adapter stack for the app.
 *
 * Reads the RPC endpoint from NEXT_PUBLIC_SOLANA_RPC_URL and relies on
 * wallet-adapter's Standard Wallet auto-detection to support Phantom,
 * Solflare, Backpack, and any other compliant browser extension.
 * Enables autoConnect so previously connected wallets reconnect on load.
 */
import { useMemo, type FC, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider;
