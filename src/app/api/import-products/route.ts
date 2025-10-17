// app/api/import-products/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { gql, dollars, makeHandleFromSlugOrName, buildTags } from "@/lib/shopify";

const LOCATION_ID = process.env.SHOPIFY_LOCATION_ID!;
const DEFAULT_SRC =
  process.env.SOURCE_PRODUCTS_URL || "https://rump.ourcow.com.au/api/products/";

/** ---------------- Types from your source shape ---------------- */
type ProductType = "CLASSIC" | "BUNDLE";
type CardLayout = "CLASSIC" | "DOUBLED";
type Product = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  canonical_url: string | null;
  type: ProductType;
  category: string;
  old_price: number;
  price: number; // cents
  description: string;
  description_text: string;
  image: string | null;
  gst: boolean;
  weight: number; // grams
  is_weight_precise: boolean;
  is_active: boolean;
  is_public: boolean;
  is_christmas: boolean;
  is_christmas_main: boolean;
  is_featured: boolean;
  is_highlighted: boolean;
  is_popup: boolean;
  is_alcohol: boolean;
  is_outofstock: boolean;
  free_delivery: boolean;
  rank: number;
  badge_text: string;
  badge_color: string;
  cooking_method: string;
  nutritional_info: string;
  review_rating: number;
  content: unknown[];
  media: unknown[];
  tag: string[];
  card_layout: CardLayout;
  bulk_discount: boolean;
  xmas_rank: number;
};

type SourceResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
};

/** ---------------- GraphQL operations ---------------- */

// Find by handle (used as idempotent key)
const FIND_BY_HANDLE = `
  query productByHandle($handle: String!) {
    productByHandle(handle: $handle) { id handle variants(first: 1) { nodes { id inventoryItem { id sku } } } }
  }
`;

// NOTE: current schema uses the 'product' argument and does not accept 'variants' inline.
const PRODUCT_CREATE = `
  mutation productCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product {
        id
        handle
        variants(first: 1) { nodes { id inventoryItem { id sku } } }
      }
      userErrors { field message }
    }
  }
`;

const PRODUCT_UPDATE = `
  mutation productUpdate($product: ProductInput!) {
    productUpdate(product: $product) {
      product {
        id
        handle
        variants(first: 1) { nodes { id inventoryItem { id sku } } }
      }
      userErrors { field message }
    }
  }
`;

// Bulk update variant fields (price) and inventory item fields (sku, etc.)
const PRODUCT_VARIANTS_BULK_UPDATE = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
      userErrors { field message }
    }
  }
`;

// Metafields (requires definitions under namespace "custom")
const METAFIELDS_SET = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace owner { id } }
      userErrors { field message }
    }
  }
`;

// Optional: ensure inventory item flags (e.g., tracked) or SKU updates
const INVENTORY_ITEM_UPDATE = `
  mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
    inventoryItemUpdate(id: $id, input: $input) {
      inventoryItem { id }
      userErrors { field message }
    }
  }
`;

// Activate inventory at a location (creates InventoryLevel if missing)
const INVENTORY_ACTIVATE = `
  mutation inventoryActivate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
    inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
      inventoryLevel { id }
      userErrors { field message }
    }
  }
`;

// Set absolute quantity at a location
const INVENTORY_SET = `
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      userErrors { field message }
    }
  }
`;

/** ---------------- Import/Upsert logic per product ---------------- */

