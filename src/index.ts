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

  // Sync the Telegram autocomplete menu (replaces any stale demo list).
  const kiwiCommands = [
    { command: "start", description: "Open Kiwi dashboard" },
    { command: "wallet", description: "Manage trading wallet & withdraw" },
    { command: "launch", description: "Tracked Ascend/Elysium launches" },
    { command: "mints", description: "Mint-window countdowns" },
    { command: "elysium", description: "Live Elysium chain health" },
    { command: "deployments", description: "Fresh on-chain deployments" },
    { command: "watch", description: "Track a wallet — 0x... [label]" },
    { command: "watchlist", description: "Your watched addresses" },
    { command: "safety", description: "Safety check for a token" },
    { command: "portfolio", description: "Portfolio PnL & share card" },
    { command: "alerts", description: "Active launch alerts" },
    { command: "status", description: "Bot & data status" },
    { command: "help", description: "How to use Kiwi" },
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