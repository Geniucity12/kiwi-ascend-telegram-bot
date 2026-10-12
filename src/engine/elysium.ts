import {
  createPublicClient,
  http,
  formatEther,
  formatGwei,
  type Address,
  type Hash,
  type Transaction,
} from "viem";
import { getChainConfig, ELYSIUM } from "../config";

/**
 * Live Elysium chain monitor.
 *
 * Everything here talks directly to the Elysium RPC — no OpenSea, no external
 * indexers. It powers the bot's Elysium-native features:
 *   - getChainHealth()        live block height, real measured block time, gas
 *   - scanRecentDeployments() surface fresh contract deployments (new launches)
 *   - getWalletActivity()      balance + recent native transfers for any address
 *
 * Elysium produces real canonical blocks every 100–200ms, so a short scan window
 * still captures meaningful on-chain activity.
 */

export interface ChainHealth {
  chainKey: string;
  chainName: string;
  symbol: string;
  chainId: number;
  blockNumber: bigint;
  gasPriceGwei: string;
  /** Measured seconds between the last two blocks (best-effort). */
  blockTimeSeconds: number | null;
  explorerUrl: string;
}

export interface DeployedContract {
  address: Address;
  deployer: Address;
  txHash: Hash;
  blockNumber: bigint;
  /** Seconds since the deploying block (best-effort; null if unknown). */
  ageSeconds: number | null;
}

export interface WalletActivity {
  address: Address;
  balanceWei: bigint;
  balanceEth: string;
  symbol: string;
  transfers: NativeTransfer[];
}

export interface NativeTransfer {
  txHash: Hash;
  from: Address;
  to: Address | null;
  valueWei: bigint;
  valueEth: string;
  blockNumber: bigint;
}

export interface DeploymentMeta {
  address: Address;
  kind: "token" | "nft" | "contract" | "unknown";
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupplyFormatted: string | null;
  bytecodeSize: number | null;
  label: string;
}

const erc20MetaAbi = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const erc721MetaAbi = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

export async function getDeploymentMeta(address: Address, chainKey: string = ELYSIUM.key): Promise<DeploymentMeta> {
  const { client } = clientFor(chainKey);
  let bytecodeSize: number | null = null;
  try { const code = await client.getBytecode({ address }); bytecodeSize = code ? (code.length - 2)/2 : 0; } catch { bytecodeSize = null; }
  try {
    const [name, symbol, decimals, supply] = await Promise.all([
      client.readContract({ address, abi: erc20MetaAbi, functionName: "name" }).catch(()=>null),
      client.readContract({ address, abi: erc20MetaAbi, functionName: "symbol" }).catch(()=>null),
      client.readContract({ address, abi: erc20MetaAbi, functionName: "decimals" }).catch(()=>null),
      client.readContract({ address, abi: erc20MetaAbi, functionName: "totalSupply" }).catch(()=>null),
    ]);
    if (typeof name === "string" && typeof symbol === "string" && decimals !== null) {
      const dec = Number(decimals);
      let supplyFmt: string | null = null;
      try { if (supply !== null) supplyFmt = formatEther(supply as bigint).slice(0,14); } catch {}
      const label = "🪙 Token \u2022 " + name + " (" + symbol + ")" + (Number.isFinite(dec) ? " \u2022 " + dec + " decimals" : "");
      return { address, kind: "token", name, symbol, decimals: dec, totalSupplyFormatted: supplyFmt, bytecodeSize, label };
    }
  } catch {}
  try {
    const [name, symbol] = await Promise.all([
      client.readContract({ address, abi: erc721MetaAbi, functionName: "name" }).catch(()=>null),
      client.readContract({ address, abi: erc721MetaAbi, functionName: "symbol" }).catch(()=>null),
    ]);
    if (typeof name === "string" && typeof symbol === "string" && name && symbol) {
      return { address, kind: "nft", name, symbol, decimals: null, totalSupplyFormatted: null, bytecodeSize, label: "🖼️ NFT \u2022 " + name + " (" + symbol + ")" };
    }
  } catch {}
  if (bytecodeSize === 0) return { address, kind: "unknown", name: null, symbol: null, decimals: null, totalSupplyFormatted: null, bytecodeSize, label: "❓ EOA / empty" };
  if (bytecodeSize !== null && bytecodeSize > 0) return { address, kind: "contract", name: null, symbol: null, decimals: null, totalSupplyFormatted: null, bytecodeSize, label: "📄 Contract \u2022 " + bytecodeSize + " bytes" };
  return { address, kind: "unknown", name: null, symbol: null, decimals: null, totalSupplyFormatted: null, bytecodeSize, label: "📄 Contract" };
}


