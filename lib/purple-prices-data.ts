import { readFile } from "node:fs/promises";
import path from "node:path";

import { getConvexSuppressions } from "./convex-server";

type CampaignResult = {
  batch?: number;
  email: string;
  error?: string;
  name?: string;
  recordedAt?: string;
  status: "sent" | "failed";
};

type CampaignMessage = {
  body: string;
  mailingAddress: string;
  previewText: string;
  subject: string;
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

type SavedTemplate = {
  id: string;
  name: string;
  updatedAt: string;
  message: CampaignMessage;
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

export async function getPurplePricesData() {
  const [fileSuppressions, templates, campaignSummary, liveSuppressions] = await Promise.all([
    readJson<string[]>("suppressions.json"),
    readJson<SavedTemplate[]>("templates.json"),
    readJson<CampaignSummary>("campaign-summary.json"),
    getConvexSuppressions(),
  ]);
  const suppressions =
    liveSuppressions && liveSuppressions.length > 0
      ? liveSuppressions.map((row) => row.email).sort((left, right) => left.localeCompare(right))
      : fileSuppressions;
  const latestCampaign = campaignSummary.latestCampaign || null;
  const latestTemplate = sortNewest(templates as Array<SavedTemplate & { createdAt?: string }>)[0] || null;
  const recentLog = [...(latestCampaign?.recentLog || [])].reverse();
  const recentFailures = [...(latestCampaign?.recentFailures || [])].reverse();

  return {
    moduleKey,
    moduleName: "Purple Prices Email",
    businessName: "Purple Prices",
    hostname: "ppemail.purplestreet.com",
    senderEmail: latestCampaign?.smtp?.username || "support@purpleprices.com",
    senderName: latestCampaign?.smtp?.fromName || "Purple Prices",
    latestCampaign,
    latestTemplate,
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
