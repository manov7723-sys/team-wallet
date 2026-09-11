/**
 * Mock Data Layer
 * Static data for all pages while the backend is being rebuilt.
 */

export interface MockMember {
  key: string;
  name: string;
  isOwner: boolean;
  hasVoter: boolean;
  hasContributor: boolean;
  avatar?: string;
}

export interface MockTeamWallet {
  _id: string;
  name: string;
  teamWalletAddress: string;
  owner: string;
  threshold: number;
  members: MockMember[];
  solBalance: number;
  lockedBalance: number;
  teamImage?: string;
}

export interface MockToken {
  mintAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  image: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  balance?: number;
  usdValue?: number;
  tokenType?: "fungible" | "nft";
}

export interface MockProgram {
  id: string;
  programName: string;
  programAddress: string;
  authorityAddress: string;
  isActive: boolean;
  balance?: number;
  dataSize?: number;
}

export interface MockTransaction {
  id: string;
  type: "treasury" | "token" | "swap";
  status: "pending" | "approved" | "executed" | "cancelled" | "expired";
  proposer: string;
  proposerName: string;
  amount: string;
  assetType: "SOL" | "SPL" | "NFT";
  tokenSymbol?: string;
  recipient: string;
  createdAt: string;
  expiresAt: string;
  votesFor: number;
  votesAgainst: number;
  threshold: number;
  description: string;
  voters: { key: string; name: string; vote: "approve" | "reject" | null }[];
}

export interface MockNFT {
  mint: string;
  name: string;
  image: string;
  collection: string;
}

export interface MockUser {
  walletAddress: string;
  username: string;
  email: string;
  bio: string;
  avatar: string;
}

export const MOCK_USER: MockUser = {
  walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  username: "alice_dev",
  email: "alice@example.com",
  bio: "Solana builder & DAO enthusiast.",
  avatar: "",
};

export const MOCK_MEMBERS: MockMember[] = [
  {
    key: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    name: "Alice",
    isOwner: true,
    hasVoter: true,
    hasContributor: true,
  },
  {
    key: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    name: "Bob",
    isOwner: false,
    hasVoter: true,
    hasContributor: true,
  },
  {
    key: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    name: "Charlie",
    isOwner: false,
    hasVoter: true,
    hasContributor: false,
  },
  {
    key: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "Diana",
    isOwner: false,
    hasVoter: true,
    hasContributor: false,
  },
  {
    key: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    name: "Eve",
    isOwner: false,
    hasVoter: false,
    hasContributor: true,
  },
];

export const MOCK_TEAM_WALLETS: MockTeamWallet[] = [
  {
    _id: "team_1",
    name: "Alpha Treasury",
    teamWalletAddress: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    owner: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    threshold: 2,
    members: MOCK_MEMBERS,
    solBalance: 42.58,
    lockedBalance: 5.2,
  },
  {
    _id: "team_2",
    name: "Beta Fund",
    teamWalletAddress: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
    owner: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    threshold: 3,
    members: MOCK_MEMBERS.slice(0, 3),
    solBalance: 12.05,
    lockedBalance: 0,
  },
];

export const MOCK_TREASURY_ASSETS: MockToken[] = [
  {
    mintAddress: "So11111111111111111111111111111111111111112",
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    supply: "0",
    image:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    mintAuthority: null,
    freezeAuthority: null,
    balance: 37.38,
    usdValue: 5420.1,
    tokenType: "fungible",
  },
  {
    mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    supply: "1000000",
    image: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
    mintAuthority: null,
    freezeAuthority: null,
    balance: 12500,
    usdValue: 12500,
    tokenType: "fungible",
  },
  {
    mintAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    name: "Tether",
    symbol: "USDT",
    decimals: 6,
    supply: "500000",
    image: "https://cryptologos.cc/logos/tether-usdt-logo.png",
    mintAuthority: null,
    freezeAuthority: null,
    balance: 8200,
    usdValue: 8200,
    tokenType: "fungible",
  },
  {
    mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    name: "Bonk",
    symbol: "BONK",
    decimals: 5,
    supply: "50000000",
    image: "https://cryptologos.cc/logos/bonk-bonk-logo.png",
    mintAuthority: null,
    freezeAuthority: null,
    balance: 45000000,
    usdValue: 1125,
    tokenType: "fungible",
  },
  {
    mintAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    name: "Jupiter",
    symbol: "JUP",
    decimals: 6,
    supply: "250000",
    image: null,
    mintAuthority: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    freezeAuthority: null,
    balance: 3200,
    usdValue: 2880,
    tokenType: "fungible",
  },
];

