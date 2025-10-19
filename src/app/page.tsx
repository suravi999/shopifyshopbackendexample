'use client';

import { useEffect, useState } from 'react';
import { getStorefrontClient } from '@/lib/shopify';
import ProductGrid from '@/components/ProductGrid';
import './globals.css';

const PRODUCTS_QUERY = `#graphql
  query Products($first:Int=12) {
    products(first:$first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            id
            url
            width
            height
            altText
          }
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          compareAtPriceRange {
            minVariantPrice { amount currencyCode }
          }
          variants(first: 1) {
            nodes {
              id
              sku
              availableForSale
              quantityAvailable
              price { amount currencyCode }
            }
          }
          badgeText: metafield(namespace: "custom", key: "badge_text") { value }
          badgeColor: metafield(namespace: "custom", key: "badge_color") { value }
          descriptionText: metafield(namespace: "custom", key: "description_text") { value }
        }
      }
    }
  }
`;

export default function Page() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        const res = await fetch(getStorefrontClient().getStorefrontApiUrl(), {
          method: 'POST',
          headers: getStorefrontClient().getPublicTokenHeaders(),
          body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { first: 12 } }),
        });

        const json = await res.json();
        if (!res.ok || json.errors) {
          console.error('Storefront API error:', res.status, json.errors || json);
          return;
        }

        const nodes = (json.data?.products?.edges ?? []).map((e: any) => e.node);
        if (mounted) setItems(nodes);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="p-6 text-center">
        <p className="text-gray-500">Loading products...</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-ink-900">Our Products</h1>
      <ProductGrid items={items} />
    </main>
  );
}
