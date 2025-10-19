'use client';
import React from 'react';
import Image from 'next/image';
import { useMoney } from '@shopify/hydrogen-react';
import { addToCartAndCheckout } from '@/lib/cart';

// Type for product data
interface ProductNode {
  id: string;
  title: string;
  handle: string;
  featuredImage?: {
    id: string;
    url: string;
    width: number;
    height: number;
    altText?: string;
  };
  priceRange?: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  compareAtPriceRange?: {
    minVariantPrice?: { amount: string; currencyCode: string };
  };
  variants?: {
    nodes: Array<{
      id: string;
      sku?: string;
      availableForSale?: boolean;
      quantityAvailable?: number;
      price?: { amount: string; currencyCode: string };
    }>;
  };
  badgeText?: { value?: string };
  badgeColor?: { value?: string };
  descriptionText?: { value?: string };
}

// Helper to render currency
function Price({ amount, currencyCode }: { amount: string; currencyCode: string }) {
  const money = useMoney({ amount, currencyCode });
  return <span>{money.currencySymbol}{money.amount}</span>;
}

//Single product card
function ProductCard({ product }: { product: ProductNode }) {
  const img = product.featuredImage;
  const variant = product.variants?.nodes?.[0];
  const price = product.priceRange?.minVariantPrice;
  const compare = product.compareAtPriceRange?.minVariantPrice;

  return (
    <article className="bg-white rounded-card shadow-card overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-transform">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-neutral-50">
        {img && (
          <Image
            src={img.url}
            alt={img.altText ?? product.title}
            fill
            className="object-cover"
          />
        )}
      </div>

      {/* Details */}
      {/* Details Section */}
      <div className="p-4 border-t border-dashed border-gray-200 bg-[linear-gradient(135deg,#f8f8f1_0%,#f6f6e8_100%)]">
        <h3 className="text-base font-medium text-ink-900 line-clamp-2 mb-1">{product.title}</h3>

        {/* Price & compare price */}
        <div className="flex items-center gap-3">
          {price && (
            <div className="text-lg font-semibold text-ink-900">
              <Price amount={price.amount} currencyCode={price.currencyCode} />
            </div>
          )}
          {compare && Number(compare.amount) > Number(price?.amount ?? 0) && (
            <div className="text-sm line-through text-ink-500">
              <Price amount={compare.amount} currencyCode={compare.currencyCode} />
            </div>
          )}
        </div>

        <div className="text-sm text-ink-500 mt-1">Approx. 500g</div>

        <button
          className="mt-3 w-full rounded-xl bg-brand-green bg-green-600 text-white py-3 font-medium hover:bg-brand-greenDark hover:bg-green-700 transition-colors"
          onClick={async (e) => {
            e.preventDefault();
            if (!variant?.id) return;
            try {
              (e.currentTarget as HTMLButtonElement).disabled = true;
              await addToCartAndCheckout(variant.id, 1);
            } catch (err) {
              console.error('Checkout error', err);
              alert('Sorry—could not start checkout.');
            }
          }}
        >
          Buy Now
        </button>

      </div>

    </article>
  );
}

// Product grid wrapper
export default function ProductGrid({ items }: { items: ProductNode[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