export const MOCK_NFTS: MockNFT[] = [
  {
    mint: "NFT111111111111111111111111111111111111111a",
    name: "Mad Lad #4281",
    image:
      "https://img-cdn.magiceden.dev/rs:fill:400:400:0:0/plain/https://madlads.s3.us-west-2.amazonaws.com/images/4281.png",
    collection: "Mad Lads",
  },
  {
    mint: "NFT111111111111111111111111111111111111111b",
    name: "Claynosaurz #1092",
    image:
      "https://img-cdn.magiceden.dev/rs:fill:400:400:0:0/plain/https://bafybeidg5ypqhqnhclcmneyjaqfcbfiy3kkjkadoeqhrimp5qwfgijtrqa.ipfs.nftstorage.link/1092.png",
    collection: "Claynosaurz",
  },
  {
    mint: "NFT111111111111111111111111111111111111111c",
    name: "Tensorian #7821",
    image:
      "https://img-cdn.magiceden.dev/rs:fill:400:400:0:0/plain/https://arweave.net/DCy15ZLz-TaV_FYfMgqMJWPnrNYJQQwFT3b1K7lj3Fg",
    collection: "Tensorians",
  },
];

export const MOCK_TOKENS: MockToken[] = [
  {
    mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    supply: "1000000",
    image: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
    mintAuthority: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    freezeAuthority: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    tokenType: "fungible",
  },
  {
    mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    name: "Bonk",
    symbol: "BONK",
    decimals: 5,
    supply: "50000000",
    image: "https://cryptologos.cc/logos/bonk-bonk-logo.png",
    mintAuthority: null,
    freezeAuthority: null,
    tokenType: "fungible",
  },
  {
    mintAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    name: "Jupiter",
    symbol: "JUP",
    decimals: 6,
    supply: "250000",
    image: null,
    mintAuthority: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    freezeAuthority: null,
    tokenType: "fungible",
  },
  {
    mintAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    name: "Tether",
    symbol: "USDT",
    decimals: 6,
    supply: "500000",
    image: "https://cryptologos.cc/logos/tether-usdt-logo.png",
    mintAuthority: null,
    freezeAuthority: null,
    tokenType: "fungible",
  },
  {
    mintAddress: "NFTMock11111111111111111111111111111111111a",
    name: "Team Badge #1",
    symbol: "BADGE",
    decimals: 0,
    supply: "1",
    image:
      "https://img-cdn.magiceden.dev/rs:fill:400:400:0:0/plain/https://madlads.s3.us-west-2.amazonaws.com/images/4281.png",
    mintAuthority: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    freezeAuthority: null,
    tokenType: "nft",
  },
];

export const MOCK_PROGRAMS: MockProgram[] = [
  {
    id: "prog_1",
    programName: "Staking Contract v2",
    programAddress: "StKe11111111111111111111111111111111111111",
    authorityAddress: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    isActive: true,
    balance: 1.234,
    dataSize: 245760,
  },
  {
    id: "prog_2",
    programName: "Token Vesting",
    programAddress: "Vest1111111111111111111111111111111111111111",
    authorityAddress: "4Nd1m7TqHLkT8uru7q5hTzFGSb4bHZhV5A8SNo7Z1F4u",
    isActive: true,
    balance: 0.52,
    dataSize: 128000,
  },
];

