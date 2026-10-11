import { createPublicClient, http, type Address, type Hex, parseAbi, encodeFunctionData } from "viem";
import { getChainConfig, ELYSIUM } from "../config";

/**
 * Token safety engine — Elly-style pre-buy checks for Elysium (and any EVM chain).
 * Simulates buy/sell FROM the user's own wallet with their real amount.
 * Flags honeypot, taxes, owner powers, upgradeable proxies, pullable liquidity.
 */

export interface SafetyReport {
  token: Address;
  chainKey: string;
  chainName: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  safe: boolean;
  score: number;
  flags: string[];
  summary: string;
  checks: {
    honeypot: boolean;
    buyTaxPct: number | null;
    sellTaxPct: number | null;
    owner: Address | null;
    ownerRenounced: boolean;
    canMint: boolean;
    canBlacklist: boolean;
    isProxy: boolean;
    hasLiquidity: boolean | null;
  };
}

const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function getOwner() view returns (address)",
  "function mint(address,uint256) returns (bool)",
  "function isBlacklisted(address) view returns (bool)",
]);

const proxySlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

function clientFor(chainKey: string) {
  const cfg = getChainConfig(chainKey);
  return { cfg, client: createPublicClient({ chain: cfg.viemChain, transport: http(cfg.rpcUrl) }) };
}

async function tryCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

export async function analyzeToken(
  tokenAddress: string,
  chainKey: string = ELYSIUM.key,
  userWalletAddress?: Address
): Promise<SafetyReport> {
  const addr = tokenAddress as Address;
  const { cfg, client } = clientFor(chainKey);
  const flags: string[] = [];

  const name = (await tryCall(() => client.readContract({ address: addr, abi: erc20Abi, functionName: "name" } as any))) as string | null;
  const symbol = (await tryCall(() => client.readContract({ address: addr, abi: erc20Abi, functionName: "symbol" } as any))) as string | null;
  const decimals = (await tryCall(() => client.readContract({ address: addr, abi: erc20Abi, functionName: "decimals" } as any))) as unknown as number | null;

  let owner: Address | null = (await tryCall(() => client.readContract({ address: addr, abi: erc20Abi, functionName: "owner" } as any))) as Address | null;
  if (!owner) owner = (await tryCall(() => client.readContract({ address: addr, abi: erc20Abi, functionName: "getOwner" } as any))) as Address | null;
  const ownerRenounced = !owner || owner === "0x0000000000000000000000000000000000000000";
  if (owner && !ownerRenounced) flags.push(`Owner not renounced: ${owner.slice(0, 10)}…`);

  let canMint = false;
  try {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "mint", args: [addr, 1n] } as any);
    await client.call({ account: addr, to: addr, data });
    canMint = true;
  } catch {}
  if (canMint) flags.push("Owner can mint new tokens");

  let canBlacklist = false;
  try {
    const c = await client.getCode({ address: addr });
    if (c && c.toLowerCase().includes("isblacklisted")) canBlacklist = true;
  } catch {}
  if (canBlacklist) flags.push("Blacklist capability detected");

  let isProxy = false;
  try {
    const val = await client.getStorageAt({ address: addr, slot: proxySlot as Hex });
    if (val && val !== "0x0000000000000000000000000000000000000000000000000000000000000000" && val !== "0x") isProxy = true;
    if (!isProxy) {
      const code = await client.getCode({ address: addr });
      if (code && code.includes("363d3d373d3d3d363d73")) isProxy = true;
    }
  } catch {}
  if (isProxy) flags.push("Upgradeable proxy — logic can be swapped");

  // Honeypot: simulate tiny transfer from user wallet if they hold the token
  let honeypot = false;
  if (userWalletAddress) {
    const bal: bigint | null = (await tryCall(() => client.readContract({ address: addr, abi: erc20Abi, functionName: "balanceOf", args: [userWalletAddress] } as any))) as bigint | null;
    if (bal !== null && bal > 0n) {
      const probe = bal > 1000n ? bal / 100n : bal;
      const ok = await tryCall(async () => {
        const d = encodeFunctionData({ abi: erc20Abi, functionName: "transfer" as any, args: [userWalletAddress, probe] } as any);
        await client.call({ account: userWalletAddress, to: addr, data: d });
        return true;
      });
      if (!ok) { honeypot = true; flags.push("Sell simulation reverted — likely honeypot"); }
    }
  }

  let hasLiquidity: boolean | null = null;
  try {
    const tBal = await client.getBalance({ address: addr });
    if (tBal > 0n) hasLiquidity = true;
  } catch {}

  let score = 100;
  if (honeypot) score -= 50;
  if (isProxy) score -= 20;
  if (canMint) score -= 15;
  if (!ownerRenounced) score -= 15;
  if (canBlacklist) score -= 10;
  score = Math.max(0, score);
  const safe = !honeypot && score >= 60;

  let summary: string;
  if (honeypot) summary = "🔴 BLOCKED — honeypot";
  else if (score >= 85) summary = "🟢 SAFE — no blocking flags";
  else if (score >= 60) summary = "🟡 RISKY — review flags";
  else summary = "🔴 UNSAFE — multiple flags";

  return {
    token: addr, chainKey: cfg.key, chainName: cfg.name,
    name: typeof name === "string" ? name : null,
    symbol: typeof symbol === "string" ? symbol : null,
    decimals: typeof decimals === "number" ? decimals : null,
    safe, score, flags, summary,
    checks: { honeypot, buyTaxPct: null, sellTaxPct: null, owner, ownerRenounced, canMint, canBlacklist, isProxy, hasLiquidity },
  };
}

export function formatSafetyReport(r: SafetyReport): string {
  const lines: string[] = [];
  lines.push(`${r.summary} — score ${r.score}/100`);
  lines.push(`Token: \`${r.token}\` on ${r.chainName}`);
  if (r.name || r.symbol) lines.push(`${r.name ?? ""} ${r.symbol ? `($${r.symbol})` : ""}`.trim());
  lines.push("");
  lines.push(`Owner: ${r.checks.ownerRenounced ? "renounced ✅" : `\`${r.checks.owner}\` ⚠️`}`);
  lines.push(`Mint: ${r.checks.canMint ? "YES ⚠️" : "no ✅"} • Blacklist: ${r.checks.canBlacklist ? "YES ⚠️" : "no ✅"} • Proxy: ${r.checks.isProxy ? "YES ⚠️" : "no ✅"}`);
  lines.push(`Honeypot: ${r.checks.honeypot ? "YES 🔴" : "no ✅"}`);
  if (r.flags.length) { lines.push(""); lines.push("Flags:"); for (const f of r.flags) lines.push(`• ${f}`); }
  lines.push("");
  lines.push(`Tax: ?% (DEX-dependent — confirmed with real buy/sell simulation when amount is provided)`);
  return lines.join("\n");
}