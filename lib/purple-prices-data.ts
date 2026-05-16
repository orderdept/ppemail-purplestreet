import { readFile } from "node:fs/promises";
import path from "node:path";

import { getConvexCampaignDraft, getConvexSuppressions, getConvexTemplates } from "./convex-server";
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

export async function getPurplePricesData() {
  const [fileSuppressions, fileTemplates, campaignSummary, liveSuppressions, liveTemplates, liveDraft] = await Promise.all([
    readJson<string[]>("suppressions.json"),
    readJson<SavedTemplate[]>("templates.json"),
    readJson<CampaignSummary>("campaign-summary.json"),
    getConvexSuppressions(),
    getConvexTemplates(),
    getConvexCampaignDraft(),
  ]);
  const suppressions =
    liveSuppressions && liveSuppressions.length > 0
      ? liveSuppressions.map((row) => row.email).sort((left, right) => left.localeCompare(right))
      : fileSuppressions;
  const templates = liveTemplates && liveTemplates.length > 0 ? liveTemplates : fileTemplates;
  const latestCampaign = campaignSummary.latestCampaign || null;
  const latestTemplate = sortNewest(templates as Array<SavedTemplate & { createdAt?: string }>)[0] || null;
  const recentLog = [...(latestCampaign?.recentLog || [])].reverse();
  const recentFailures = [...(latestCampaign?.recentFailures || [])].reverse();
  const draft = liveDraft || draftFromCampaign(latestCampaign);

  return {
    moduleKey,
    moduleName: "Purple Prices Email",
    businessName: "Purple Prices",
    hostname: "ppemail.purplestreet.com",
    senderEmail: latestCampaign?.smtp?.username || "support@purpleprices.com",
    senderName: latestCampaign?.smtp?.fromName || "Purple Prices",
    latestCampaign,
    latestTemplate,
    draft,
    suppressions,
    templates,
    campaigns: campaignSummary.campaignHistory || [],
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
    dateStyle: "medium",
    timeStyle: "short",
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
