'use client';

import { getStorefrontClient } from '@/lib/shopify';

const GQL = String.raw;

const CART_CREATE = GQL`
mutation CartCreate($lines: [CartLineInput!]) {
  cartCreate(input: { lines: $lines }) {
    cart { id checkoutUrl totalQuantity }
    userErrors { message }
  }
}
`;

const CART_LINES_ADD = GQL`
mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart { id checkoutUrl totalQuantity }
    userErrors { message }
  }
}
`;

// generic storefront fetch using the PUBLIC token (safe in browser)
async function storefront<T = unknown>(query: string, variables: Record<string, any>) {
  const res = await fetch(getStorefrontClient().getStorefrontApiUrl(), {
    method: 'POST',
    headers: getStorefrontClient().getPublicTokenHeaders(),
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors ?? json));
  }
  return json as T;
}

const CART_KEY = 'sf_cart_id';

export async function addToCartAndCheckout(variantId: string, quantity = 1) {
  if (!variantId) throw new Error('Missing variantId');

  let cartId = undefined;
  try {
    cartId = localStorage.getItem(CART_KEY) ?? undefined;
  } catch {
    // SSR or blocked storage. just create a fresh cart
  }

  if (!cartId) {
    const data: any = await storefront(CART_CREATE, {
      lines: [{ merchandiseId: variantId, quantity }],
    });
    const cart = data?.data?.cartCreate?.cart;
    if (!cart) throw new Error(JSON.stringify(data?.data?.cartCreate?.userErrors));
    try { localStorage.setItem(CART_KEY, cart.id); } catch {}
    window.location.href = cart.checkoutUrl;
    return;
  }

  const data: any = await storefront(CART_LINES_ADD, {
    cartId,
    lines: [{ merchandiseId: variantId, quantity }],
  });
  const cart = data?.data?.cartLinesAdd?.cart;
  if (!cart) {
    // stored cart probably invalid. clear and retry once
    try { localStorage.removeItem(CART_KEY); } catch {}
    return addToCartAndCheckout(variantId, quantity);
  }
  window.location.href = cart.checkoutUrl;
}

// optional helpers
export function getStoredCartId() {
  try { return localStorage.getItem(CART_KEY); } catch { return null; }
}
export function clearStoredCartId() {
  try { localStorage.removeItem(CART_KEY); } catch {}
}
