import "dotenv/config";
import { defineChain, type Chain } from "viem";

/**
 * Central configuration for Kiwi — Elysium-only.
 * Elysium (by Kinetiq): Arbitrum Orbit L2 settling to HyperEVM (chain 999), HYPE gas.
 * Testnet is live on chain 99801. https://elysium.kinetiq.xyz
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

export const SUPPORTED_CHAINS: ChainConfig[] = [ELYSIUM];
const byKey = new Map<string, ChainConfig>(SUPPORTED_CHAINS.map((c) => [c.key, c]));
export const DEFAULT_CHAIN_KEY = ELYSIUM.key;
export function getChainConfig(key: string): ChainConfig { return byKey.get(key) ?? ELYSIUM; }
export function resolveChainKey(input?: string | null): string { if (!input) return DEFAULT_CHAIN_KEY; return byKey.has(input) ? input : DEFAULT_CHAIN_KEY; }

export const FEE_PERCENTAGE = Number(env("FEE_PERCENTAGE", "0.025"));
export const FEE_RECIPIENT_WALLET = env("FEE_RECIPIENT_WALLET", "");
export const TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", "");
export const KEY_ENCRYPTION_SECRET = env("KEY_ENCRYPTION_SECRET", "");
export const DB_FILE = env("DB_FILE", "data/kiwi.db.json");
export const DATA_DIR = env("DATA_DIR", "data");
export const MINT_FUNCTION_ABI = env("MINT_FUNCTION_ABI", "function mint(uint256 quantity) payable");
export const ELYSIUM_ROUTER_ADDRESS = env("ELYSIUM_ROUTER_ADDRESS", "");
export const ELYSIUM_WHYPE_ADDRESS = env("ELYSIUM_WHYPE_ADDRESS", "");
export const KALOS_API_URL = env("KALOS_API_URL", "");
export const KALOS_MARKETPLACE_ADDRESS = env("KALOS_MARKETPLACE_ADDRESS", "");
export const ALERT_POLL_INTERVAL_MS = Number(env("ALERT_POLL_INTERVAL_MS", String(5 * 60_000)));
export const OPENSEA_API_KEY = env("OPENSEA_API_KEY", "");
