import { InlineKeyboard } from "grammy";
import { SUPPORTED_CHAINS } from "../config";

/**
 * Inline keyboards for the bot UI.
 *
 * Callback-data strings here MUST match the patterns registered in
 * handlers.ts (e.g. `chain_select_<key>`, `task_toggle_<id>`, `snipe_col_<0x…>`).
 */

export const mainKeyboard = new InlineKeyboard()
  .text("🚀 Launches", "menu_launches")
  .text("⏳ Mints", "menu_mints")
  .row()
  .text("⛓ Elysium Live", "menu_elysium")
  .text("🆕 Deployments", "menu_deployments")
  .row()
  .text("📊 Portfolio", "menu_portfolio")
  .text("👀 Watchlist", "menu_watchlist")
  .row()
  .text("💳 Wallet", "menu_wallet")
  .text("🔔 Safety", "menu_safety_info")
  .row()
  .text("🔔 Alerts", "menu_alerts")
  .text("📊 Status", "menu_status")
  .row()
  .text("🏪 Markets · EVM", "menu_markets")
  .text("ℹ️ Help", "menu_help");

/** Demoted secondary market features (OpenSea-backed, non-Elysium EVM chains). */
export const marketsKeyboard = new InlineKeyboard()
  .text("🖼 My NFTs", "menu_nfts")
  .text("⚡ Mint", "menu_mint")
  .row()
  .text("💰 Floor", "menu_floor")
  .text("🎯 Snipe Rules", "menu_tasks")
  .row()
  .text("📜 Trade History", "menu_history")
  .row()
  .text("🔙 Main Menu", "menu_main");

export const walletKeyboard = new InlineKeyboard()
  .text("🔄 Refresh Balance", "wallet_refresh")
  .text("📤 Withdraw All", "wallet_withdraw")
  .row()
  .text("🌐 Switch Chain", "menu_chains")
  .text("🖼 My NFTs", "menu_nfts")
  .row()
  .text("🔙 Main Menu", "menu_main");

export const noWalletKeyboard = new InlineKeyboard()
  .text("➕ Create Wallet", "wallet_generate")
  .text("ℹ️ Help", "menu_help")
  .row()
  .text("🌐 Chains", "menu_chains");

export function makePortfolioKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Refresh", "portfolio_refresh")
    .text("📤 Share Card", "portfolio_share")
    .row()
    .text("🔙 Main Menu", "menu_main");
}

export function makeTokenCardKeyboard(token: string): InlineKeyboard {
  const short = token.slice(0, 10);
  return new InlineKeyboard()
    .text("🟢 Buy 0.1 HYPE", `tok_buy_${token}_0.1`)
    .text("🟢 Buy 0.5 HYPE", `tok_buy_${token}_0.5`)
    .row()
    .text("🟢 Buy 1 HYPE", `tok_buy_${token}_1`)
    .text("🔍 Safety Check", `tok_safety_${token}`)
    .row()
    .text("🔴 Sell 25%", `tok_sell_${token}_25`)
    .text("🔴 Sell 50%", `tok_sell_${token}_50`)
    .text("🔴 Sell 100%", `tok_sell_${token}_100`)
    .row()
    .text("👀 Watch", `watch_add_${token}`)
    .text("🔙 Main Menu", "menu_main");
}

export function makeSafetyKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🟢 Buy 0.1 HYPE", `tok_buy_${token}_0.1`)
    .text("🔴 Sell 25%", `tok_sell_${token}_25`)
    .row()
    .text("🔙 Token Card", `tok_card_${token}`)
    .text("🔙 Main Menu", "menu_main");
}

export function makeChainKeyboard(selected: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  // Elysium first, then the rest in configured order.
  for (const chain of SUPPORTED_CHAINS) {
    const check = chain.key === selected ? " ✅" : "";
    kb.text(`${chain.name}${check}`, `chain_select_${chain.key}`).row();
  }
  kb.text("🔙 Main Menu", "menu_main");
  return kb;
}

export function makeTaskKeyboard(taskId: number, isActive: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (isActive) {
    kb.text("⏸ Pause", `task_toggle_${taskId}`);
  } else {
    kb.text("▶️ Resume", `task_toggle_${taskId}`);
  }
  kb.text("🗑 Delete", `task_delete_${taskId}`).row();
  kb.text("🔙 Main Menu", "menu_main");
  return kb;
}

export function makeCollectionKeyboard(contract: string, openSeaUrl?: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text("🎯 Snipe Floor", `snipe_col_${contract}`).row();
  kb.text("🧬 Snipe Trait", `snipe_trait_${contract}`).row();
  if (openSeaUrl) {
    kb.url("🌊 View on OpenSea", openSeaUrl).row();
  }
  kb.text("🔙 Main Menu", "menu_main");
  return kb;
}
