import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { getChainConfig, KEY_ENCRYPTION_SECRET } from "../config";
import { dbService } from "../db";

/**
 * Custodial wallet manager.
 *
 * Private keys are encrypted at rest with AES-256-GCM using a key derived from
 * KEY_ENCRYPTION_SECRET. Keys are decrypted only in-memory, at signing time, and
 * are never sent through Telegram. This is a convenience/custodial model — users
 * are warned in the UI to only deposit what they can afford to leave in a
 * bot-managed wallet, and to use Withdraw to move funds out.
 */

function encKey(): Buffer {
  if (!KEY_ENCRYPTION_SECRET) {
    throw new Error("KEY_ENCRYPTION_SECRET is not set. Cannot safely store keys.");
  }
  // Derive a 32-byte key. Salt is fixed per deployment; the secret must be strong.
  return scryptSync(KEY_ENCRYPTION_SECRET, "kiwi-elysium-wallet-salt", 32);
}

function encrypt(plain: string): string {
  const key = encKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("hex");
}

function decrypt(payload: string): string {
  const key = encKey();
  const buf = Buffer.from(payload, "hex");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export const walletManager = {
  createNewWallet(userId: number): { address: Address } {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk as Hex);
    dbService.setKey(userId, account.address, encrypt(pk));
    dbService.upsertUser(userId, account.address, getChainConfig("elysium").key);
    return { address: account.address };
  },

  getUserWallet(userId: number): { address: Address; privateKey: Hex } | undefined {
    const rec = dbService.getKey(userId);
    if (!rec) return undefined;
    return { address: rec.address as Address, privateKey: decrypt(rec.encrypted_private_key) as Hex };
  },

  async getBalance(
    address: Address,
    chainKey: string,
    _forceRefresh: boolean = false
  ): Promise<{ eth: string; symbol: string }> {
    const cfg = getChainConfig(chainKey);
    try {
      const client = createPublicClient({
        chain: cfg.viemChain,
        transport: http(cfg.rpcUrl),
      });
      const wei = await client.getBalance({ address });
      return { eth: formatEther(wei), symbol: cfg.symbol };
    } catch (err) {
      console.error(`getBalance failed on ${cfg.name}:`, err);
      return { eth: "0", symbol: cfg.symbol };
    }
  },

  exportPrivateKey(userId: number): Hex | null {
    const w = this.getUserWallet(userId);
    return w ? w.privateKey : null;
  },

  async withdrawAll(userId: number, toAddress: Address, chainKey: string): Promise<string> {
    const cfg = getChainConfig(chainKey);
    const wallet = this.getUserWallet(userId);
    if (!wallet) throw new Error("No wallet found for this account.");

    const account = privateKeyToAccount(wallet.privateKey);
    const transport = http(cfg.rpcUrl);
    const publicClient = createPublicClient({ chain: cfg.viemChain, transport });
    const walletClient = createWalletClient({ account, chain: cfg.viemChain, transport });

    const balance = await publicClient.getBalance({ address: account.address });
    const gasPrice = await publicClient.getGasPrice();
    const gasLimit = 21_000n;
    const gasCost = gasPrice * gasLimit;
    if (balance <= gasCost) throw new Error("Insufficient balance to cover gas.");

    const value = balance - gasCost;
    const hash = await walletClient.sendTransaction({
      account,
      to: toAddress,
      value,
      chain: cfg.viemChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  },
};
