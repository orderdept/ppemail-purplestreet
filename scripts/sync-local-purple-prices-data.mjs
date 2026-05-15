import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot =
  "/Volumes/MyM4 Ext Drive/Documents/Programs/Purple Peps/data";
const targetDataRoot = path.join(
  process.cwd(),
  "data",
  "purple-prices",
);
const targetExportRoot = path.join(
  process.cwd(),
  "public",
  "exports",
  "purple-prices",
);

const copies = [
  ["suppressions.json", path.join(targetDataRoot, "suppressions.json")],
  ["templates.json", path.join(targetDataRoot, "templates.json")],
  [
    "suppressed_addresses.csv",
    path.join(targetExportRoot, "suppressed-addresses.csv"),
  ],
  [
    "suppressed_addresses.json",
    path.join(targetExportRoot, "suppressed-addresses.json"),
  ],
];

await mkdir(targetDataRoot, { recursive: true });
await mkdir(targetExportRoot, { recursive: true });

for (const [filename, targetPath] of copies) {
  await cp(path.join(sourceRoot, filename), targetPath, { force: true });
  console.log(`Synced ${filename}`);
}

const rawJobs = JSON.parse(await readFile(path.join(sourceRoot, "jobs.json"), "utf8"));
const campaigns = rawJobs
  .filter((job) => job.id !== "testjob" && (job.message?.subject || job.sent || job.failed))
  .sort((left, right) => {
    const leftDate = left.completedAt || left.createdAt || "";
    const rightDate = right.completedAt || right.createdAt || "";
    return rightDate.localeCompare(leftDate);
  });
const latest = campaigns[0] || null;
const campaignSummary = {
  latestCampaign: latest
    ? {
        id: latest.id,
        status: latest.status,
        subject: latest.message?.subject || "",
        previewText: latest.message?.previewText || "",
        dailyLimit: latest.dailyLimit,
        intervalMs: latest.intervalMs,
        currentBatch: latest.currentBatch,
        totalBatches: latest.totalBatches,
        total: latest.total,
        sent: latest.sent,
        failed: latest.failed,
        remaining: Math.max(0, (latest.total || 0) - (latest.sent || 0) - (latest.failed || 0)),
        createdAt: latest.createdAt,
        completedAt: latest.completedAt,
        nextRunAt: latest.nextRunAt,
        smtp: {
          fromName: latest.smtp?.fromName,
          username: latest.smtp?.username,
        },
        recentLog: (latest.log || []).slice(-12),
        recentFailures: (latest.recipientResults || [])
          .filter((item) => item.status === "failed")
          .slice(-12)
          .map((item) => ({
            batch: item.batch,
            email: item.email,
            error: item.error,
            name: item.name,
            recordedAt: item.recordedAt,
            status: item.status,
          })),
      }
    : null,
  campaignHistory: campaigns.slice(0, 6).map((job) => ({
    id: job.id,
    status: job.status,
    subject: job.message?.subject || "",
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  })),
};
await writeFile(
  path.join(targetDataRoot, "campaign-summary.json"),
  `${JSON.stringify(campaignSummary, null, 2)}\n`,
  "utf8",
);
console.log("Synced campaign-summary.json");
