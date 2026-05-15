import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  campaigns: defineTable({
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
    updatedAt: v.string(),
  }).index("by_module", ["moduleKey"]),

  suppressions: defineTable({
    moduleKey: v.string(),
    email: v.string(),
    source: v.union(
      v.literal("manual"),
      v.literal("bounce"),
      v.literal("unsubscribe"),
      v.literal("import"),
    ),
    note: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_module", ["moduleKey"])
    .index("by_email", ["email"]),

  templates: defineTable({
    moduleKey: v.string(),
    name: v.string(),
    subject: v.string(),
    previewText: v.string(),
    body: v.string(),
    mailingAddress: v.string(),
    updatedAt: v.string(),
  }).index("by_module", ["moduleKey"]),

  modules: defineTable({
    key: v.string(),
    name: v.string(),
    status: v.union(v.literal("planned"), v.literal("active"), v.literal("paused")),
    hostname: v.string(),
    businessName: v.string(),
    businessEmail: v.string(),
    updatedAt: v.string(),
  }).index("by_key", ["key"]),
});
