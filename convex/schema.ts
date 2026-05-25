import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  campaignDrafts: defineTable({
    moduleKey: v.string(),
    campaignName: v.optional(v.string()),
    draftMessageName: v.optional(v.string()),
    messageSubject: v.optional(v.string()),
    messagePreviewText: v.optional(v.string()),
    messageBody: v.optional(v.string()),
    messageMailingAddress: v.optional(v.string()),
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
  }).index("by_module", ["moduleKey"]),

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
    campaignName: v.optional(v.string()),
    name: v.string(),
    subject: v.string(),
    previewText: v.string(),
    body: v.string(),
    mailingAddress: v.string(),
    updatedAt: v.string(),
  })
    .index("by_module", ["moduleKey"])
    .index("by_module_campaign", ["moduleKey", "campaignName"]),

  modules: defineTable({
    key: v.string(),
    name: v.string(),
    status: v.union(v.literal("planned"), v.literal("active"), v.literal("paused")),
    hostname: v.string(),
    businessName: v.string(),
    businessEmail: v.string(),
    updatedAt: v.string(),
  }).index("by_key", ["key"]),

  pepCustomerOrders: defineTable({
    moduleKey: v.string(),
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
    trackingNumber: v.optional(v.string()),
    processedAt: v.optional(v.string()),
    sourceFile: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_module", ["moduleKey"])
    .index("by_module_order", ["moduleKey", "orderId"]),
});