function clientFor(chainKey: string) {
  const cfg = getChainConfig(chainKey);
  return {
    cfg,
    client: createPublicClient({ chain: cfg.viemChain, transport: http(cfg.rpcUrl) }),
  };
}

/** Live snapshot of the chain: height, gas, and measured block time. */
export async function getChainHealth(chainKey: string = ELYSIUM.key): Promise<ChainHealth> {
  const { cfg, client } = clientFor(chainKey);
  const blockNumber = await client.getBlockNumber();
  const gasPrice = await client.getGasPrice();

  // Measure real block time from the last two blocks (best-effort).
  let blockTimeSeconds: number | null = null;
  try {
    const latest = await client.getBlock({ blockNumber });
    if (blockNumber > 0n) {
      const prev = await client.getBlock({ blockNumber: blockNumber - 1n });
      const delta = Number(latest.timestamp - prev.timestamp);
      if (Number.isFinite(delta) && delta >= 0) blockTimeSeconds = delta;
    }
  } catch {
    // leave null
  }

  return {
    chainKey: cfg.key,
    chainName: cfg.name,
    symbol: cfg.symbol,
    chainId: cfg.chainId,
    blockNumber,
    gasPriceGwei: formatGwei(gasPrice),
    blockTimeSeconds,
    explorerUrl: cfg.explorerUrl,
  };
}

/**
 * Scan the most recent blocks for fresh contract deployments (tx.to === null).
 *
 * Elysium's fast blocks mean a small window already captures new launches as
 * they appear on-chain. Receipts are fetched only for creation txs to keep the
 * RPC load low.
 */
export async function scanRecentDeployments(
  blockDepth: number = 40,
  chainKey: string = ELYSIUM.key
): Promise<DeployedContract[]> {
  const { cfg, client } = clientFor(chainKey);
  const latest = await client.getBlockNumber();
  const startDepth = BigInt(Math.max(1, blockDepth));
  const oldest = latest > startDepth ? latest - startDepth : 0n;

  const found: DeployedContract[] = [];
  for (let bn = latest; bn >= oldest; bn--) {
    try {
      const block = await client.getBlock({ blockNumber: bn, includeTransactions: true });
      for (const tx of block.transactions) {
        if (tx.to !== null) continue; // only contract creations
        let deployer: Address | null = null;
        try {
          const sender = await client.getTransaction({ hash: tx.hash });
          deployer = sender.from;
        } catch {
          deployer = tx.from;
        }
        let address: Address | null = null;
        try {
          const receipt = await client.getTransactionReceipt({ hash: tx.hash });
          address = receipt.contractAddress ?? null;
        } catch {
          address = null;
        }
        if (!address) continue;
        found.push({
          address,
          deployer: deployer ?? tx.from,
          txHash: tx.hash,
          blockNumber: bn,
          ageSeconds: Number(latest - bn) * (cfg.testnet ? 0.2 : 12),
        });
      }
    } catch {
      // skip blocks we cannot read this cycle
    }
    if (found.length >= 25) break; // cap results
  }
  return found;
}

/** Balance plus recent native transfers touching an address. */
export async function getWalletActivity(
  address: Address,
  blockDepth: number = 30,
  chainKey: string = ELYSIUM.key
): Promise<WalletActivity> {
  const { cfg, client } = clientFor(chainKey);
  const balanceWei = await client.getBalance({ address });
  const latest = await client.getBlockNumber();
  const startDepth = BigInt(Math.max(1, blockDepth));
  const oldest = latest > startDepth ? latest - startDepth : 0n;

  const transfers: NativeTransfer[] = [];
  const target = address.toLowerCase();
  for (let bn = latest; bn >= oldest; bn--) {
    try {
      const block = await client.getBlock({ blockNumber: bn, includeTransactions: true });
      for (const tx of block.transactions) {
        const from = (tx.from ?? "").toLowerCase();
        const to = (tx.to ?? "").toLowerCase();
        if (from !== target && to !== target) continue;
        transfers.push({
          txHash: tx.hash,
          from: tx.from,
          to: tx.to,
          valueWei: tx.value,
          valueEth: formatEther(tx.value),
          blockNumber: bn,
        });
      }
    } catch {
      // skip unreadable blocks
    }
    if (transfers.length >= 20) break;
  }

  return {
    address,
    balanceWei,
    balanceEth: formatEther(balanceWei),
    symbol: cfg.symbol,
    transfers,
  };
}


