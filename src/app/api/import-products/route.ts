// app/api/import-products/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { gql, dollars, makeHandleFromSlugOrName, buildTags } from "@/lib/shopify";

/** ------------ Env ------------ */
const LOCATION_ID = process.env.SHOPIFY_LOCATION_ID!;
const DEFAULT_SRC =
    process.env.SOURCE_PRODUCTS_URL || "https://rump.ourcow.com.au/api/products/";

/** ------------ Source types (your upstream shape) ------------ */
type ProductType = "CLASSIC" | "BUNDLE";
type CardLayout = "CLASSIC" | "DOUBLED";

export type SourceProduct = {
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
    results: SourceProduct[];
};

/** ------------ Shopify GraphQL types ------------ */
type GQLError = { field?: string[]; message: string };

type VariantNode = {
    id: string;
    inventoryItem: { id: string; sku: string };
};

type ProductNode = {
    id: string;
    handle: string;
    variants: { nodes: VariantNode[] };
};

type FindByHandleQuery = {
    productByHandle: (ProductNode & {}) | null;
};

type ProductCreateInput = {
    title: string;
    handle?: string;
    descriptionHtml?: string;
    productType?: string;
    status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
    tags?: string[];
};

type ProductUpdateInput = ProductCreateInput & { id: string };

type ProductCreateMutation = {
    productCreate: {
        product: ProductNode | null;
        userErrors: GQLError[];
    };
};

type ProductUpdateMutation = {
    productUpdate: {
        product: ProductNode | null;
        userErrors: GQLError[];
    };
};

type ProductVariantsBulkUpdateMutation = {
    productVariantsBulkUpdate: {
        productVariants: { id: string }[];
        userErrors: GQLError[];
    };
};

type InventoryItemUpdateMutation = {
    inventoryItemUpdate: {
        inventoryItem: { id: string } | null;
        userErrors: GQLError[];
    };
};

type InventoryActivateMutation = {
    inventoryActivate: {
        inventoryLevel: { id: string } | null;
        userErrors: GQLError[];
    };
};

type InventorySetQuantitiesMutation = {
    inventorySetQuantities: {
        userErrors: GQLError[];
    };
};

/** ------------ GraphQL documents ------------ */
const FIND_BY_HANDLE = `
  query productByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      handle
      variants(first: 1) { nodes { id inventoryItem { id sku } } }
    }
  }
`;

const PRODUCT_CREATE = `
  mutation productCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product { id handle variants(first: 1) { nodes { id inventoryItem { id sku } } } }
      userErrors { field message }
    }
  }
`;

const PRODUCT_UPDATE = `
  mutation productUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id handle variants(first: 1) { nodes { id inventoryItem { id sku } } } }
      userErrors { field message }
    }
  }
`;

const PRODUCT_VARIANTS_BULK_UPDATE = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
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

const INVENTORY_ITEM_UPDATE = `
  mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
    inventoryItemUpdate(id: $id, input: $input) {
      inventoryItem { id }
      userErrors { field message }
    }
  }
`;

const INVENTORY_ACTIVATE = `
  mutation inventoryActivate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
    inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
      inventoryLevel { id }
      userErrors { field message }
    }
  }
`;

const INVENTORY_SET = `
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        reason
        changes {
          name
          quantityAfterChange
          item { id }
          location { id }
        }
      }
      userErrors { field message }
    }
  }
`;


/** ------------ Importer core ------------ */

function asErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

