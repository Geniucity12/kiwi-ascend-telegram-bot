import { InlineKeyboard } from "grammy";
import { SUPPORTED_CHAINS } from "../config";

/**
 * Inline keyboards for the bot UI — Elysium-only.
 */

export const mainKeyboard = new InlineKeyboard()
  .text("\uD83D\uDE80 Launches", "menu_launches")
  .text("\u23F3 Mints", "menu_mints")
  .row()
  .text("\u26D3 Elysium Live", "menu_elysium")
  .text("\uD83C\uDD95 Deployments", "menu_deployments")
  .row()
  .text("\uD83D\uDCCA Portfolio", "menu_portfolio")
  .text("\uD83D\uDC40 Watchlist", "menu_watchlist")
  .row()
  .text("\uD83D\uDCB3 Wallet", "menu_wallet")
  .text("\uD83D\uDD14 Safety", "menu_safety_info")
  .row()
  .text("\uD83D\uDD14 Alerts", "menu_alerts")
  .text("\uD83D\uDCCA Status", "menu_status")
  .row()
  .text("\u2139\uFE0F Help", "menu_help");

// Archived: cross-chain secondary markets (OpenSea). Keep for git revert.
export const marketsKeyboard = new InlineKeyboard().text("\uD83D\uDD19 Main Menu", "menu_main");

export const walletKeyboard = new InlineKeyboard()
  .text("\uD83D\uDD04 Refresh Balance", "wallet_refresh")
  .text("\uD83D\uDCE4 Withdraw All", "wallet_withdraw")
  .row()
  .text("\uD83D\uDD19 Main Menu", "menu_main");

export const noWalletKeyboard = new InlineKeyboard()
  .text("\u2795 Create Wallet", "wallet_generate")
  .text("\u2139\uFE0F Help", "menu_help");

export function makePortfolioKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("\uD83D\uDD04 Refresh", "portfolio_refresh").text("\uD83D\uDCE4 Share Card", "portfolio_share").row().text("\uD83D\uDD19 Main Menu", "menu_main");
}
export function makeTokenCardKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard().text("\uD83D\uDFE2 Buy 0.1 HYPE", `tok_buy_${token}_0.1`).text("\uD83D\uDFE2 Buy 0.5 HYPE", `tok_buy_${token}_0.5`).row().text("\uD83D\uDFE2 Buy 1 HYPE", `tok_buy_${token}_1`).text("\uD83D\uDD0D Safety Check", `tok_safety_${token}`).row().text("\uD83D\uDD34 Sell 25%", `tok_sell_${token}_25`).text("\uD83D\uDD34 Sell 50%", `tok_sell_${token}_50`).text("\uD83D\uDD34 Sell 100%", `tok_sell_${token}_100`).row().text("\uD83D\uDC40 Watch", `watch_add_${token}`).text("\uD83D\uDD19 Main Menu", "menu_main");
}
export function makeSafetyKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard().text("\uD83D\uDFE2 Buy 0.1 HYPE", `tok_buy_${token}_0.1`).text("\uD83D\uDD34 Sell 25%", `tok_sell_${token}_25`).row().text("\uD83D\uDD19 Token Card", `tok_card_${token}`).text("\uD83D\uDD19 Main Menu", "menu_main");
}
export function makeChainKeyboard(selected: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const chain of SUPPORTED_CHAINS) { const check = chain.key === selected ? " \u2705" : ""; kb.text(`${chain.name}${check}`, `chain_select_${chain.key}`).row(); }
  kb.text("\uD83D\uDD19 Main Menu", "menu_main"); return kb;
}
export function makeTaskKeyboard(taskId: number, isActive: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (isActive) kb.text("\u23F8 Pause", `task_toggle_${taskId}`); else kb.text("\u25B6\uFE0F Resume", `task_toggle_${taskId}`);
  kb.text("\uD83D\uDDD1 Delete", `task_delete_${taskId}`).row();
  kb.text("\uD83D\uDD19 Main Menu", "menu_main"); return kb;
}
export function makeCollectionKeyboard(contract: string, openSeaUrl?: string): InlineKeyboard {
  const kb = new InlineKeyboard(); kb.text("\uD83C\uDFAF Snipe Floor", `snipe_col_${contract}`).row(); kb.text("\uD83E\uDDEC Snipe Trait", `snipe_trait_${contract}`).row(); if (openSeaUrl) kb.url("\uD83C\uDF0A View on OpenSea", openSeaUrl).row(); kb.text("\uD83D\uDD19 Main Menu", "menu_main"); return kb;
}
