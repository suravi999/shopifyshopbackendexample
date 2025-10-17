
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { products } from "@/data/products";

export async function GET() {
  const body = {
    count: products.length,
    next: null as null,
    previous: null as null,
    results: products,
  };

  return NextResponse.json(body, {
    headers: {
      Vary: "Accept",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
