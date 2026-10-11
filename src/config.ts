import "dotenv/config";
import { defineChain, type Chain } from "viem";

/**
 * Central configuration for Kiwi.
 *
 * Elysium (by Kinetiq) is the flagship network for this bot:
 *   - Arbitrum Orbit L2 that settles to HyperEVM (chain 999)
 *   - Native gas token: HYPE
 *   - Testnet is live (chain 99801). Mainnet is pre-launch.
 * See: https://elysium.kinetiq.xyz
 */

export interface ChainConfig {
  key: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  explorerUrl: string;
  testnet: boolean;
  viemChain: Chain;
  /** OpenSea API chain slug, if this chain is listed on OpenSea. */
  openSeaSlug?: string;
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

const elysiumRpc = env("ELYSIUM_RPC_URL", "https://testnet-rpc.elysium.kinetiq.xyz");
const elysiumExplorer = env("ELYSIUM_EXPLORER_URL", "https://elysium.kinetiq.xyz/testnet-explorer");
const elysiumChainId = Number(env("ELYSIUM_CHAIN_ID", "99801"));

export const ELYSIUM: ChainConfig = {
  key: "elysium",
  name: "Elysium Testnet",
  chainId: elysiumChainId,
  rpcUrl: elysiumRpc,
  symbol: "HYPE",
  explorerUrl: elysiumExplorer,
  testnet: true,
  viemChain: defineChain({
    id: elysiumChainId,
    name: "Elysium Testnet",
    nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
    rpcUrls: { default: { http: [elysiumRpc] } },
    blockExplorers: { default: { name: "Elysium Explorer", url: elysiumExplorer } },
    testnet: true,
  }),
};

const ethereum: ChainConfig = {
  key: "ethereum",
  name: "Ethereum",
  chainId: 1,
  rpcUrl: env("ETHEREUM_RPC_URL", "https://eth.llamarpc.com"),
  symbol: "ETH",
  explorerUrl: "https://etherscan.io",
  testnet: false,
  viemChain: defineChain({
    id: 1,
    name: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env("ETHEREUM_RPC_URL", "https://eth.llamarpc.com")] } },
    blockExplorers: { default: { name: "Etherscan", url: "https://etherscan.io" } },
  }),
  openSeaSlug: "ethereum",
};

const base: ChainConfig = {
  key: "base",
  name: "Base",
  chainId: 8453,
  rpcUrl: env("BASE_RPC_URL", "https://mainnet.base.org"),
  symbol: "ETH",
  explorerUrl: "https://basescan.org",
  testnet: false,
  viemChain: defineChain({
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env("BASE_RPC_URL", "https://mainnet.base.org")] } },
    blockExplorers: { default: { name: "Basescan", url: "https://basescan.org" } },
  }),
  openSeaSlug: "base",
};

const arbitrum: ChainConfig = {
  key: "arbitrum",
  name: "Arbitrum One",
  chainId: 42161,
  rpcUrl: env("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
  symbol: "ETH",
  explorerUrl: "https://arbiscan.io",
  testnet: false,
  viemChain: defineChain({
    id: 42161,
    name: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc")] } },
    blockExplorers: { default: { name: "Arbiscan", url: "https://arbiscan.io" } },
  }),
  openSeaSlug: "arbitrum",
};

const optimism: ChainConfig = {
  key: "optimism",
  name: "Optimism",
  chainId: 10,
  rpcUrl: env("OPTIMISM_RPC_URL", "https://mainnet.optimism.io"),
  symbol: "ETH",
  explorerUrl: "https://optimistic.etherscan.io",
  testnet: false,
  viemChain: defineChain({
    id: 10,
    name: "Optimism",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env("OPTIMISM_RPC_URL", "https://mainnet.optimism.io")] } },
    blockExplorers: { default: { name: "Optimistic Etherscan", url: "https://optimistic.etherscan.io" } },
  }),
  openSeaSlug: "optimism",
};

const polygon: ChainConfig = {
  key: "polygon",
  name: "Polygon PoS",
  chainId: 137,
  rpcUrl: env("POLYGON_RPC_URL", "https://polygon-rpc.com"),
  symbol: "POL",
  explorerUrl: "https://polygonscan.com",
  testnet: false,
  viemChain: defineChain({
    id: 137,
    name: "Polygon PoS",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: { default: { http: [env("POLYGON_RPC_URL", "https://polygon-rpc.com")] } },
    blockExplorers: { default: { name: "Polygonscan", url: "https://polygonscan.com" } },
  }),
  openSeaSlug: "matic",
};

/** Ordered so Elysium appears first in the chain picker. */
export const SUPPORTED_CHAINS: ChainConfig[] = [ELYSIUM, ethereum, base, arbitrum, optimism, polygon];

const byKey = new Map<string, ChainConfig>(SUPPORTED_CHAINS.map((c) => [c.key, c]));

/** Default chain when a user has none selected. */
export const DEFAULT_CHAIN_KEY = ELYSIUM.key;

export function getChainConfig(key: string): ChainConfig {
  return byKey.get(key) ?? ELYSIUM;
}

export function resolveChainKey(input?: string | null): string {
  if (!input) return DEFAULT_CHAIN_KEY;
  return byKey.has(input) ? input : DEFAULT_CHAIN_KEY;
}

// --- Service fee ---------------------------------------------------------
// FEE_PERCENTAGE is a fraction (0.025 === 2.5%). handlers.ts multiplies it
// by 10_000 to derive basis points and by 100 for display, so keep it a fraction.
export const FEE_PERCENTAGE = Number(env("FEE_PERCENTAGE", "0.025"));
export const FEE_RECIPIENT_WALLET = env("FEE_RECIPIENT_WALLET", "");

// --- Secrets / infrastructure -------------------------------------------
export const TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", "");
export const OPENSEA_API_KEY = env("OPENSEA_API_KEY", "");
// Used to encrypt custodial private keys at rest (AES-256-GCM).
export const KEY_ENCRYPTION_SECRET = env("KEY_ENCRYPTION_SECRET", "");
export const DB_FILE = env("DB_FILE", "data/kiwi.db.json");
export const DATA_DIR = env("DATA_DIR", "data");

// --- Minting -------------------------------------------------------------
// Contracts vary; allow operators to override the mint entrypoint ABI.
// Default assumes a payable `mint(uint256 quantity)`.
export const MINT_FUNCTION_ABI = env(
  "MINT_FUNCTION_ABI",
  "function mint(uint256 quantity) payable"
);

// --- Trading (Elysium HYPE-native) --------------------------------------
// Uniswap V2 style router on Elysium. If unset, token buy/sell quotes and
// execution will gracefully degrade with a clear error rather than reverts.
export const ELYSIUM_ROUTER_ADDRESS = env("ELYSIUM_ROUTER_ADDRESS", "");
export const ELYSIUM_WHYPE_ADDRESS = env("ELYSIUM_WHYPE_ADDRESS", "");

// --- Alerts --------------------------------------------------------------
export const ALERT_POLL_INTERVAL_MS = Number(env("ALERT_POLL_INTERVAL_MS", String(5 * 60_000)));



