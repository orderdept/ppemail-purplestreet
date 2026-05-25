import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  getConvexCampaignDraft,
  getConvexCampaigns,
  getConvexSuppressions,
  getConvexTemplatesForCampaign,
} from "./convex-server";
import { type CampaignDraft, type SavedTemplate } from "./purple-prices-types";

type CampaignResult = {
  batch?: number;
  email: string;
  error?: string;
  name?: string;
  recordedAt?: string;
  status: "sent" | "failed";
};

type CampaignJob = {
  completedAt?: string | null;
  createdAt?: string;
  currentBatch?: number;
  dailyLimit?: number;
  failed?: number;
  id: string;
  intervalMs?: number;
  nextRunAt?: string | null;
  previewText?: string;
  recentFailures?: CampaignResult[];
  recentLog?: string[];
  sent?: number;
  smtp?: {
    fromName?: string;
    username?: string;
  };
  status?: string;
  subject?: string;
  total?: number;
  totalBatches?: number;
};

type CampaignSummary = {
  latestCampaign: CampaignJob | null;
  campaignHistory: Array<
    Pick<
      CampaignJob,
      "id" | "status" | "subject" | "total" | "sent" | "failed" | "createdAt" | "completedAt"
    >
  >;
};

type DraftSnapshot = {
  completedAt: null;
  currentBatch: 0;
  dailyLimit: number;
  failed: number;
  id: string;
  intervalMs: number;
  nextRunAt: null;
  sent: number;
  status: string;
  subject: string;
  total: number;
  totalBatches: 0;
};

const moduleKey = "purple-prices-email";
const dataRoot = path.join(process.cwd(), "data", "purple-prices");

async function readJson<T>(filename: string): Promise<T> {
  const filePath = path.join(dataRoot, filename);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function sortNewest<T extends { completedAt?: string | null; createdAt?: string }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftDate = left.completedAt || left.createdAt || "";
    const rightDate = right.completedAt || right.createdAt || "";
    return rightDate.localeCompare(leftDate);
  });
}

function draftFromCampaign(campaign: CampaignJob | null): CampaignDraft {
  const intervalMs = campaign?.intervalMs || 334;
  const inferredPerSecond = Math.max(1, Math.min(5, Math.round(1000 / intervalMs)));

  return {
    campaignName: campaign?.subject || "",
    draftMessageName: "",
    messageSubject: "",
    messagePreviewText: "",
    messageBody: "",
    messageMailingAddress: "",
    csvContacts: [],
    typedContacts: [],
    pasteText: "",
    smtpHost: "smtp.qboxmail.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
    smtpUsername: campaign?.smtp?.username || "support@purpleprices.com",
    fromName: campaign?.smtp?.fromName || "Purple Prices",
    dailyLimit: campaign?.dailyLimit || 800,
    perSecond: inferredPerSecond,
    spacingMode: "rate",
  };
}

function summarizeDraft(draft: CampaignDraft, suppressions: string[]): DraftSnapshot {
  const seen = new Set<string>();
  const suppressedSet = new Set(suppressions);
  let ready = 0;
  let duplicates = 0;
  let suppressed = 0;

  for (const contact of [...draft.csvContacts, ...draft.typedContacts]) {
    if (suppressedSet.has(contact.email)) {
      suppressed += 1;
      continue;
    }
    if (seen.has(contact.email)) {
      duplicates += 1;
      continue;
    }
    seen.add(contact.email);
    ready += 1;
  }

  const intervalMs =
    draft.spacingMode === "daily"
      ? Math.ceil((24 * 60 * 60 * 1000) / Math.max(1, draft.dailyLimit || 1))
      : Math.ceil(1000 / Math.max(1, Math.min(5, draft.perSecond || 1)));

  const status = ready || duplicates || suppressed ? "Draft" : "New draft";

  return {
    completedAt: null,
    currentBatch: 0,
    dailyLimit: draft.dailyLimit,
    failed: 0,
    id: `draft-${moduleKey}`,
    intervalMs,
    nextRunAt: null,
    sent: 0,
    status,
    subject: draft.campaignName || "Untitled campaign",
    total: ready,
    totalBatches: 0,
  };
}

export async function getPurplePricesData() {
  const [fileSuppressions, fileTemplates, campaignSummary, liveSuppressions, liveDraft, liveCampaigns] = await Promise.all([
    readJson<string[]>("suppressions.json"),
    readJson<SavedTemplate[]>("templates.json"),
    readJson<CampaignSummary>("campaign-summary.json"),
    getConvexSuppressions(),
    getConvexCampaignDraft(),
    getConvexCampaigns(),
  ]);
  const suppressions =
    liveSuppressions && liveSuppressions.length > 0
      ? liveSuppressions.map((row) => row.email).sort((left, right) => left.localeCompare(right))
      : fileSuppressions;
  const fileHistory = campaignSummary.campaignHistory || [];
  const liveHistory = (liveCampaigns || [])
    .map((row) => ({
      id: String(row._id),
      status: row.status,
      subject: row.subject,
      total: row.totalRecipients,
      sent: row.sentCount,
      failed: row.failedCount,
      createdAt: row.updatedAt,
      completedAt: row.completedAt || null,
      previewText: "",
      recentLog: row.recentLog || [],
      recentFailures: row.recentFailures || [],
      smtp: {
        fromName: row.smtpFromName,
        username: row.smtpUsername,
      },
      dailyLimit: row.dailyLimit,
      intervalMs: row.intervalMs,
      currentBatch: row.currentBatch,
      totalBatches: row.totalBatches,
    }))
    .sort((left, right) => (right.completedAt || right.createdAt || "").localeCompare(left.completedAt || left.createdAt || ""));
  const latestCampaign = liveHistory[0] || campaignSummary.latestCampaign || null;
  const draft = liveDraft || draftFromCampaign(latestCampaign);
  const liveTemplates = await getConvexTemplatesForCampaign(draft.campaignName);
  const templates =
    liveTemplates && liveTemplates.length > 0
      ? liveTemplates
      : fileTemplates.filter((template) => !template.campaignName || template.campaignName === draft.campaignName);
  const latestTemplate = sortNewest(templates as Array<SavedTemplate & { createdAt?: string }>)[0] || null;
  const recentLog = [...(latestCampaign?.recentLog || [])].reverse();
  const recentFailures = [...(latestCampaign?.recentFailures || [])].reverse();
  const currentDraftCampaign = summarizeDraft(draft, suppressions);

  return {
    moduleKey,
    moduleName: "Purple Prices Email",
    businessName: "Purple Prices",
    hostname: "ppemail.purplestreet.com",
    senderEmail: latestCampaign?.smtp?.username || "support@purpleprices.com",
    senderName: latestCampaign?.smtp?.fromName || "Purple Prices",
    latestCampaign,
    currentDraftCampaign,
    latestTemplate,
    draft,
    suppressions,
    templates,
    campaigns: liveHistory.length ? liveHistory : fileHistory,
    recentLog,
    recentFailures,
    suppressionDownloads: {
      csv: "/exports/purple-prices/suppressed-addresses.csv",
      json: "/exports/purple-prices/suppressed-addresses.json",
    },
  };
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRate(intervalMs?: number) {
  if (!intervalMs || intervalMs <= 0) return "—";
  const perSecond = 1000 / intervalMs;
  return `${perSecond.toFixed(perSecond >= 2 ? 0 : 1)}/sec`;
}

export function compactNumber(value?: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}
