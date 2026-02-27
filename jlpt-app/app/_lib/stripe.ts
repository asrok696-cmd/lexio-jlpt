// app/_lib/stripe.ts
import "server-only";
import Stripe from "stripe";

/** Required env getter (throws early) */
export function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return String(v).trim();
}

/**
 * Stripe client (server-only)
 * - IMPORTANT: import this file only from server code (route handlers / server actions).
 *
 * NOTE:
 * - apiVersion は「インストールしてる stripe パッケージの型定義」と一致しないとビルドで落ちる。
 * - まずは apiVersion を指定せず、SDKデフォルトで動かす（最も事故らない）。
 *   どうしても固定したい場合は、あなたの stripe npm version に対応してる apiVersion を後で入れる。
 */
export const stripe = new Stripe(mustEnv("STRIPE_SECRET_KEY"));

/**
 * App base URL (used for success/cancel redirect)
 * Priority:
 * 1) NEXT_PUBLIC_APP_URL (recommended, ex: https://lexio.app)
 * 2) VERCEL_URL (auto on Vercel)
 * 3) http://localhost:3000 (dev)
 */
export function getAppUrl(): string {
  const a = process.env.NEXT_PUBLIC_APP_URL;
  if (a && a.startsWith("http")) return a.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

/**
 * Stripe Price IDs
 * - Put your recurring/subscription Price ID in STRIPE_PRICE_PRO
 *   ex) price_123...
 */
export function getProPriceId(): string {
  return mustEnv("STRIPE_PRICE_PRO");
}

/**
 * Webhook secret (optional until webhook step)
 * - Only required when you implement /api/stripe/webhook
 */
export function getWebhookSecret(): string {
  return mustEnv("STRIPE_WEBHOOK_SECRET");
}