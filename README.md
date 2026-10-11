# Kiwi

Telegram bot for the Elysium network — launch tracking, deployment discovery, wallet monitoring, and HYPE-native trading.

Live bot: [@zensweep_bot](https://t.me/zensweep_bot) · Elysium Testnet (Chain ID 99801)

## Overview

Kiwi brings Elysium on-chain activity into Telegram. It scans for newly deployed contracts, tracks mint windows, monitors watched wallets, checks token safety before trading, and executes HYPE-native buys and sells — all without leaving a chat.

Built for [Elysium by Kinetiq](https://elysium.kinetiq.xyz), an Arbitrum Orbit L2 settling to HyperEVM with HYPE as its native gas token.

## Features

**Elysium Native**
- Live chain health (/elysium) — current block, gas price, and measured block time.
- Deployment discovery (/deployments) — scans recent blocks for new contracts.
- Launch board (/launch) — curated Ascend / Elysium launches with status and links.
- Mint windows (/mints) — countdown timers with DM alerts.
- Wallet watch (/watch, /watchlist) — track any EVM address and get notified on balance changes.

**Trading & Safety**
- Token card — paste any 0x... address for safety analysis and Buy/Sell buttons.
- Safety checks (/safety 0x...) — honeypot, owner/mint, blacklist, proxy detection (scored 0–100).
- HYPE-native trading — Buy 0.1/0.5/1 HYPE and Sell 25/50/100%.
- Portfolio (/portfolio) — realized PnL, win rate, per-token balances, shareable card.

**Wallet**
- Custodial wallet per Telegram user (/wallet). Keys encrypted at rest (AES-256-GCM).
- Balance refresh, chain switching, full withdrawal, and private-key export (/export).

**Secondary Markets**
- OpenSea-backed tooling (/markets) — floor, NFTs, minting, snipe rules for EVM chains. Requires OPENSEA_API_KEY.

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo>
cd zensweep
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set TELEGRAM_BOT_TOKEN and KEY_ENCRYPTION_SECRET

# 3. Run
npm run build && npm start   # production
npm run dev                  # development (ts-node)
```

## Configuration

All configuration is via environment variables (see .env.example):

| Variable | Required | Description |
|----------|----------|-------------|
| TELEGRAM_BOT_TOKEN | Yes | Telegram bot token from @BotFather |
| KEY_ENCRYPTION_SECRET | Yes | Hex secret for AES-256-GCM key encryption |
| ELYSIUM_RPC_URL | No | Elysium RPC endpoint (default: https://testnet-rpc.elysium.kinetiq.xyz) |
| ELYSIUM_CHAIN_ID | No | Elysium chain ID (default: 99801) |
| ELYSIUM_ROUTER_ADDRESS | No | Uniswap V2 router on Elysium. When unset, trading runs in paper mode |
| ELYSIUM_WHYPE_ADDRESS | No | Wrapped HYPE address. If empty, resolved via router.WETH() |
| FEE_PERCENTAGE | No | Fee fraction, e.g. 0.025 = 2.5% |
| FEE_RECIPIENT_WALLET | No | Address that receives fees. If empty, trades are fee-free |
| OPENSEA_API_KEY | No | Enables market features under /markets |
| KIWI_LAUNCH_API_URL | No | Remote JSON feed for the launch board |
| ALERT_POLL_INTERVAL_MS | No | Alert scheduler interval in ms (default: 300000) |

## Usage

### Commands

| Command | Description |
|---------|-------------|
| /start | Open the Kiwi dashboard |
| /wallet | View address, balance, and wallet actions |
| /launch | Browse tracked launches |
| /mints | View mint-window countdowns |
| /elysium | Live Elysium chain health |
| /deployments | Recent on-chain deployments |
| /watch 0x... [label] | Track a wallet or contract |
| /watchlist | List and manage watched addresses |
| /safety 0x... | Safety check for a token |
| /portfolio | Portfolio, PnL, and share card |
| /alerts | Active launch alerts |
| /status | Bot and data-source status |
| /markets | EVM secondary-market tools |
| /help | Command reference |

Any bare 0x... address pasted in chat opens the Token Card directly.

### Workflow

1. Send /start and create a wallet.
2. Browse /deployments or /launch to find new projects.
3. Paste a token address, review the safety score, then Buy or Sell from the card.
4. Check /portfolio for PnL and share your card.
5. Watch team or treasury wallets with /watch 0x... Treasury to get notified on movement.

### Paper Trading on Testnet

When ELYSIUM_ROUTER_ADDRESS is not set (the current state on Elysium testnet, where no canonical DEX router is deployed), buys and sells are recorded as synthetic paper positions. This makes the full buy -> sell -> portfolio workflow testable without on-chain liquidity. Set the router address on mainnet and the same code performs real swaps with no code change.

## Architecture

```
src/
  index.ts              # Bot bootstrap and Telegram command sync
  config.ts             # Chain configs, fee settings, env parsing
  bot/
    handlers.ts         # All command and callback handlers
    keyboards.ts        # Inline keyboards
    alerts.ts           # Background scheduler (deployments, mints, watches)
  engine/
    elysium.ts          # Chain health, deployment scan, wallet activity
    safety.ts           # Token safety analysis
    trading.ts          # HYPE-native router trading
    marketplace.ts      # Multi-chain floor and NFT lookup
    opensea.ts          # OpenSea API client
    minter.ts           # Contract mint execution
  wallet/
    manager.ts          # Custodial wallet, encryption, balances
  db/
    index.ts            # JSON-file persistence (swappable to Postgres)
  data/
    launches.ts         # Launch board and mint-window logic
```

## Development

```bash
npm run build        # compile TypeScript
npm run typecheck    # type-check without emitting
npm run dev          # run with ts-node and live reload
```

## Deployment

The bot uses long polling — no webhook or public port required.

1. Push to GitHub (.env is gitignored).
2. Create a new Railway project from the repository.
3. Add environment variables in the dashboard.
4. Set the start command to `npm run build && npm start`.
5. Deploy — logs should show `Kiwi bot started as @zensweep_bot` and `Telegram command menu synced`.

## Security

- Private keys are stored encrypted at rest (AES-256-GCM) and never sent through Telegram except via the explicit /export command, which warns the user to delete the message after importing.
- Changing KEY_ENCRYPTION_SECRET after wallets are created will make existing keys undecryptable.
- Kiwi never holds or transfers funds outside of explicit user actions (Buy, Sell, Mint, Withdraw).