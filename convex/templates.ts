import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByModule = query({
  args: {
    moduleKey: v.string(),
    campaignName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.campaignName) {
      return await ctx.db
        .query("templates")
        .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
        .collect();
    }
    const campaignName = args.campaignName.trim();
    return await ctx.db
      .query("templates")
      .withIndex("by_module_campaign", (q) =>
        q.eq("moduleKey", args.moduleKey).eq("campaignName", campaignName),
      )
      .collect();
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
    const campaignName = args.campaignName.trim().toLowerCase();
    const templateName = args.name.trim().toLowerCase();

    const match = existing.find(
      (row) =>
        (row.campaignName || "").trim().toLowerCase() === campaignName &&
        row.name.trim().toLowerCase() === templateName,
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
    const campaignName = args.campaignName.trim().toLowerCase();
    const templateName = args.name.trim().toLowerCase();

    const match = existing.find(
      (row) =>
        (row.campaignName || "").trim().toLowerCase() === campaignName &&
        row.name.trim().toLowerCase() === templateName,
    );
    if (!match) {
      return { deleted: false };
    }

    await ctx.db.delete(match._id);
    return { deleted: true };
  },
});