async function upsertOne(p: SourceProduct): Promise<void> {
    if (!LOCATION_ID) {
        throw new Error("Missing SHOPIFY_LOCATION_ID (gid://shopify/Location/...)");
    }

    // 1) Handle
    const handle = makeHandleFromSlugOrName(p.slug, p.name);

    // 2) Lookup existing product
    const found = await gql<FindByHandleQuery>(FIND_BY_HANDLE, { handle });

    // 3) Build product payload (no variants inline)
    const productBase: ProductCreateInput = {
        title: p.name,
        handle,
        descriptionHtml: p.description || "",
        productType: p.category || "uncategorized",
        status: p.is_active && p.is_public ? "ACTIVE" : "DRAFT",
        tags: buildTags(p),
    };

    // 4) Create or update
    let product: ProductNode | null = null;
    if (found.productByHandle?.id) {
        const updateInput: ProductUpdateInput = { id: found.productByHandle.id, ...productBase };
        const upd = await gql<ProductUpdateMutation>(PRODUCT_UPDATE, { product: updateInput });
        if (upd.productUpdate.userErrors.length) {
            throw new Error(`productUpdate userErrors: ${JSON.stringify(upd.productUpdate.userErrors)}`);
        }
        product = upd.productUpdate.product;
    } else {
        const crt = await gql<ProductCreateMutation>(PRODUCT_CREATE, { product: productBase });
        if (crt.productCreate.userErrors.length) {
            throw new Error(`productCreate userErrors: ${JSON.stringify(crt.productCreate.userErrors)}`);
        }
        product = crt.productCreate.product;
    }

    if (!product) throw new Error("Product create/update returned null product.");

    const defaultVariant = product.variants.nodes[0];
    if (!defaultVariant) throw new Error("No default variant found after create/update.");
    const defaultVariantId = defaultVariant.id;
    const inventoryItemId = defaultVariant.inventoryItem.id;

    // 5) Update default variant (price) + inventory item (sku)
    const bulk = await gql<ProductVariantsBulkUpdateMutation>(PRODUCT_VARIANTS_BULK_UPDATE, {
        productId: product.id,
        variants: [
            {
                id: defaultVariantId,
                price: dollars(p.price),
                inventoryItem: { sku: p.sku || "" },
            },
        ],
    });
    if (bulk.productVariantsBulkUpdate.userErrors.length) {
        throw new Error(
            `productVariantsBulkUpdate userErrors: ${JSON.stringify(
                bulk.productVariantsBulkUpdate.userErrors
            )}`
        );
    }

    // (Optional) Ensure inventory item flags; not all API versions support tracked here
    try {
        const invUpd = await gql<InventoryItemUpdateMutation>(INVENTORY_ITEM_UPDATE, {
            id: inventoryItemId,
            input: { sku: p.sku || "" },
        });
        if (invUpd.inventoryItemUpdate.userErrors.length) {
            // non-fatal for POC
        }
    } catch {
        // ignore optional step failures
    }

    // 6) Activate at location (creates InventoryLevel if missing)
    const initialQty = p.is_outofstock ? 0 : 10;
    try {
        const act = await gql<InventoryActivateMutation>(INVENTORY_ACTIVATE, {
            inventoryItemId,
            locationId: LOCATION_ID,
            available: initialQty,
        });
        if (act.inventoryActivate.userErrors.length) {
            // not fatal; we will still set absolute quantity
        }
    } catch {
        // ignore; activation isn't required on all stores/versions
    }

    // 7) Set absolute quantity
    const set = await gql<InventorySetQuantitiesMutation>(INVENTORY_SET, {
        input: {
            reason: "correction",
            name: "available",
            quantities: [
                {
                    inventoryItemId,
                    locationId: LOCATION_ID,
                    quantity: p.is_outofstock ? 0 : 10,
                },
            ],
        },
    });

    if (set.inventorySetQuantities.userErrors.length) {
        throw new Error(
            `inventorySetQuantities userErrors: ${JSON.stringify(
                set.inventorySetQuantities.userErrors
            )}`
        );
    }

    // 8) Metafields (typed; requires definitions under namespace "custom")
    await gql(
        METAFIELDS_SET,
        {
            metafields: [
                {
                    ownerId: product.id,
                    namespace: "custom",
                    key: "gst",
                    type: "boolean",
                    value: String(Boolean(p.gst)),
                },
                {
                    ownerId: product.id,
                    namespace: "custom",
                    key: "badge_text",
                    type: "single_line_text_field",
                    value: p.badge_text || "",
                },
                {
                    ownerId: product.id,
                    namespace: "custom",
                    key: "badge_color",
                    type: "single_line_text_field",
                    value: p.badge_color || "",
                },
                {
                    ownerId: product.id,
                    namespace: "custom",
                    key: "cooking_method",
                    type: "single_line_text_field",
                    value: p.cooking_method || "",
                },
                {
                    ownerId: product.id,
                    namespace: "custom",
                    key: "description_text",
                    type: "multi_line_text_field",
                    value: p.description_text || "",
                },
            ],
        }
    );
}

/** ------------ POST handler ------------ */
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

        const results: Array<{ name: string; ok: boolean; error?: string }> = [];

        for (const p of data.results) {
            try {
                await upsertOne(p);
                results.push({ name: p.name, ok: true });
            } catch (err: unknown) {
                results.push({ name: p.name, ok: false, error: asErrorMessage(err) });
            }
        }

        return NextResponse.json(
            { imported: results.filter((x) => x.ok).length, results },
            { headers: { "Access-Control-Allow-Origin": "*" } }
        );
    } catch (err: unknown) {
        return NextResponse.json(
            { error: asErrorMessage(err) },
            { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
        );
    }
}
