import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOP = process.env.SHOPIFY_SHOP;
const SF_TOKEN = process.env.SHOPIFY_P_STOREFRONT_API_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

export async function POST(req: Request) {
  if (!SHOP || !SF_TOKEN) {
    return NextResponse.json(
      { error: "Missing SHOPIFY_SHOP or SHOPIFY_P_STOREFRONT_API_TOKEN on server" },
      { status: 500 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, variables } = (payload as Record<string, unknown>) ?? {};
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing GraphQL query" }, { status: 400 });
  }

  try {
    const sfRes = await fetch(
      `https://${SHOP}/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": SF_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
      }
    );

    const json = await sfRes.json();
    return NextResponse.json(json, { status: sfRes.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}