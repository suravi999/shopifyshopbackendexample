// app/api/import-products/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { gql, dollars, makeHandleFromSlugOrName, buildTags } from "@/lib/shopify";

const LOCATION_ID = process.env.SHOPIFY_LOCATION_ID!;
const DEFAULT_SRC = process.env.SOURCE_PRODUCTS_URL || "";

// ---- GraphQL ops ----
const FIND_BY_HANDLE = `
  query productByHandle($handle: String!) {
    productByHandle(handle: $handle) { id handle }
  }
`;

const PRODUCT_CREATE = `
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product { id title handle }
      userErrors { field message }
    }
  }
`;

const PRODUCT_UPDATE = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id title handle }
      userErrors { field message }
    }
  }
`;


const METAFIELDS_SET = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace owner { id } }
      userErrors { field message }
    }
  }
`;

const QUERY_VARIANTS_WITH_INV = `
  query ($id: ID!) {
    product(id: $id) {
      variants(first: 1) {
        edges { node { id inventoryItem { id sku tracked } } }
      }
    }
  }
`;

const INVENTORY_SET = `
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup { reason }
      userErrors { field message }
    }
  }
`;

// source types
type ProductType = "CLASSIC" | "BUNDLE";
type CardLayout = "CLASSIC" | "DOUBLED";
type Product = {
  id: string; sku: string; name: string; slug: string; canonical_url: string | null;
  type: ProductType; category: string; old_price: number; price: number;
  description: string; description_text: string; image: string | null; gst: boolean; weight: number;
  is_weight_precise: boolean; is_active: boolean; is_public: boolean; is_christmas: boolean;
  is_christmas_main: boolean; is_featured: boolean; is_highlighted: boolean; is_popup: boolean;
  is_alcohol: boolean; is_outofstock: boolean; free_delivery: boolean; rank: number;
  badge_text: string; badge_color: string; cooking_method: string; nutritional_info: string;
  review_rating: number; content: unknown[]; media: unknown[]; tag: string[];
  card_layout: CardLayout; bulk_discount: boolean; xmas_rank: number;
};

type SourceResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
};

async function upsertOne(p: Product) {
  if (!LOCATION_ID) throw new Error("Missing SHOPIFY_LOCATION_ID (gid://shopify/Location/...)");

  const handle = makeHandleFromSlugOrName(p.slug, p.name);

  // 1) find or create by handle
  const existing = await gql<{ productByHandle: { id: string } | null }>(FIND_BY_HANDLE, { handle });

  const productInput = {
    title: p.name,
    handle,
    descriptionHtml: p.description || "",
    productType: p.category || "uncategorized",
    status: p.is_active && p.is_public ? "ACTIVE" : "DRAFT",
    tags: buildTags(p),
    variants: [
      {
        price: dollars(p.price),        // cents -> "12.34"
        sku: p.sku || "",
        weight: Math.max(p.weight || 0, 0),
        weightUnit: "GRAMS",
        inventoryItem: { sku: p.sku || "", tracked: true },
      },
    ],
  };

  let productId: string;
  if (existing.productByHandle?.id) {
    const out = await gql<{ productUpdate: { product: { id: string }, userErrors: unknown[] } }>(PRODUCT_UPDATE, {
      input: { id: existing.productByHandle.id, ...productInput },
    });
    if (out.productUpdate.userErrors?.length) throw new Error(JSON.stringify(out.productUpdate.userErrors));
    productId = out.productUpdate.product.id;
  } else {
    const out = await gql<{ productCreate: { product: { id: string }, userErrors: unknown[] } }>(PRODUCT_CREATE, {
      input: productInput,
    });
    if (out.productCreate.userErrors?.length) throw new Error(JSON.stringify(out.productCreate.userErrors));
    productId = out.productCreate.product.id;
  }

  // 2) metafields (need definitions under namespace "custom")
  const metafields = [
    { ownerId: productId, namespace: "custom", key: "gst", type: "boolean", value: String(Boolean(p.gst)) },
    { ownerId: productId, namespace: "custom", key: "badge_text", type: "single_line_text_field", value: p.badge_text || "" },
    { ownerId: productId, namespace: "custom", key: "badge_color", type: "single_line_text_field", value: p.badge_color || "" },
    { ownerId: productId, namespace: "custom", key: "cooking_method", type: "single_line_text_field", value: p.cooking_method || "" },
    { ownerId: productId, namespace: "custom", key: "description_text", type: "multi_line_text_field", value: p.description_text || "" },
  ];
  await gql(METAFIELDS_SET, { metafields });

  // 3) set inventory on first variant
  const vq = await gql<{ product: { variants: { edges: { node: { inventoryItem: { id: string } } }[] } } }>(
    QUERY_VARIANTS_WITH_INV, { id: productId }
  );
  const invItemId = vq.product.variants.edges[0]?.node?.inventoryItem?.id;
  if (!invItemId) return;

  const quantity = p.is_outofstock ? 0 : 10; // TODO: need to replace with your real stock value
  await gql(INVENTORY_SET, {
    input: {
      reason: "correction",
      name: "available",
      changes: [
        { inventoryItemId: invItemId, locationId: LOCATION_ID, type: "set", quantity, delta: 0 },
      ],
    },
  });
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const src = url.searchParams.get("src") || DEFAULT_SRC;

    const r = await fetch(src, { cache: "no-store" });
    const data = (await r.json()) as SourceResponse;

    if (!r.ok || !data?.results) {
      return NextResponse.json({ error: "Bad upstream response", from: src }, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const results: { name: string; ok: boolean; error?: string }[] = [];
    for (const p of data.results) {
      try {
        await upsertOne(p);
        results.push({ name: p.name, ok: true });
      } catch (e) {
        results.push({ name: p.name, ok: false, error: String(e) ?? String(e) });
      }
    }

    return NextResponse.json(
      { imported: results.filter(x => x.ok).length, results },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: String(e) ?? "Unknown error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
