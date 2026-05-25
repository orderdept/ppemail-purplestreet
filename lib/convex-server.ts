import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api";
import { type CampaignDraft, type CampaignMessage, type SavedTemplate } from "./purple-prices-types";

export const moduleKey = "purple-prices-email";
export const pepCustomersModuleKey = "pep-customers";

export type SuppressionSource = "manual" | "bounce" | "unsubscribe" | "import";

export function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return null;
  }
  return new ConvexHttpClient(url);
}

export async function getConvexSuppressions() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = await client.query(api.suppressions.listByModule, { moduleKey });
  return rows.map((row) => ({
    email: row.email,
    source: row.source,
    note: row.note,
    createdAt: row.createdAt,
  }));
}

export async function replaceConvexSuppressions(
  items: Array<{ email: string; source: SuppressionSource; note?: string }>,
) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.suppressions.replaceForModule, {
    moduleKey,
    items,
  });
}

export async function addConvexSuppression(
  email: string,
  source: SuppressionSource = "manual",
  note?: string,
) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.suppressions.addForModule, {
    moduleKey,
    email,
    source,
    note,
  });
}

export async function getConvexTemplates() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = await client.query(api.templates.listByModule, { moduleKey });
  return rows.map<SavedTemplate>((row) => ({
    id: String(row._id),
    campaignName: row.campaignName || "",
    name: row.name,
    updatedAt: row.updatedAt,
    message: {
      subject: row.subject,
      previewText: row.previewText,
      body: row.body,
      mailingAddress: row.mailingAddress,
    },
  }));
}

export async function getConvexTemplatesForCampaign(campaignName: string) {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = await client.query(api.templates.listByModule, { moduleKey, campaignName });
  return rows.map<SavedTemplate>((row) => ({
    id: String(row._id),
    campaignName: row.campaignName || "",
    name: row.name,
    updatedAt: row.updatedAt,
    message: {
      subject: row.subject,
      previewText: row.previewText,
      body: row.body,
      mailingAddress: row.mailingAddress,
    },
  }));
}

export async function getConvexCampaignDraft() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const row = await client.query(api.campaignDrafts.getByModule, { moduleKey });
  if (!row) {
    return null;
  }
  return {
    campaignName: row.campaignName || "",
    draftMessageName: row.draftMessageName || "",
    messageSubject: row.messageSubject || "",
    messagePreviewText: row.messagePreviewText || "",
    messageBody: row.messageBody || "",
    messageMailingAddress: row.messageMailingAddress || "",
    csvContacts: row.csvContacts,
    typedContacts: row.typedContacts,
    pasteText: row.pasteText,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecurity: row.smtpSecurity,
    smtpUsername: row.smtpUsername,
    fromName: row.fromName,
    dailyLimit: row.dailyLimit,
    perSecond: row.perSecond,
    spacingMode: row.spacingMode,
    updatedAt: row.updatedAt,
  } satisfies CampaignDraft;
}

export async function upsertConvexTemplate(campaignName: string, name: string, message: CampaignMessage) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.templates.upsertForModule, {
    moduleKey,
    campaignName,
    name,
    ...message,
  });
}

export async function deleteConvexTemplate(campaignName: string, name: string) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.templates.deleteForModule, {
    moduleKey,
    campaignName,
    name,
  });
}

export async function getConvexCampaigns() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  return await client.query(api.campaigns.listByModule, { moduleKey });
}

export async function recordConvexCampaign(input: {
  status: "draft" | "queued" | "running" | "scheduled" | "complete" | "failed";
  subject: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  duplicateCount: number;
  dailyLimit: number;
  intervalMs: number;
  currentBatch: number;
  totalBatches: number;
  nextRunAt?: string;
  completedAt?: string;
  recentLog?: string[];
  recentFailures?: Array<{
    email: string;
    error?: string;
    name?: string;
    recordedAt?: string;
    status: "sent" | "failed";
  }>;
  smtpFromName?: string;
  smtpUsername?: string;
}) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.campaigns.recordCampaign, {
    moduleKey,
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export type PepCustomerOrder = {
  id: string;
  orderId: string;
  orderGroup: string;
  orderDate: string;
  sku: string;
  productName: string;
  dose: string;
  brand: string;
  qty: number;
  cost: number;
  price: number;
  profit: number;
  customerName: string;
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  email: string;
  customerId: string;
  trackingNumber: string;
  processedAt: string;
};

type ConvexPepCustomerOrder = Omit<PepCustomerOrder, "id"> & {
  _id: unknown;
};

function toPepCustomerOrder(row: ConvexPepCustomerOrder): PepCustomerOrder {
  return {
    id: row.orderId,
    orderId: row.orderId,
    orderGroup: row.orderGroup,
    orderDate: row.orderDate,
    sku: row.sku,
    productName: row.productName,
    dose: row.dose || "",
    brand: row.brand,
    qty: row.qty,
    cost: row.cost,
    price: row.price,
    profit: row.profit,
    customerName: row.customerName,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    address: row.address,
    address2: row.address2,
    city: row.city,
    state: row.state,
    zipcode: row.zipcode,
    country: row.country,
    email: row.email,
    customerId: row.customerId,
    trackingNumber: row.trackingNumber || "",
    processedAt: row.processedAt || "",
  };
}

export async function getConvexPepCustomerOrders() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = (await client.query(api.pepCustomers.listOrders, {
    moduleKey: pepCustomersModuleKey,
  })) as ConvexPepCustomerOrder[];
  return rows.map(toPepCustomerOrder);
}

export async function upsertConvexPepCustomerOrders(orders: PepCustomerOrder[], sourceFile?: string) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  const payload = orders.map(({ id: _id, trackingNumber: _trackingNumber, processedAt: _processedAt, ...order }) => order);
  return await client.mutation(api.pepCustomers.upsertOrders, {
    moduleKey: pepCustomersModuleKey,
    sourceFile,
    orders: payload,
  });
}

export async function markConvexPepCustomerOrdersProcessed(orderIds: string[], trackingNumber: string) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.pepCustomers.markProcessed, {
    moduleKey: pepCustomersModuleKey,
    orderIds,
    trackingNumber,
  });
}

export async function upsertConvexCampaignDraft(draft: CampaignDraft) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.campaignDrafts.upsertForModule, {
    moduleKey,
    campaignName: draft.campaignName,
    draftMessageName: draft.draftMessageName,
    messageSubject: draft.messageSubject,
    messagePreviewText: draft.messagePreviewText,
    messageBody: draft.messageBody,
    messageMailingAddress: draft.messageMailingAddress,
    csvContacts: draft.csvContacts,
    typedContacts: draft.typedContacts,
    pasteText: draft.pasteText,
    smtpHost: draft.smtpHost,
    smtpPort: draft.smtpPort,
    smtpSecurity: draft.smtpSecurity,
    smtpUsername: draft.smtpUsername,
    fromName: draft.fromName,
    dailyLimit: draft.dailyLimit,
    perSecond: draft.perSecond,
    spacingMode: draft.spacingMode,
    updatedAt: draft.updatedAt || new Date().toISOString(),
  });
}
