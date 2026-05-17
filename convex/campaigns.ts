import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByModule = query({
  args: { moduleKey: v.string() },
  handler: async (ctx, { moduleKey }) => {
    return await ctx.db
      .query("campaigns")
      .withIndex("by_module", (q) => q.eq("moduleKey", moduleKey))
      .collect();
  },
});

export const recordCampaign = mutation({
  args: {
    moduleKey: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("queued"),
      v.literal("running"),
      v.literal("scheduled"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    subject: v.string(),
    totalRecipients: v.number(),
    sentCount: v.number(),
    failedCount: v.number(),
    suppressedCount: v.number(),
    duplicateCount: v.number(),
    dailyLimit: v.number(),
    intervalMs: v.number(),
    currentBatch: v.number(),
    totalBatches: v.number(),
    nextRunAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    recentLog: v.optional(v.array(v.string())),
    recentFailures: v.optional(
      v.array(
        v.object({
          email: v.string(),
          error: v.optional(v.string()),
          name: v.optional(v.string()),
          recordedAt: v.optional(v.string()),
          status: v.union(v.literal("sent"), v.literal("failed")),
        }),
      ),
    ),
    smtpFromName: v.optional(v.string()),
    smtpUsername: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("campaigns", args);
  },
});
