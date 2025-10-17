import "dotenv/config";

const SHOP = process.env.SHOPIFY_SHOP!;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

if (!SHOP || !TOKEN) {
  throw new Error("Missing SHOPIFY_SHOP or SHOPIFY_ADMIN_TOKEN");
}

export async function gql<T>(query: string, variables?: unknown): Promise<T> {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error("Shopify GraphQL error: " + JSON.stringify(json, null, 2));
  }
  return json.data as T;
}

export const dollars = (cents: number) => (Math.max(cents || 0, 0) / 100).toFixed(2);

export function makeHandleFromSlugOrName(slug: string | undefined | null, name: string) {
  if (slug) {
    const base = slug.split("-").slice(0, -1).join("-");
    return (base || slug)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildTags(p: {
  tag?: string[];
  is_featured?: boolean;
  bulk_discount?: boolean;
  is_christmas?: boolean;
  is_christmas_main?: boolean;
  is_alcohol?: boolean;
  free_delivery?: boolean;
  card_layout?: "CLASSIC" | "DOUBLED";
}) {
  const set = new Set<string>(p.tag ?? []);
  if (p.is_featured) set.add("featured");
  if (p.bulk_discount) set.add("bulk_discount");
  if (p.is_christmas) set.add("christmas");
  if (p.is_christmas_main) set.add("christmas_main");
  if (p.is_alcohol) set.add("alcohol");
  if (p.free_delivery) set.add("free_delivery");
  if (p.card_layout === "DOUBLED") set.add("double_card");
  return Array.from(set);
}
