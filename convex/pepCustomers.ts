import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const orderShape = {
  orderId: v.string(),
  orderGroup: v.string(),
  orderDate: v.string(),
  sku: v.string(),
  productName: v.string(),
  dose: v.optional(v.string()),
  brand: v.string(),
  qty: v.number(),
  cost: v.number(),
  price: v.number(),
  profit: v.number(),
  customerName: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  company: v.string(),
  address: v.string(),
  address2: v.string(),
  city: v.string(),
  state: v.string(),
  zipcode: v.string(),
  country: v.string(),
  email: v.string(),
  customerId: v.string(),
};

const skuPriceShape = {
  sku: v.string(),
  cost: v.number(),
  price: v.number(),
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export const listOrders = query({
  args: {
    moduleKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pepCustomerOrders")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect();

    return rows.sort((a, b) => {
      const dateCompare = a.orderDate.localeCompare(b.orderDate);
      return dateCompare || a.orderId.localeCompare(b.orderId, undefined, { numeric: true });
    });
  },
});

export const listSkuPrices = query({
  args: {
    moduleKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pepSkuPrices")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect();

    return rows.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
  },
});

export const upsertSkuPrice = mutation({
  args: {
    moduleKey: v.string(),
    item: v.object(skuPriceShape),
  },
  handler: async (ctx, args) => {
    const updatedAt = new Date().toISOString();
    const existing = await ctx.db
      .query("pepSkuPrices")
      .withIndex("by_module_sku", (q) => q.eq("moduleKey", args.moduleKey).eq("sku", args.item.sku))
      .first();

    const row = {
      moduleKey: args.moduleKey,
      ...args.item,
      updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { updated: 1, added: 0 };
    }

    await ctx.db.insert("pepSkuPrices", row);
    return { updated: 0, added: 1 };
  },
});

export const deleteSkuPrice = mutation({
  args: {
    moduleKey: v.string(),
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pepSkuPrices")
      .withIndex("by_module_sku", (q) => q.eq("moduleKey", args.moduleKey).eq("sku", args.sku))
      .first();

    if (!existing) return { deleted: 0 };

    await ctx.db.delete(existing._id);
    return { deleted: 1 };
  },
});

export const upsertOrders = mutation({
  args: {
    moduleKey: v.string(),
    sourceFile: v.optional(v.string()),
    orders: v.array(v.object(orderShape)),
  },
  handler: async (ctx, args) => {
    const updatedAt = new Date().toISOString();
    let added = 0;
    let updated = 0;

    for (const order of args.orders) {
      const existing = await ctx.db
        .query("pepCustomerOrders")
        .withIndex("by_module_order", (q) => q.eq("moduleKey", args.moduleKey).eq("orderId", order.orderId))
        .first();

      const row = {
        moduleKey: args.moduleKey,
        ...order,
        sourceFile: args.sourceFile,
        updatedAt,
      };

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...row,
          cost: existing.cost,
          price: existing.price,
          profit: existing.profit,
          company: row.company || existing.company || "",
          address: row.address || existing.address || "",
          address2: row.address2 || existing.address2 || "",
          city: row.city || existing.city || "",
          state: row.state || existing.state || "",
          zipcode: row.zipcode || existing.zipcode || "",
          country: row.country || existing.country || "",
        });
        updated += 1;
      } else {
        await ctx.db.insert("pepCustomerOrders", row);
        added += 1;
      }
    }

    return { added, updated };
  },
});

export const updateOrderPricing = mutation({
  args: {
    moduleKey: v.string(),
    orderId: v.string(),
    cost: v.number(),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pepCustomerOrders")
      .withIndex("by_module_order", (q) => q.eq("moduleKey", args.moduleKey).eq("orderId", args.orderId))
      .first();

    if (!existing) return { updated: 0 };

    await ctx.db.patch(existing._id, {
      cost: args.cost,
      price: args.price,
      profit: roundMoney(args.price - args.cost),
      updatedAt: new Date().toISOString(),
    });

    return { updated: 1 };
  },
});

export const markProcessed = mutation({
  args: {
    moduleKey: v.string(),
    orderIds: v.array(v.string()),
    trackingNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const processedAt = new Date().toISOString();
    let updated = 0;

    for (const orderId of args.orderIds) {
      const existing = await ctx.db
        .query("pepCustomerOrders")
        .withIndex("by_module_order", (q) => q.eq("moduleKey", args.moduleKey).eq("orderId", orderId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          trackingNumber: args.trackingNumber,
          processedAt,
          updatedAt: processedAt,
        });
        updated += 1;
      }
    }

    return { updated, processedAt };
  },
});
