import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByModule = query({
  args: {
    moduleKey: v.string(),
    campaignName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("templates")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect();
    if (!args.campaignName) return rows;
    const matchName = args.campaignName.trim().toLowerCase();
    return rows.filter((row) => row.campaignName.trim().toLowerCase() === matchName);
  },
});

export const upsertForModule = mutation({
  args: {
    moduleKey: v.string(),
    campaignName: v.string(),
    name: v.string(),
    subject: v.string(),
    previewText: v.string(),
    body: v.string(),
    mailingAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("templates")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect();

    const match = existing.find(
      (row) =>
        row.campaignName.trim().toLowerCase() === args.campaignName.trim().toLowerCase() &&
        row.name.trim().toLowerCase() === args.name.trim().toLowerCase(),
    );
    const updatedAt = new Date().toISOString();
    const values = {
      campaignName: args.campaignName.trim(),
      name: args.name.trim(),
      subject: args.subject,
      previewText: args.previewText,
      body: args.body,
      mailingAddress: args.mailingAddress,
      updatedAt,
    };

    if (match) {
      await ctx.db.patch(match._id, values);
      return { id: match._id, updatedAt, replaced: true };
    }

    const id = await ctx.db.insert("templates", {
      moduleKey: args.moduleKey,
      ...values,
    });
    return { id, updatedAt, replaced: false };
  },
});

export const deleteForModule = mutation({
  args: {
    moduleKey: v.string(),
    campaignName: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("templates")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect();

    const match = existing.find(
      (row) =>
        row.campaignName.trim().toLowerCase() === args.campaignName.trim().toLowerCase() &&
        row.name.trim().toLowerCase() === args.name.trim().toLowerCase(),
    );
    if (!match) {
      return { deleted: false };
    }

    await ctx.db.delete(match._id);
    return { deleted: true };
  },
});
