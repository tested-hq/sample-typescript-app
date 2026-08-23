import { beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidOrderError,
  OrderNotFoundError,
  OrderTerminalStateError,
  _resetOrders,
  cancelOrder,
  getOrder,
  placeOrder,
} from '../../src/api/orders.js';

beforeEach(() => {
  _resetOrders();
});

describe('placeOrder', () => {
  it('rejects an empty items list', async () => {
    await expect(
      placeOrder({ userId: 'usr_1', items: [] }),
    ).rejects.toMatchObject({
      name: 'InvalidOrderError',
      message: 'invalid order: at least one item is required',
    });
    await expect(placeOrder({ userId: 'usr_1', items: [] })).rejects.toBeInstanceOf(
      InvalidOrderError,
    );
  });

  it('rejects zero, negative, or negative-priced quantities', async () => {
    await expect(
      placeOrder({
        userId: 'usr_1',
        items: [{ sku: 'SKU-0', qty: 0, unitPriceCents: 100 }],
      }),
    ).rejects.toMatchObject({ message: 'invalid order: bad item: SKU-0' });

    await expect(
      placeOrder({
        userId: 'usr_1',
        items: [{ sku: 'SKU-NEG', qty: -1, unitPriceCents: 100 }],
      }),
    ).rejects.toBeInstanceOf(InvalidOrderError);

    await expect(
      placeOrder({
        userId: 'usr_1',
        items: [{ sku: 'SKU-PRICE', qty: 1, unitPriceCents: -1 }],
      }),
    ).rejects.toMatchObject({ message: 'invalid order: bad item: SKU-PRICE' });
  });

  it('rejects an unknown promo code', async () => {
    await expect(
      placeOrder({
        userId: 'usr_1',
        items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 1_000 }],
        promoCode: 'NOTAREALCODE',
      }),
    ).rejects.toMatchObject({
      name: 'InvalidOrderError',
      message: 'invalid order: unknown promo code: NOTAREALCODE',
    });
  });

  it('enforces SAVE20 minimum subtotal', async () => {
    await expect(
      placeOrder({
        userId: 'usr_1',
        items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 4_999 }],
        promoCode: 'SAVE20',
      }),
    ).rejects.toMatchObject({
      message: 'invalid order: promo SAVE20 requires subtotal >= 5000',
    });

    const order = await placeOrder({
      userId: 'usr_1',
      items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 5_000 }],
      promoCode: 'SAVE20',
    });
    expect(order.subtotalCents).toBe(5_000);
    expect(order.discountCents).toBe(1_000);
    expect(order.promoCode).toBe('SAVE20');
    expect(order.totalCents).toBe(4_000);
  });

  it('enforces HALFOFF minimum subtotal', async () => {
    await expect(
      placeOrder({
        userId: 'usr_1',
        items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 19_999 }],
        promoCode: 'HALFOFF',
      }),
    ).rejects.toMatchObject({
      message: 'invalid order: promo HALFOFF requires subtotal >= 20000',
    });

    const order = await placeOrder({
      userId: 'usr_1',
      items: [{ sku: 'SKU-A', qty: 2, unitPriceCents: 10_000 }],
      promoCode: 'HALFOFF',
    });
    expect(order.subtotalCents).toBe(20_000);
    expect(order.discountCents).toBe(10_000);
    expect(order.promoCode).toBe('HALFOFF');
    expect(order.totalCents).toBe(10_000);
  });

  it('applies destination tax by state and leaves unknown/missing states untaxed', async () => {
    const item = { sku: 'SKU-A', qty: 1, unitPriceCents: 10_000 };

    const ca = await placeOrder({ userId: 'usr_1', items: [item], shipToState: 'CA' });
    expect(ca.taxCents).toBe(725);
    expect(ca.totalCents).toBe(10_725);

    const ny = await placeOrder({ userId: 'usr_1', items: [item], shipToState: 'ny' });
    expect(ny.taxCents).toBe(400);

    const tx = await placeOrder({ userId: 'usr_1', items: [item], shipToState: 'TX' });
    expect(tx.taxCents).toBe(625);

    const wa = await placeOrder({ userId: 'usr_1', items: [item], shipToState: 'WA' });
    expect(wa.taxCents).toBe(650);

    const or = await placeOrder({ userId: 'usr_1', items: [item], shipToState: 'OR' });
    expect(or.taxCents).toBe(0);

    const unknown = await placeOrder({ userId: 'usr_1', items: [item], shipToState: 'ZZ' });
    expect(unknown.taxCents).toBe(0);

    const none = await placeOrder({ userId: 'usr_1', items: [item] });
    expect(none.taxCents).toBe(0);
    expect(none.promoCode).toBeNull();
    expect(none.status).toBe('pending');
    expect(none.id).toMatch(/^ord_\d+$/);
  });

  it('taxes the post-discount amount', async () => {
    const order = await placeOrder({
      userId: 'usr_1',
      items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 10_000 }],
      promoCode: 'WELCOME10',
      shipToState: 'CA',
    });
    expect(order.discountCents).toBe(1_000);
    expect(order.taxCents).toBe(652);
    expect(order.totalCents).toBe(9_652);
  });
});

describe('getOrder', () => {
  it('returns a previously placed order', async () => {
    const placed = await placeOrder({
      userId: 'usr_9',
      items: [{ sku: 'SKU-A', qty: 2, unitPriceCents: 250 }],
    });
    await expect(getOrder(placed.id)).resolves.toEqual(placed);
  });

  it('throws when the id is missing', async () => {
    await expect(getOrder('ord_missing')).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(getOrder('ord_missing')).rejects.toMatchObject({
      message: 'order not found: ord_missing',
    });
  });
});

describe('cancelOrder', () => {
  it('cancels a pending order and updates its timestamp', async () => {
    const placed = await placeOrder({
      userId: 'usr_1',
      items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 100 }],
    });
    const cancelled = await cancelOrder(placed.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.updatedAt).toBeGreaterThanOrEqual(placed.updatedAt);
    await expect(getOrder(placed.id)).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('rejects cancel when the order is already in a terminal state', async () => {
    const placed = await placeOrder({
      userId: 'usr_1',
      items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 100 }],
    });
    await cancelOrder(placed.id);

    await expect(cancelOrder(placed.id)).rejects.toBeInstanceOf(OrderTerminalStateError);
    await expect(cancelOrder(placed.id)).rejects.toMatchObject({
      message: `cannot cancel order ${placed.id} in terminal state: cancelled`,
    });
  });

  it('rejects cancel of a fulfilled order', async () => {
    const placed = await placeOrder({
      userId: 'usr_1',
      items: [{ sku: 'SKU-A', qty: 1, unitPriceCents: 100 }],
    });
    placed.status = 'fulfilled';

    await expect(cancelOrder(placed.id)).rejects.toMatchObject({
      name: 'OrderTerminalStateError',
      message: `cannot cancel order ${placed.id} in terminal state: fulfilled`,
    });
  });

  it('throws when the id is missing', async () => {
    await expect(cancelOrder('ord_missing')).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(cancelOrder('ord_missing')).rejects.toMatchObject({
      message: 'order not found: ord_missing',
    });
  });
});
