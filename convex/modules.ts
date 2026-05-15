import { mutation, query } from "./_generated/server";

const now = () => new Date().toISOString();

export const seedPurplePricesModule = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("modules")
      .withIndex("by_key", (q) => q.eq("key", "purple-prices-email"))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("modules", {
      key: "purple-prices-email",
      name: "Purple Prices Email",
      status: "planned",
      hostname: "ppemail.purplestreet.com",
      businessName: "Purple Prices",
      businessEmail: "support@purpleprices.com",
      updatedAt: now(),
    });
  },
});

export const listModules = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("modules").collect();
  },
});
