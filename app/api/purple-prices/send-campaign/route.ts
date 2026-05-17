import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { recordConvexCampaign } from "../../../../lib/convex-server";
import { getPurplePricesData } from "../../../../lib/purple-prices-data";
import { sendHostedPurplePricesCampaign } from "../../../../lib/purple-prices-mail";

export const runtime = "nodejs";

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

export async function POST() {
  try {
    const data = await getPurplePricesData();
    const draft = data.draft;

    if (!draft.messageSubject || !draft.messageBody || !draft.draftMessageName) {
      return NextResponse.json(
        { error: "Save a campaign message before starting a live campaign." },
        { status: 400 },
      );
    }

    const suppressions = new Set(data.suppressions.map(normalizeEmail));
    const seen = new Set<string>();
    const recipients = [];
    let duplicateCount = 0;
    let suppressedCount = 0;

    for (const contact of [...draft.csvContacts, ...draft.typedContacts]) {
      const email = normalizeEmail(contact.email);
      if (!email) continue;
      if (suppressions.has(email)) {
        suppressedCount += 1;
        continue;
      }
      if (seen.has(email)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(email);
      recipients.push({ email, name: contact.name || "Purple Peeps" });
    }

    if (!recipients.length) {
      return NextResponse.json(
        { error: "There are no ready recipients in this campaign yet." },
        { status: 400 },
      );
    }

    const startedAt = new Date().toISOString();
    const result = await sendHostedPurplePricesCampaign(draft, {
      subject: draft.messageSubject,
      previewText: draft.messagePreviewText,
      body: draft.messageBody,
      mailingAddress: draft.messageMailingAddress,
    }, recipients);

    const sentCount = result.results.filter((row) => row.status === "sent").length;
    const failedRows = result.results.filter((row) => row.status === "failed");
    const completedAt = new Date().toISOString();

    await recordConvexCampaign({
      status: failedRows.length ? (sentCount ? "complete" : "failed") : "complete",
      subject: draft.campaignName || draft.messageSubject,
      totalRecipients: recipients.length,
      sentCount,
      failedCount: failedRows.length,
      suppressedCount,
      duplicateCount,
      dailyLimit: draft.dailyLimit,
      intervalMs: result.intervalMs,
      currentBatch: 1,
      totalBatches: 1,
      completedAt,
      recentLog: [
        `${startedAt} Started campaign with ${recipients.length} recipients.`,
        ...result.results.slice(-11).map((row) =>
          row.status === "sent"
            ? `${row.recordedAt} Sent message to ${row.email}.`
            : `${row.recordedAt} Failed delivery to ${row.email}: ${row.error || "Delivery failed."}`,
        ),
      ],
      recentFailures: failedRows.map((row) => ({
        email: row.email,
        error: row.error,
        name: row.name,
        recordedAt: row.recordedAt,
        status: "failed" as const,
      })),
      smtpFromName: draft.fromName,
      smtpUsername: draft.smtpUsername,
    });

    revalidatePath("/");
    revalidatePath("/purple-prices-email");

    return NextResponse.json({
      ok: true,
      message: `Started and finished the live campaign for ${recipients.length} ready recipients. ${sentCount} sent, ${failedRows.length} failed.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start the live campaign." },
      { status: 500 },
    );
  }
}
