import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const draftShape = {
  moduleKey: v.string(),
  csvContacts: v.array(
    v.object({
      email: v.string(),
      name: v.string(),
    }),
  ),
  typedContacts: v.array(
    v.object({
      email: v.string(),
      name: v.string(),
    }),
  ),
  pasteText: v.string(),
  smtpHost: v.string(),
  smtpPort: v.number(),
  smtpSecurity: v.union(v.literal("ssl"), v.literal("starttls")),
  smtpUsername: v.string(),
  fromName: v.string(),
  dailyLimit: v.number(),
  perSecond: v.number(),
  spacingMode: v.union(v.literal("rate"), v.literal("daily")),
  updatedAt: v.string(),
};

export const getByModule = query({
  args: { moduleKey: v.string() },
  handler: async (ctx, { moduleKey }) => {
    return await ctx.db
      .query("campaignDrafts")
      .withIndex("by_module", (query) => query.eq("moduleKey", moduleKey))
      .first();
  },
});

export const upsertForModule = mutation({
  args: draftShape,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("campaignDrafts")
      .withIndex("by_module", (query) => query.eq("moduleKey", args.moduleKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("campaignDrafts", args);
    return await ctx.db.get(id);
  },
});
