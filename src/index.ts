import { Bot } from "grammy";
import { TELEGRAM_BOT_TOKEN, KEY_ENCRYPTION_SECRET } from "./config";
import { registerHandlers } from "./bot/handlers";
import { startAlertScheduler } from "./bot/alerts";

/**
 * Kiwi — Ascend & Elysium Launch Assistant.
 *
 * Bootstraps the grammY bot, registers all command/callback handlers, and
 * starts the background alert scheduler. Requires TELEGRAM_BOT_TOKEN in the
 * environment. KEY_ENCRYPTION_SECRET is required before any custodial wallet
 * can be created (it encrypts private keys at rest).
 */
async function main() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("Missing TELEGRAM_BOT_TOKEN. Set it in your environment or .env file.");
    process.exit(1);
  }
  if (!KEY_ENCRYPTION_SECRET) {
    console.warn(
      "WARNING: KEY_ENCRYPTION_SECRET is not set. Wallet creation will fail until it is provided."
    );
  }

  const bot = new Bot(TELEGRAM_BOT_TOKEN);

  registerHandlers(bot);

  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  // Sync the Telegram autocomplete menu — Kiwi-native, not a copy. Kept lean: hunter feed + Kiwi card + your settings.
  const kiwiCommands = [
    { command: "start", description: "Open Kiwi dashboard" },
    { command: "wallet", description: "Your HYPE wallet & withdraw" },
    { command: "launch", description: "Tracked Ascend launches" },
    { command: "mints", description: "Mint-window countdowns" },
    { command: "elysium", description: "Live Elysium chain (99801)" },
    { command: "deployments", description: "Fresh deployments — hunter feed" },
    { command: "watch", description: "Track a wallet — 0x... [label]" },
    { command: "watchlist", description: "Your tracked addresses" },
    { command: "buy", description: "Buy a token — 0x... amount" },
    { command: "sell", description: "Sell a token — 0x... 25/50/100" },
    { command: "safety", description: "Kiwi Safety Engine check" },
    { command: "portfolio", description: "What you hold — PnL & share card" },
    { command: "slippage", description: "Your price tolerance (1–50%)" },
    { command: "copy", description: "Kiwi Auto-Follow — up to 5 wallets (V2)" },
    { command: "alerts", description: "Deployment & launch alerts" },
    { command: "status", description: "Bot & chain status" },
    { command: "help", description: "How Kiwi works" },
  ];

  bot.start({
    onStart: async (info) => {
      console.log(`Kiwi bot started as @${info.username}`);
      try {
        await bot.api.setMyCommands(kiwiCommands);
        console.log("Telegram command menu synced");
      } catch (e) {
        console.warn("Could not sync command menu:", e);
      }
      startAlertScheduler(bot);
    },
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});