import { createPublicClient, createWalletClient, http, formatEther, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChainConfig, ELYSIUM, ELYSIUM_ROUTER_ADDRESS, ELYSIUM_WHYPE_ADDRESS, FEE_RECIPIENT_WALLET, FEE_PERCENTAGE } from "../config";

/**
 * HYPE-native trading engine for Elysium. Uniswap V2-style router. All routing is HYPE <-> ERC20.
 * If ELYSIUM_ROUTER_ADDRESS is not set, trading gracefully degrades with a clear error.
 */

const routerAbi = parseAbi([
  "function getAmountsOut(uint256, address[]) view returns (uint256[])",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
  "function WETH() view returns (address)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

function cfg() { return getChainConfig(ELYSIUM.key); }
function pub() { const c = cfg(); return createPublicClient({ chain: c.viemChain, transport: http(c.rpcUrl) }); }

function requireRouter(): Address {
  if (!ELYSIUM_ROUTER_ADDRESS) throw new Error("Trading not configured yet — Elysium DEX router is not set. The team will configure ELYSIUM_ROUTER_ADDRESS when the DEX is live.");
  return ELYSIUM_ROUTER_ADDRESS as Address;
}
async function getWethAddress(): Promise<Address> {
  if (ELYSIUM_WHYPE_ADDRESS) return ELYSIUM_WHYPE_ADDRESS as Address;
  try {
    const addr = await pub().readContract({ address: requireRouter(), abi: routerAbi, functionName: "WETH" });
    return addr as Address;
  } catch { return requireRouter(); }
}

export interface Quote {
  amountInWei: bigint;
  amountOutWei: bigint;
  amountOutFormatted: string;
  path: Address[];
}

export async function quoteBuy(token: Address, hypeInWei: bigint): Promise<Quote> {
  const client = pub();
  const whype = await getWethAddress();
  const path: Address[] = [whype, token];
  const amounts: bigint[] = await client.readContract({ address: requireRouter(), abi: routerAbi, functionName: "getAmountsOut", args: [hypeInWei, path] }) as any;
  const out = amounts[amounts.length - 1] as bigint;
  return { amountInWei: hypeInWei, amountOutWei: out, amountOutFormatted: out.toString(), path };
}

export async function quoteSell(token: Address, tokenInWei: bigint): Promise<Quote> {
  const client = pub();
  const whype = await getWethAddress();
  const path: Address[] = [token, whype];
  const amounts: bigint[] = await client.readContract({ address: requireRouter(), abi: routerAbi, functionName: "getAmountsOut", args: [tokenInWei, path] }) as any;
  const out = amounts[amounts.length - 1] as bigint;
  return { amountInWei: tokenInWei, amountOutWei: out, amountOutFormatted: formatEther(out), path };
}

export const tradingService = {
  async getTokenBalance(token: Address, wallet: Address): Promise<{ raw: bigint; formatted: string; decimals: number; symbol: string | null }> {
    const client = pub();
    let decimals = 18;
    let symbol: string | null = null;
    try { decimals = await client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }) as number; } catch {}
    try { symbol = await client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }) as string; } catch {}
    const raw = await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [wallet] }) as bigint;
    return { raw, formatted: String(Number(raw) / 10 ** decimals), decimals, symbol };
  },

  async executeBuy(privateKey: Hex, token: Address, hypeInWei: bigint, slippageBps: number = 500): Promise<{ txHash: Hex }> {
    const c = cfg();
    const account = privateKeyToAccount(privateKey);
    const t = http(c.rpcUrl);
    const pubClient = createPublicClient({ chain: c.viemChain, transport: t });
    const walletClient = createWalletClient({ account, chain: c.viemChain, transport: t });
    const whype = await getWethAddress();
    const path: Address[] = [whype, token];
    const router = requireRouter();
    const amounts = await pubClient.readContract({ address: router, abi: routerAbi, functionName: "getAmountsOut", args: [hypeInWei, path] }) as bigint[];
    const expectedOut = amounts[1];
    const minOut = expectedOut * BigInt(10000 - slippageBps) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const hash = await walletClient.writeContract({
      address: router, abi: routerAbi, functionName: "swapExactETHForTokens",
      args: [minOut, path, account.address, deadline],
      value: hypeInWei, chain: c.viemChain, account,
    });
    await pubClient.waitForTransactionReceipt({ hash });
    if (FEE_RECIPIENT_WALLET && FEE_PERCENTAGE > 0) {
      try {
        const fee = hypeInWei * BigInt(Math.floor(FEE_PERCENTAGE * 10000)) / 10000n;
        if (fee > 0n) {
          const feeHash = await walletClient.sendTransaction({ account, to: FEE_RECIPIENT_WALLET as Address, value: fee, chain: c.viemChain });
          await pubClient.waitForTransactionReceipt({ hash: feeHash });
        }
      } catch {}
    }
    return { txHash: hash };
  },

  async executeSell(privateKey: Hex, token: Address, tokenInWei: bigint, slippageBps: number = 500): Promise<{ txHash: Hex }> {
    const c = cfg();
    const account = privateKeyToAccount(privateKey);
    const t = http(c.rpcUrl);
    const pubClient = createPublicClient({ chain: c.viemChain, transport: t });
    const walletClient = createWalletClient({ account, chain: c.viemChain, transport: t });
    const whype = await getWethAddress();
    const path: Address[] = [token, whype];
    const router = requireRouter();
    const allowance = await pubClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account.address, router] }) as bigint;
    if (allowance < tokenInWei) {
      const approveHash = await walletClient.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [router, tokenInWei * 10n], chain: c.viemChain, account });
      await pubClient.waitForTransactionReceipt({ hash: approveHash });
    }
    const amounts = await pubClient.readContract({ address: router, abi: routerAbi, functionName: "getAmountsOut", args: [tokenInWei, path] }) as bigint[];
    const minOut = amounts[1] * BigInt(10000 - slippageBps) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const hash = await walletClient.writeContract({
      address: router, abi: routerAbi, functionName: "swapExactTokensForETH",
      args: [tokenInWei, minOut, path, account.address, deadline],
      chain: c.viemChain, account,
    });
    await pubClient.waitForTransactionReceipt({ hash });
    return { txHash: hash };
  },
};