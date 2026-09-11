# Team Wallet

A multi-signature treasury management application built on Solana. Create shared wallets, add team members, configure voting thresholds, and manage crypto assets with proposal-based governance — every transaction requires team approval before execution.

## Features

- **Multi-sig Wallets** — PDA-based shared wallets with configurable approval thresholds
- **Proposal Voting** — Create, vote on, and execute proposals on-chain
- **Treasury Management** — Send, receive, and deposit tokens from a shared vault
- **Token Swaps** — Swap tokens via Jupiter aggregation with multi-sig approval
- **Token Creation** — Create fungible tokens and NFTs with Token-2022 extensions
- **Program Upgrades** — Manage Solana program upgrade authorities with multi-sig governance
- **Role-based Access** — Owner, voter, and contributor permission levels
- **Wallet Support** — Phantom, Solflare, Backpack, and all standard Solana wallets

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Blockchain:** Solana Web3.js, SPL Token, Wallet Adapter
- **Database:** MongoDB via Mongoose
- **Auth:** JWT with wallet signature verification (jose)
- **Styling:** Tailwind CSS 4, DaisyUI 5
- **State:** TanStack React Query
- **Storage:** S3 (production) or local filesystem, IPFS via Pinata

## Project Structure

```
src/
├── app/
│   ├── (guest)/              # Public pages (landing, team creation)
│   ├── (user)/               # Authenticated pages
│   │   ├── dashboard/        # Team overview
│   │   ├── treasury/         # Token balances, send/deposit
│   │   ├── trade/            # Jupiter-powered token swaps
│   │   ├── members/          # Team member management
│   │   ├── programs/         # Solana program management
│   │   ├── token/            # Token creation and details
│   │   ├── transaction/      # Proposal voting and execution
│   │   └── settings/         # Team configuration
│   └── api/v1/               # Backend API routes
│       ├── auth/             # Login, message signing, token refresh
│       ├── teams/            # Team CRUD
│       ├── proposals/        # Proposal management
│       ├── tokens/           # Token registry
│       ├── programs/         # Program registry
│       ├── users/            # User profile and access
│       ├── upload/           # File uploads (local + S3 presign)
│       ├── pinata/           # IPFS upload proxy (server-side key)
│       └── trade/            # Jupiter + Birdeye proxy (server-side keys)
│           ├── tokens/       # Verified token list
│           ├── quote/        # Swap quotes
│           ├── build/        # Raw swap instructions
│           ├── execute/      # Managed transaction landing
│           ├── prices/       # Token prices
│           └── history/      # Price history charts
├── components/               # Shared UI components
├── hooks/                    # React Query hooks
├── lib/                      # Utilities (web3, api client, pinata, jupiter)
├── providers/                # Context providers (auth, wallet, team)
├── config/                   # App configuration
├── enums/                    # Shared enums
└── icons/                    # SVG icon components
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance
- Solana wallet (Phantom recommended for development)

### 1. Clone and install

```bash
git clone https://github.com/tecneuralhome/teamwallet-new.git
cd teamwallet-new
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

#### Public variables (exposed to browser)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint (e.g. Helius, QuickNode) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_TEAM_WALLET_PROGRAM_ID` | Deployed program ID |
| `NEXT_PUBLIC_UPLOAD_MODE` | `local` or `s3` |
| `NEXT_PUBLIC_APP_URL` | Production URL for OG meta tags |

#### Private variables (server-side only)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) |
| `NEXT_PUBLIC_PINATA_JWT` | Pinata API JWT for IPFS uploads |
| `JUPITER_API_KEY` | Jupiter swap API key |
| `BIRDEYE_API_KEY` | Birdeye price history API key |
| `AWS_S3_BUCKET` | S3 bucket name (if `UPLOAD_MODE=s3`) |
| `AWS_S3_REGION` | S3 region |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `LOCAL_UPLOAD_DIR` | Local upload path (default: `public/uploads`) |

> **Security note:** `NEXT_PUBLIC_PINATA_JWT`, `JUPITER_API_KEY`, and `BIRDEYE_API_KEY` are server-side only. They are never exposed to the browser. Client-side code calls internal `/api/v1/pinata` and `/api/v1/trade/*` proxy routes, which attach the keys server-side.

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Production build

```bash
npm run build
npm start
```

## API Architecture

All API routes live under `/api/v1/` and are protected by JWT middleware (except `/api/v1/auth/*`).

The middleware (`src/middleware.ts`) verifies the JWT on every request and injects `x-wallet-address` and `x-user-id` headers for downstream route handlers.

**Third-party API keys are proxied server-side:**

```
Browser → /api/v1/trade/quote → Jupiter API (key attached server-side)
Browser → /api/v1/pinata      → Pinata API (JWT attached server-side)
Browser → /api/v1/trade/history → Birdeye API (key attached server-side)
```

This prevents API keys from appearing in the browser's JavaScript bundle or network requests.

## Security

- **JWT Authentication** — All API routes require a valid Bearer token (except auth endpoints)
- **Server-side API keys** — Pinata, Jupiter, and Birdeye credentials are never sent to the browser
- **Upload validation** — File type allowlist, 5MB size limit, path traversal protection
- **Wallet signature auth** — Login requires signing a challenge message with the connected wallet
- **Token refresh** — Auto-refresh with mutex to prevent concurrent refresh races

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm start` | Start production server (run `build` first) |
| `npm run lint` | Run ESLint to check for code issues |
| `npm run lint:fix` | Run ESLint and auto-fix issues |

## Important Notes

### Trade feature requires mainnet

Token swaps via the Trade page only work on `mainnet-beta`. This is because Jupiter's swap API sources liquidity from real DEX pools (Raydium, Orca, Meteora, etc.) that only exist on mainnet. On devnet there are no liquidity pools, so Jupiter cannot find routes or return quotes. The quote, build, and execute endpoints will all fail on devnet.

All other features (team creation, proposals, voting, treasury transfers, token creation, program management) work on both devnet and mainnet.

To use Trade, set your environment to mainnet:

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

## License

Copyright Tecneural. All Rights Reserved.
