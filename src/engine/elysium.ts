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


