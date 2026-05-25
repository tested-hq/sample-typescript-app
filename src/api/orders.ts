// Order placement + cancellation. Has interesting branch logic (promo codes,
// tiered tax, terminal-state guards on cancel) so `tested diff` will flag a
// lot of uncovered branches when this file is touched. Zero tests on purpose.

import { InMemoryStore } from '../db/inMemoryStore.js';
import { now } from '../util/clock.js';

export type OrderStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  items: ReadonlyArray<{ sku: string; qty: number; unitPriceCents: number }>;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  status: OrderStatus;
  promoCode: string | null;
  placedAt: number;
  updatedAt: number;
}

export interface PlaceOrderInput {
  userId: string;
  items: ReadonlyArray<{ sku: string; qty: number; unitPriceCents: number }>;
  promoCode?: string;
  shipToState?: string;
}

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`order not found: ${id}`);
    this.name = 'OrderNotFoundError';
  }
}

export class InvalidOrderError extends Error {
  constructor(reason: string) {
    super(`invalid order: ${reason}`);
    this.name = 'InvalidOrderError';
  }
}

export class OrderTerminalStateError extends Error {
  constructor(id: string, status: OrderStatus) {
    super(`cannot cancel order ${id} in terminal state: ${status}`);
    this.name = 'OrderTerminalStateError';
  }
}

const orders = new InMemoryStore<Order>();
let counter = 0;

function nextOrderId(): string {
  counter += 1;
  return `ord_${counter}`;
}

export function _resetOrders(): void {
  orders.clear();
  counter = 0;
}

// State-by-state US destination-based sales tax. Highly simplified — the real
// world has thousands of jurisdictions; this is enough to illustrate branches.
const TAX_RATES: Record<string, number> = {
  CA: 0.0725,
  NY: 0.04,
  TX: 0.0625,
  WA: 0.065,
  OR: 0,
};

const PROMO_TABLE: Record<string, { pct: number; minSubtotalCents: number }> = {
  WELCOME10: { pct: 0.1, minSubtotalCents: 0 },
  SAVE20: { pct: 0.2, minSubtotalCents: 5_000 },
  HALFOFF: { pct: 0.5, minSubtotalCents: 20_000 },
};

function applyPromo(subtotalCents: number, code: string | undefined): { discountCents: number; code: string | null } {
  if (!code) return { discountCents: 0, code: null };
  const promo = PROMO_TABLE[code];
  if (!promo) {
    throw new InvalidOrderError(`unknown promo code: ${code}`);
  }
  if (subtotalCents < promo.minSubtotalCents) {
    throw new InvalidOrderError(`promo ${code} requires subtotal >= ${promo.minSubtotalCents}`);
  }
  return { discountCents: Math.floor(subtotalCents * promo.pct), code };
}

function applyTax(taxableCents: number, state: string | undefined): number {
  if (!state) return 0;
  const rate = TAX_RATES[state.toUpperCase()] ?? 0;
  return Math.floor(taxableCents * rate);
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (input.items.length === 0) {
    throw new InvalidOrderError('at least one item is required');
  }
  const subtotalCents = input.items.reduce((n, it) => {
    if (it.qty <= 0 || it.unitPriceCents < 0) {
      throw new InvalidOrderError(`bad item: ${it.sku}`);
    }
    return n + it.qty * it.unitPriceCents;
  }, 0);

  const { discountCents, code } = applyPromo(subtotalCents, input.promoCode);
  const taxCents = applyTax(subtotalCents - discountCents, input.shipToState);
  const ts = now();
  const order: Order = {
    id: nextOrderId(),
    userId: input.userId,
    items: input.items,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
    status: 'pending',
    promoCode: code,
    placedAt: ts,
    updatedAt: ts,
  };
  orders.set(order.id, order);
  return order;
}

export async function getOrder(id: string): Promise<Order> {
  const order = orders.get(id);
  if (!order) {
    throw new OrderNotFoundError(id);
  }
  return order;
}

export async function cancelOrder(id: string): Promise<Order> {
  const order = orders.get(id);
  if (!order) {
    throw new OrderNotFoundError(id);
  }
  if (order.status !== 'pending') {
    throw new OrderTerminalStateError(id, order.status);
  }
  order.status = 'cancelled';
  order.updatedAt = now();
  return order;
}
