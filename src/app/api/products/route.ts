import { NextResponse } from "next/server";

type ProductType = "CLASSIC" | "BUNDLE";
type CardLayout = "CLASSIC" | "DOUBLED";

type Product = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  canonical_url: string | null;
  type: ProductType;
  category: string; // keep as UUID/string like the source
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
  content: unknown[]; // keep shape-compatible with bundles
  media: unknown[];
  tag: string[];
  card_layout: CardLayout;
  bulk_discount: boolean;
  xmas_rank: number;
};

const products: Product[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    sku: "BEEF-RIB-001",
    name: "Beef Ribeye Steak 2 x 300g",
    slug: "beef-ribeye-steak-2x300g-BEEF-RIB-001",
    canonical_url: "https://example.com/products/beef-ribeye-steak-2x300g-BEEF-RIB-001",
    type: "CLASSIC",
    category: "c2f0d4e3-59c5-440f-9165-2ed905888c79", // beef
    old_price: 0,
    price: 3499,
    description: "<p>Grass-fed ribeye steaks, rich marbling, perfect for pan-sear or grill.</p>",
    description_text: "Grass-fed ribeye steaks, rich marbling, perfect for pan-sear or grill.",
    image: null,
    gst: false,
    weight: 600,
    is_weight_precise: true,
    is_active: true,
    is_public: true,
    is_christmas: false,
    is_christmas_main: false,
    is_featured: true,
    is_highlighted: false,
    is_popup: false,
    is_alcohol: false,
    is_outofstock: false,
    free_delivery: false,
    rank: 1000,
    badge_text: "",
    badge_color: "",
    cooking_method: "Grill | Pan-sear",
    nutritional_info: "",
    review_rating: 0,
    content: [],
    media: [],
    tag: ["a7048bee-b91b-4490-8775-c72e04dd045d"], // "beef" tag
    card_layout: "DOUBLED",
    bulk_discount: true,
    xmas_rank: 0,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    sku: "BEEF-MIN-500",
    name: "Beef Mince 500g",
    slug: "beef-mince-500g-BEEF-MIN-500",
    canonical_url: "https://example.com/products/beef-mince-500g-BEEF-MIN-500",
    type: "CLASSIC",
    category: "c2f0d4e3-59c5-440f-9165-2ed905888c79",
    old_price: 0,
    price: 1099,
    description: "<p>Lean 90/10 beef mince. Ideal for bolognese, tacos, and burgers.</p>",
    description_text: "Lean 90/10 beef mince. Ideal for bolognese, tacos, and burgers.",
    image: null,
    gst: false,
    weight: 500,
    is_weight_precise: true,
    is_active: true,
    is_public: true,
    is_christmas: false,
    is_christmas_main: false,
    is_featured: false,
    is_highlighted: false,
    is_popup: false,
    is_alcohol: false,
    is_outofstock: false,
    free_delivery: false,
    rank: 2000,
    badge_text: "",
    badge_color: "",
    cooking_method: "Pan-fry",
    nutritional_info: "",
    review_rating: 0,
    content: [],
    media: [],
    tag: [],
    card_layout: "CLASSIC",
    bulk_discount: true,
    xmas_rank: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    sku: "LAMB-CHOP-700",
    name: "Lamb Loin Chops 700g",
    slug: "lamb-loin-chops-700g-LAMB-CHOP-700",
    canonical_url: "https://example.com/products/lamb-loin-chops-700g-LAMB-CHOP-700",
    type: "CLASSIC",
    category: "a424a3b6-2adb-4ddd-bd2d-4e02fe70da36", // lamb
    old_price: 0,
    price: 2599,
    description: "<p>Tender lamb chops, great on the BBQ with rosemary and garlic.</p>",
    description_text: "Tender lamb chops, great on the BBQ with rosemary and garlic.",
    image: null,
    gst: false,
    weight: 700,
    is_weight_precise: true,
    is_active: true,
    is_public: true,
    is_christmas: false,
    is_christmas_main: false,
    is_featured: false,
    is_highlighted: false,
    is_popup: false,
    is_alcohol: false,
    is_outofstock: false,
    free_delivery: false,
    rank: 3000,
    badge_text: "",
    badge_color: "",
    cooking_method: "BBQ | Grill",
    nutritional_info: "",
    review_rating: 0,
    content: [],
    media: [],
    tag: [],
    card_layout: "DOUBLED",
    bulk_discount: false,
    xmas_rank: 0,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    sku: "CHK-BRST-1KG",
    name: "Chicken Breast Fillets 1kg",
    slug: "chicken-breast-1kg-CHK-BRST-1KG",
    canonical_url: "https://example.com/products/chicken-breast-1kg-CHK-BRST-1KG",
    type: "CLASSIC",
    category: "1fb4b420-5b1e-47e2-86a8-93d2d1efc000", // chicken (dummy)
    old_price: 0,
    price: 1699,
    description: "<p>Free-range chicken breast, trimmed and ready to cook.</p>",
    description_text: "Free-range chicken breast, trimmed and ready to cook.",
    image: null,
    gst: false,
    weight: 1000,
    is_weight_precise: true,
    is_active: true,
    is_public: true,
    is_christmas: false,
    is_christmas_main: false,
    is_featured: false,
    is_highlighted: false,
    is_popup: false,
    is_alcohol: false,
    is_outofstock: false,
    free_delivery: false,
    rank: 4000,
    badge_text: "POPULAR",
    badge_color: "#6b912c",
    cooking_method: "Pan-sear | Oven-bake",
    nutritional_info: "",
    review_rating: 0,
    content: [],
    media: [],
    tag: [],
    card_layout: "CLASSIC",
    bulk_discount: true,
    xmas_rank: 0,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    sku: "PORK-BELLY-800",
    name: "Pork Belly Skin-On 800g",
    slug: "pork-belly-skin-on-800g-PORK-BELLY-800",
    canonical_url: "https://example.com/products/pork-belly-skin-on-800g-PORK-BELLY-800",
    type: "CLASSIC",
    category: "2a99b0f4-6a55-4a11-9a6e-1f0c7c1a9000", // pork (dummy)
    old_price: 0,
    price: 1899,
    description: "<p>Perfect for crispy crackling. Score, salt, and roast.</p>",
    description_text: "Perfect for crispy crackling. Score, salt, and roast.",
    image: null,
    gst: false,
    weight: 800,
    is_weight_precise: true,
    is_active: true,
    is_public: true,
    is_christmas: false,
    is_christmas_main: false,
    is_featured: false,
    is_highlighted: false,
    is_popup: false,
    is_alcohol: false,
    is_outofstock: false,
    free_delivery: false,
    rank: 5000,
    badge_text: "",
    badge_color: "",
    cooking_method: "Roast",
    nutritional_info: "",
    review_rating: 0,
    content: [],
    media: [],
    tag: [],
    card_layout: "CLASSIC",
    bulk_discount: false,
    xmas_rank: 0,
  },
];

export async function GET() {
  const body = {
    count: products.length,
    next: null as null,
    previous: null as null,
    results: products,
  };

  return NextResponse.json(body, {
    headers: {
      "Vary": "Accept",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