export const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    id: "trx_1",
    type: "treasury",
    status: "pending",
    proposer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    proposerName: "Alice",
    amount: "2.5",
    assetType: "SOL",
    recipient: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
    votesFor: 1,
    votesAgainst: 0,
    threshold: 2,
    description: "Transfer 2.5 SOL to Bob for dev work",
    voters: [
      { key: "7xKX...gAsU", name: "Alice", vote: "approve" },
      { key: "9WzD...AWWM", name: "Bob", vote: null },
      { key: "DezX...B263", name: "Charlie", vote: null },
      { key: "EPjF...t1v", name: "Diana", vote: null },
    ],
  },
  {
    id: "trx_2",
    type: "treasury",
    status: "approved",
    proposer: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    proposerName: "Bob",
    amount: "500",
    assetType: "SPL",
    tokenSymbol: "USDC",
    recipient: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(),
    votesFor: 2,
    votesAgainst: 0,
    threshold: 2,
    description: "Send 500 USDC to Charlie for design",
    voters: [
      { key: "7xKX...gAsU", name: "Alice", vote: "approve" },
      { key: "9WzD...AWWM", name: "Bob", vote: "approve" },
      { key: "DezX...B263", name: "Charlie", vote: null },
      { key: "EPjF...t1v", name: "Diana", vote: null },
    ],
  },
  {
    id: "trx_3",
    type: "treasury",
    status: "executed",
    proposer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    proposerName: "Alice",
    amount: "10",
    assetType: "SOL",
    recipient: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    votesFor: 2,
    votesAgainst: 0,
    threshold: 2,
    description: "Transfer 10 SOL to Diana for security audit",
    voters: [
      { key: "7xKX...gAsU", name: "Alice", vote: "approve" },
      { key: "9WzD...AWWM", name: "Bob", vote: "approve" },
    ],
  },
  {
    id: "trx_4",
    type: "swap",
    status: "executed",
    proposer: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    proposerName: "Bob",
    amount: "5",
    assetType: "SOL",
    recipient: "",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
    votesFor: 2,
    votesAgainst: 1,
    threshold: 2,
    description: "Swap 5 SOL → 725 USDC via Jupiter",
    voters: [
      { key: "7xKX...gAsU", name: "Alice", vote: "approve" },
      { key: "9WzD...AWWM", name: "Bob", vote: "approve" },
      { key: "DezX...B263", name: "Charlie", vote: "reject" },
    ],
  },
  {
    id: "trx_5",
    type: "treasury",
    status: "cancelled",
    proposer: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    proposerName: "Charlie",
    amount: "100",
    assetType: "SOL",
    recipient: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    votesFor: 0,
    votesAgainst: 2,
    threshold: 2,
    description: "Transfer 100 SOL — rejected by team",
    voters: [
      { key: "7xKX...gAsU", name: "Alice", vote: "reject" },
      { key: "9WzD...AWWM", name: "Bob", vote: "reject" },
    ],
  },
  {
    id: "trx_6",
    type: "token",
    status: "pending",
    proposer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    proposerName: "Alice",
    amount: "50000",
    assetType: "SPL",
    tokenSymbol: "BONK",
    recipient: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6.5).toISOString(),
    votesFor: 1,
    votesAgainst: 0,
    threshold: 2,
    description: "Mint 50,000 BONK to Bob",
    voters: [
      { key: "7xKX...gAsU", name: "Alice", vote: "approve" },
      { key: "9WzD...AWWM", name: "Bob", vote: null },
    ],
  },
  {
    id: "trx_7",
    type: "treasury",
    status: "expired",
    proposer: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    proposerName: "Bob",
    amount: "15",
    assetType: "SOL",
    recipient: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    votesFor: 1,
    votesAgainst: 0,
    threshold: 2,
    description: "Transfer 15 SOL to Charlie — expired before reaching threshold",
    voters: [
      { key: "9WzD...AWWM", name: "Bob", vote: "approve" },
      { key: "7xKX...gAsU", name: "Alice", vote: null },
      { key: "DezX...B263", name: "Charlie", vote: null },
    ],
  },
];

export const MOCK_SWAP_TOKENS = [
  {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    price: 145.0,
  },
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
    price: 1.0,
  },
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether",
    logo: "https://cryptologos.cc/logos/tether-usdt-logo.png",
    price: 1.0,
  },
  {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    logo: "https://cryptologos.cc/logos/bonk-bonk-logo.png",
    price: 0.000025,
  },
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    logo: null,
    price: 0.9,
  },
];

export const MOCK_CHART_DATA = {
  sentPoints: [
    { amount: 10, label: "#1 Jan 15" },
    { amount: 2.5, label: "#2 Jan 22" },
    { amount: 5, label: "#3 Feb 3" },
    { amount: 8, label: "#4 Feb 14" },
    { amount: 3.2, label: "#5 Mar 1" },
  ],
  receivedPoints: [
    { amount: 50, label: "#1 Jan 10" },
    { amount: 12, label: "#2 Jan 28" },
    { amount: 5, label: "#3 Feb 10" },
  ],
  totalSent: 28.7,
  totalReceived: 67,
};

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function timeLeft(dateStr: string): string {
  const seconds = Math.floor((new Date(dateStr).getTime() - Date.now()) / 1000);
  if (seconds <= 0) return "Expired";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m left`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h left`;
  return `${Math.floor(seconds / 86400)}d left`;
}

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-info/10 text-info border-info/20",
  approved: "bg-warning/10 text-warning border-warning/20",
  executed: "bg-success/10 text-success border-success/20",
  cancelled: "bg-error/10 text-error border-error/20",
  expired: "bg-neutral/10 text-neutral-content border-neutral/20",
  rejected: "bg-error/10 text-error border-error/20",
};

export interface MockUpgradeHistory {
  id: string;
  programAddress: string;
  bufferAddress: string;
  proposer: string;
  proposerName: string;
  status: "executed" | "pending" | "cancelled";
  createdAt: string;
  executedAt?: string;
  slot?: number;
}

export const MOCK_UPGRADE_HISTORY: MockUpgradeHistory[] = [
  {
    id: "upg_1",
    programAddress: "StKe11111111111111111111111111111111111111",
    bufferAddress: "Buf1111111111111111111111111111111111111111",
    proposer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    proposerName: "Alice",
    status: "executed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    executedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
    slot: 287654321,
  },
  {
    id: "upg_2",
    programAddress: "StKe11111111111111111111111111111111111111",
    bufferAddress: "Buf2222222222222222222222222222222222222222",
    proposer: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    proposerName: "Bob",
    status: "executed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    executedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 44).toISOString(),
    slot: 275432100,
  },
  {
    id: "upg_3",
    programAddress: "Vest1111111111111111111111111111111111111111",
    bufferAddress: "Buf3333333333333333333333333333333333333333",
    proposer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    proposerName: "Alice",
    status: "executed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    executedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    slot: 290123456,
  },
];
