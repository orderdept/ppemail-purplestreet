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
