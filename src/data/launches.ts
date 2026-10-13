import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ZENSWEEP_LAUNCH_API_URL } from "../config";

export type LaunchStatus = "upcoming" | "live" | "minting" | "sold_out" | "beta";

/**
 * Escape Telegram Markdown (legacy) special chars in dynamic text.
 * Without this, a project named "Cool_NFT (v2)" or "My *Project*" breaks
 * sendMessage with "can't parse entities".
 */
export function escMd(input: string): string {
  return String(input ?? "")
    .replace(/([_*`\[])/g, "\\$1");
}

export interface LaunchProject {
  id: string;
  name: string;
  summary: string;
  chain: string;
  status: LaunchStatus;
  mintDate: string;
  website?: string;
  x?: string;
  contractAddress?: string;
  stage: string;
  tags: string[];
  /** Optional mint-window boundaries (epoch ms) for live countdowns. */
  mintStartsAt?: number;
  mintEndsAt?: number;
  /** Public mint price per item in native units, when known. */
  mintPrice?: number;
}

export const kiwiLaunches: LaunchProject[] = [
  {
    id: "ascend",
    name: "Ascend",
    summary:
      "Token launch and lifecycle infrastructure for Elysium — standardized pool framework, builder fee share, and the path to Ascended status.",
    chain: "Elysium",
    status: "upcoming",
    mintDate: "Pre-launch",
    website: "https://ascendlaunch.gitbook.io/docs",
    stage: "Docs live · mainnet pre-launch",
    tags: ["launchpad", "ascend", "builders"],
  },
  {
    id: "elysium-testnet",
    name: "Elysium Testnet",
    summary:
      "Arbitrum Orbit L2 by Kinetiq that settles to HyperEVM with HYPE gas. Testnet is open — track live blocks and deployments here.",
    chain: "Elysium",
    status: "live",
    mintDate: "Testnet open",
    website: "https://elysium.kinetiq.xyz",
    stage: "Testnet open",
    tags: ["testnet", "chain", "kinetiq"],
  },
  {
    id: "elysium-mainnet",
    name: "Elysium Mainnet",
    summary:
      "Mainnet launch of the Elysium chain. Endpoints and explorer are published at launch; parameters may still be refined.",
    chain: "Elysium",
    status: "upcoming",
    mintDate: "TBA",
    website: "https://elysium.kinetiq.xyz",
    stage: "Pre-launch",
    tags: ["mainnet", "chain", "kinetiq"],
  },
];

function normalizeLaunches(input: unknown): LaunchProject[] {
  if (!Array.isArray(input)) return kiwiLaunches;

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const project = item as Record<string, any>;
      const startsRaw = project.mintStartsAt ?? project.mint_starts_at ?? project.mintStart;
      const endsRaw = project.mintEndsAt ?? project.mint_ends_at ?? project.mintEnd;
      const mintStartsAt = startsRaw === undefined || startsRaw === null ? undefined : Number(startsRaw);
      const mintEndsAt = endsRaw === undefined || endsRaw === null ? undefined : Number(endsRaw);
      const mintPriceRaw = project.mintPrice ?? project.mint_price ?? project.price;
      const mintPrice = mintPriceRaw === undefined || mintPriceRaw === null ? undefined : Number(mintPriceRaw);
      return {
        id: String(project.id ?? project.slug ?? Math.random().toString(36).slice(2)),
        name: String(project.name ?? "Untitled launch"),
        summary: String(project.summary ?? project.description ?? "Launch project"),
        chain: String(project.chain ?? project.network ?? "Elysium"),
        status: (project.status ?? "upcoming") as LaunchStatus,
        mintDate: String(project.mintDate ?? project.mint_date ?? "TBA"),
        website: project.website ?? project.url ?? undefined,
        x: project.x ?? project.twitter ?? undefined,
        contractAddress: project.contractAddress ?? project.contract_address,
        stage: String(project.stage ?? project.phase ?? "Pending"),
        tags: Array.isArray(project.tags) ? project.tags.map(String) : [],
        mintStartsAt: Number.isFinite(mintStartsAt) ? mintStartsAt : undefined,
        mintEndsAt: Number.isFinite(mintEndsAt) ? mintEndsAt : undefined,
        mintPrice: Number.isFinite(mintPrice) ? mintPrice : undefined,
      };
    })
    .filter(Boolean) as LaunchProject[];
}

export async function fetchLaunchProjects(): Promise<LaunchProject[]> {
  const apiUrl = ZENSWEEP_LAUNCH_API_URL || process.env.ZENSWEEP_LAUNCH_API_URL || process.env.KIWI_LAUNCH_API_URL || "";
  const localJsonPath = path.resolve(process.cwd(), "src/data/launches.seed.json");

  if (apiUrl) {
    try {
      const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
      if (response.ok) {
        const data = await response.json();
        const projects = normalizeLaunches(data);
        if (projects.length > 0) return projects;
      }
    } catch (error) {
      console.warn("Zensweep launch API unavailable, using built-in references:", error);
    }
  }

  // Optional operator-provided seed file; the compiled-in list is the default.
  if (existsSync(localJsonPath)) {
    try {
      const data = JSON.parse(readFileSync(localJsonPath, "utf8"));
      const projects = normalizeLaunches(data);
      if (projects.length > 0) return projects;
    } catch (error) {
      console.warn("Zensweep launch seed file unreadable, using built-in references:", error);
    }
  }

  return kiwiLaunches;
}

export function buildLaunchCard(project: LaunchProject): string {
  const badge = {
    live: "🟢",
    minting: "🟡",
    upcoming: "🔵",
    sold_out: "⚫",
    beta: "🟣",
  }[project.status] ?? "⚪";

  return [
    `\n*${escMd(badge)} ${escMd(project.name)}*`,
    `_${escMd(getLaunchStatusLabel(project.status))} • ${escMd(project.stage)}_`,
    escMd(project.summary),
    `Chain: \`${escMd(project.chain)}\` • ${escMd(mintWindowLine(project))}`,
    project.website ? `Website: ${escMd(project.website)}` : "",
    project.x ? `X: ${escMd(project.x)}` : "",
    project.contractAddress ? `Contract: \`${escMd(project.contractAddress.slice(0, 10))}...\`` : "",
    project.tags.length ? `Tags: ${project.tags.map((tag) => `#${escMd(tag)}`).join(" ")}` : "",
    "",
  ].filter(Boolean).join("\n");
}

export function getLaunchStatusLabel(status: LaunchStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "minting":
      return "Minting";
    case "upcoming":
      return "Upcoming";
    case "sold_out":
      return "Sold out";
    case "beta":
      return "Beta";
    default:
      return "Unknown";
  }
}

export type MintWindowState = "live_now" | "opens_soon" | "scheduled" | "ended" | "unknown";

/** Classify a project's mint window given current time. */
export function getMintWindowState(project: LaunchProject, now: number = Date.now()): MintWindowState {
  const { mintStartsAt, mintEndsAt } = project;
  if (mintEndsAt !== undefined && now > mintEndsAt) return "ended";
  if (mintStartsAt === undefined) return "unknown";
  if (now < mintStartsAt) {
    return mintStartsAt - now <= 24 * 60 * 60_000 ? "opens_soon" : "scheduled";
  }
  return "live_now";
}

/** Human countdown ("2d 4h 12m", "1h 5m", "3m 20s", "ended"). */
export function formatMintCountdown(project: LaunchProject, now: number = Date.now()): string | null {
  const { mintStartsAt, mintEndsAt } = project;
  if (mintEndsAt !== undefined && now > mintEndsAt) return "ended";
  const target = mintStartsAt !== undefined && now < mintStartsAt ? mintStartsAt : mintEndsAt;
  if (target === undefined) return null;
  let diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  diff -= days * 86_400_000;
  const hours = Math.floor(diff / 3_600_000);
  diff -= hours * 3_600_000;
  const mins = Math.floor(diff / 60_000);
  diff -= mins * 60_000;
  const secs = Math.floor(diff / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/** One-line mint window status for cards and alerts. */
export function mintWindowLine(project: LaunchProject, now: number = Date.now()): string {
  const state = getMintWindowState(project, now);
  const countdown = formatMintCountdown(project, now);
  const price = project.mintPrice !== undefined ? ` • ${project.mintPrice} native` : "";
  switch (state) {
    case "live_now":
      return `⏳ Mint window OPEN${countdown && countdown !== "ended" ? ` — closes in ${countdown}` : ""}${price}`;
    case "opens_soon":
      return `⏰ Opens in ${countdown ?? "soon"}${price}`;
    case "scheduled":
      return `📅 Opens in ${countdown ?? "the future"}${price}`;
    case "ended":
      return `🏁 Mint window ended`;
    default:
      return project.mintDate ? `Mint: \`${project.mintDate}\`` : "Mint: `TBA`";
  }
}
