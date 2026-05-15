import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listSuppressions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("suppressions").collect();
  },
});

export const listByModule = query({
  args: {
    moduleKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suppressions")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect();
  },
});

export const replaceForModule = mutation({
  args: {
    moduleKey: v.string(),
    items: v.array(
      v.object({
        email: v.string(),
        source: v.union(
          v.literal("manual"),
          v.literal("bounce"),
          v.literal("unsubscribe"),
          v.literal("import"),
        ),
        note: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("suppressions")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const createdAt = new Date().toISOString();
    for (const item of args.items) {
      await ctx.db.insert("suppressions", {
        moduleKey: args.moduleKey,
        email: item.email,
        source: item.source,
        note: item.note,
        createdAt,
      });
    }

    return {
      count: args.items.length,
    };
  },
});
