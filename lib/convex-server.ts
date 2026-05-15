import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api";
import { type CampaignMessage, type SavedTemplate } from "./purple-prices-types";

export const moduleKey = "purple-prices-email";

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

export async function getConvexTemplates() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = await client.query(api.templates.listByModule, { moduleKey });
  return rows.map<SavedTemplate>((row) => ({
    id: String(row._id),
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

export async function upsertConvexTemplate(name: string, message: CampaignMessage) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.templates.upsertForModule, {
    moduleKey,
    name,
    ...message,
  });
}

export async function deleteConvexTemplate(name: string) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.templates.deleteForModule, {
    moduleKey,
    name,
  });
}