async function upsertOne(p: Product) {
  if (!LOCATION_ID) throw new Error("Missing SHOPIFY_LOCATION_ID (gid://shopify/Location/...)");

  // 1) Create a stable handle (from slug or name)
  const handle = makeHandleFromSlugOrName(p.slug, p.name);

  // 2) Check if a product already exists
  const existing = await gql<{ productByHandle: any }>(FIND_BY_HANDLE, { handle });

  // 3) Base product payload (NO variants here)
  const baseProduct = {
    title: p.name,
    handle,
    descriptionHtml: p.description || "",
    productType: p.category || "uncategorized",
    status: p.is_active && p.is_public ? "ACTIVE" : "DRAFT",
    tags: buildTags(p),
  };

  // 4) Create or update product
  let productId: string;
  let defaultVariantId: string | undefined;
  let inventoryItemId: string | undefined;

  if (existing.productByHandle?.id) {
    const out = await gql<{ productUpdate: { product: any; userErrors: any[] } }>(PRODUCT_UPDATE, {
      product: { id: existing.productByHandle.id, ...baseProduct },
    });
    if (out.productUpdate.userErrors?.length) {
      throw new Error("productUpdate userErrors: " + JSON.stringify(out.productUpdate.userErrors));
    }
    const prod = out.productUpdate.product;
    productId = prod.id;
    defaultVariantId = prod.variants?.nodes?.[0]?.id;
    inventoryItemId = prod.variants?.nodes?.[0]?.inventoryItem?.id;
  } else {
    const out = await gql<{ productCreate: { product: any; userErrors: any[] } }>(PRODUCT_CREATE, {
      product: baseProduct,
    });
    if (out.productCreate.userErrors?.length) {
      throw new Error("productCreate userErrors: " + JSON.stringify(out.productCreate.userErrors));
    }
    const prod = out.productCreate.product;
    productId = prod.id;
    defaultVariantId = prod.variants?.nodes?.[0]?.id;
    inventoryItemId = prod.variants?.nodes?.[0]?.inventoryItem?.id;
  }

  if (!productId || !defaultVariantId || !inventoryItemId) {
    throw new Error("Missing product/variant/inventoryItem IDs after create/update.");
  }

  // 5) Update default variant (price) and inventory item (sku)
  {
    const out = await gql<{ productVariantsBulkUpdate: { userErrors: any[] } }>(
      PRODUCT_VARIANTS_BULK_UPDATE,
      {
        productId,
        variants: [
          {
            id: defaultVariantId,
            price: dollars(p.price),
            inventoryItem: { sku: p.sku || "" },
          },
        ],
      }
    );
    if (out.productVariantsBulkUpdate.userErrors?.length) {
      throw new Error(
        "productVariantsBulkUpdate userErrors: " +
          JSON.stringify(out.productVariantsBulkUpdate.userErrors)
      );
    }
  }

  // 6) (Optional) Ensure inventory item is tracked (if your store needs it)
  try {
    await gql(INVENTORY_ITEM_UPDATE, {
      id: inventoryItemId,
      input: { sku: p.sku || "" /*, tracked: true (enable if your API version supports it)*/ },
    });
  } catch {
    // non-fatal for POC; some API versions restrict tracked here
  }

  // 7) Activate inventory at location (creates level if missing)
  const initialQty = p.is_outofstock ? 0 : 10;
  try {
    const act = await gql<{ inventoryActivate: { userErrors: any[] } }>(INVENTORY_ACTIVATE, {
      inventoryItemId,
      locationId: LOCATION_ID,
      available: initialQty,
    });
    if (act.inventoryActivate?.userErrors?.length) {
      // not fatal; we'll still set quantities below
      // eslint-disable-next-line no-console
      console.warn("inventoryActivate userErrors", act.inventoryActivate.userErrors);
    }
  } catch {
    // swallow; not all stores require/allow explicit activate in all cases
  }

  // 8) Set absolute quantity
  const quantity = p.is_outofstock ? 0 : 10;
  const set = await gql<{ inventorySetQuantities: { userErrors: any[] } }>(INVENTORY_SET, {
    input: {
      reason: "correction",
      name: "available",
      changes: [
        {
          inventoryItemId,
          locationId: LOCATION_ID,
          type: "set",
          quantity,
          delta: 0,
        },
      ],
    },
  });
  if (set.inventorySetQuantities?.userErrors?.length) {
    throw new Error(
      "inventorySetQuantities userErrors: " +
        JSON.stringify(set.inventorySetQuantities.userErrors)
    );
  }

  // 9) Metafields (typed; defs must exist under namespace "custom")
  await gql(METAFIELDS_SET, {
    metafields: [
      {
        ownerId: productId,
        namespace: "custom",
        key: "gst",
        type: "boolean",
        value: String(Boolean(p.gst)),
      },
      {
        ownerId: productId,
        namespace: "custom",
        key: "badge_text",
        type: "single_line_text_field",
        value: p.badge_text || "",
      },
      {
        ownerId: productId,
        namespace: "custom",
        key: "badge_color",
        type: "single_line_text_field",
        value: p.badge_color || "",
      },
      {
        ownerId: productId,
        namespace: "custom",
        key: "cooking_method",
        type: "single_line_text_field",
        value: p.cooking_method || "",
      },
      {
        ownerId: productId,
        namespace: "custom",
        key: "description_text",
        type: "multi_line_text_field",
        value: p.description_text || "",
      },
    ],
  });
}

/** ---------------- POST handler ---------------- */

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const src = url.searchParams.get("src") || DEFAULT_SRC;

    const r = await fetch(src, { cache: "no-store" });
    const data = (await r.json()) as SourceResponse;

    if (!r.ok || !data?.results) {
      return NextResponse.json(
        { error: "Bad upstream response", from: src },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const results: { name: string; ok: boolean; error?: string }[] = [];
    for (const p of data.results) {
      try {
        await upsertOne(p);
        results.push({ name: p.name, ok: true });
      } catch (e: any) {
        results.push({ name: p.name, ok: false, error: e?.message ?? String(e) });
      }
    }

    return NextResponse.json(
      { imported: results.filter((x) => x.ok).length, results },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
