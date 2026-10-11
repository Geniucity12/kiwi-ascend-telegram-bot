import { SUPPORTED_CHAINS, OPENSEA_API_KEY } from "../config";

/**
 * OpenSea API client (v2).
 *
 * Reads (floor, offers, NFT inventory) work whenever OPENSEA_API_KEY is set.
 * Write paths that require Seaport order construction (creating listings,
 * accepting offers, cancelling) check for configuration and throw a clear,
 * actionable error when the required signing backend is not available, so the
 * Telegram UI can surface a friendly message instead of a stack trace.
 */

const OPENSEA_BASE = "https://api.opensea.io/api/v2";

/** Map our chain keys to OpenSea chain slugs. Elysium is not on OpenSea. */
export function openseaSlugForChain(chainKey: string): string | undefined {
  const chain = SUPPORTED_CHAINS.find((c) => c.key === chainKey);
  return (chain as any)?.openSeaSlug;
}

export async function openseaGet<T>(path: string): Promise<T> {
  if (!OPENSEA_API_KEY) throw new Error("OpenSea API key not configured.");
  const res = await fetch(`${OPENSEA_BASE}${path}`, {
    headers: { Accept: "application/json", "X-API-KEY": OPENSEA_API_KEY },
  });
  if (!res.ok) throw new Error(`OpenSea ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function openseaPost<T>(path: string, body: unknown): Promise<T> {
  if (!OPENSEA_API_KEY) throw new Error("OpenSea API key not configured.");
  const res = await fetch(`${OPENSEA_BASE}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "X-API-KEY": OPENSEA_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenSea ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

function requireListingSupport(chainKey: string): string {
  const slug = openseaSlugForChain(chainKey);
  if (!slug) {
    throw new Error(
      "Seaport listing/offer signing is not enabled for this chain yet. Elysium has no OpenSea market, so this feature is scoped to OpenSea-listed EVM chains and requires a configured signing backend."
    );
  }
  return slug;
}

export interface NftListingResult {
  order: unknown;
  orderHash: string;
}

export const openSeaService = {
  /**
   * Publish a Seaport listing via OpenSea.
   *
   * Requires a backend that can construct + sign a Seaport order. That signing
   * step is intentionally not implemented here (it needs per-collection conduit
   * allowances and an order-signing service), so we surface a clear error the
   * Telegram layer can display instead of pretending the listing succeeded.
   */
  async createNftListing(
    _privateKey: string,
    chainKey: string,
    _contract: string,
    _tokenId: string,
    _priceEth: string
  ): Promise<NftListingResult> {
    requireListingSupport(chainKey);
    throw new Error(
      "Listing creation requires the Seaport order-signing backend, which is not configured for this deployment."
    );
  },

  /** Fetch the best offer for a specific NFT via OpenSea. */
  async getBestOfferForNft(
    chainKey: string,
    _slug: string,
    contract: string,
    tokenId: string
  ): Promise<{ price: string; currency: string; orderHash: string } | null> {
    requireListingSupport(chainKey);
    const slug = openseaSlugForChain(chainKey)!;
    try {
      const res = await openseaGet<{
        offers?: Array<{
          order_hash: string;
          price?: { current?: { currency?: string; decimal?: string } };
        }>;
      }>(
        `/offers?asset_contract_address=${contract}&token_id=${tokenId}&next=${""}`
      );
      const offers = res?.offers ?? [];
      if (offers.length === 0) return null;
      const best = offers[0];
      return {
        price: best.price?.current?.decimal ?? "0",
        currency: best.price?.current?.currency ?? "ETH",
        orderHash: best.order_hash,
      };
    } catch (err) {
      throw new Error(
        `Could not fetch offers for this NFT on ${slug}: ${(err as Error).message}`
      );
    }
  },

  async acceptNftOffer(
    _privateKey: string,
    chainKey: string,
    _offer: { orderHash?: string }
  ): Promise<string> {
    requireListingSupport(chainKey);
    throw new Error(
      "Offer acceptance requires the Seaport fulfillment backend, which is not configured for this deployment."
    );
  },

  async cancelListing(
    _privateKey: string,
    chainKey: string,
    _order: unknown
  ): Promise<string> {
    requireListingSupport(chainKey);
    throw new Error(
      "Listing cancellation requires the Seaport cancellation backend, which is not configured for this deployment."
    );
  },
};
