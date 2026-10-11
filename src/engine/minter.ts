import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  parseAbi,
  encodeFunctionData,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  getChainConfig,
  FEE_PERCENTAGE,
  FEE_RECIPIENT_WALLET,
  MINT_FUNCTION_ABI,
} from "../config";

/**
 * Direct-to-contract minting engine.
 *
 * Elysium is a standard EVM chain (Arbitrum Orbit), so minting uses ordinary
 * contract calls via viem — no chain-specific handling. The mint price is NOT
 * read from the contract; the user supplies the exact per-item value, and a
 * wrong value simply reverts per that contract's rules. Any configured service
 * fee is sent as a separate transfer after the mint confirms.
 */

export interface MintResult {
  contract: string;
  chainName: string;
  quantity: number;
  totalCostEth: string;
  serviceFeeEth: string;
  serviceFeePaid: boolean;
  serviceFeeTxHash?: string;
  serviceFeeError?: string;
  explorerUrl: string;
}

const mintAbi = parseAbi([MINT_FUNCTION_ABI]) as Abi;
const mintFnName = ((mintAbi[0] as { name?: string }).name ?? "mint") as string;

export const minterService = {
  async executeMint(
    privateKey: Hex,
    contract: string,
    quantity: number,
    priceEth: string,
    chainKey: string
  ): Promise<MintResult> {
    const cfg = getChainConfig(chainKey);
    const account = privateKeyToAccount(privateKey);
    const transport = http(cfg.rpcUrl);
    const publicClient = createPublicClient({ chain: cfg.viemChain, transport });
    const walletClient = createWalletClient({ account, chain: cfg.viemChain, transport });

    const perItemWei = parseEther(priceEth || "0");
    const totalWei = perItemWei * BigInt(quantity);
    const totalCostEth = formatEther(totalWei);

    // Encode the mint call with the quantity argument.
    const data = encodeFunctionData({
      abi: mintAbi,
      functionName: mintFnName,
      args: [BigInt(quantity)],
    });

    const hash = await walletClient.sendTransaction({
      account,
      address: contract as Address,
      data,
      value: totalWei,
      chain: cfg.viemChain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Mint transaction reverted on-chain.");
    }

    // Service fee as a separate transfer, only on paid mints.
    let serviceFeeEth = "0";
    let serviceFeePaid = true;
    let serviceFeeTxHash: string | undefined;
    let serviceFeeError: string | undefined;

    if (FEE_RECIPIENT_WALLET && FEE_PERCENTAGE > 0 && totalWei > 0n) {
      const feeWei = (totalWei * BigInt(Math.floor(FEE_PERCENTAGE * 10_000))) / 10_000n;
      serviceFeeEth = formatEther(feeWei);
      try {
        const feeHash = await walletClient.sendTransaction({
          account,
          to: FEE_RECIPIENT_WALLET as Address,
          value: feeWei,
          chain: cfg.viemChain,
        });
        await publicClient.waitForTransactionReceipt({ hash: feeHash });
        serviceFeeTxHash = feeHash;
        serviceFeePaid = true;
      } catch (err) {
        serviceFeePaid = false;
        serviceFeeError = (err as Error).message;
      }
    }

    return {
      contract,
      chainName: cfg.name,
      quantity,
      totalCostEth,
      serviceFeeEth,
      serviceFeePaid,
      serviceFeeTxHash,
      serviceFeeError,
      explorerUrl: `${cfg.explorerUrl}/tx/${hash}`,
    };
  },
};
