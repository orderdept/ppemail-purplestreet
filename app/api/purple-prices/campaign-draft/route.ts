import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { upsertConvexCampaignDraft } from "../../../../lib/convex-server";
import { type CampaignDraft } from "../../../../lib/purple-prices-types";

function sanitizeContacts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!email) return null;
      return { email, name };
    })
    .filter((row): row is { email: string; name: string } => Boolean(row));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CampaignDraft>;
    const draft: CampaignDraft = {
      campaignName: typeof body.campaignName === "string" ? body.campaignName.trim() : "",
      csvContacts: sanitizeContacts(body.csvContacts),
      typedContacts: sanitizeContacts(body.typedContacts),
      pasteText: typeof body.pasteText === "string" ? body.pasteText : "",
      smtpHost: typeof body.smtpHost === "string" ? body.smtpHost.trim() : "smtp.qboxmail.com",
      smtpPort:
        typeof body.smtpPort === "number" && Number.isFinite(body.smtpPort) && body.smtpPort > 0
          ? Math.round(body.smtpPort)
          : 465,
      smtpSecurity: body.smtpSecurity === "starttls" ? "starttls" : "ssl",
      smtpUsername:
        typeof body.smtpUsername === "string" ? body.smtpUsername.trim().toLowerCase() : "support@purpleprices.com",
      fromName: typeof body.fromName === "string" ? body.fromName.trim() : "Purple Prices",
      dailyLimit:
        typeof body.dailyLimit === "number" && Number.isFinite(body.dailyLimit) && body.dailyLimit > 0
          ? Math.round(body.dailyLimit)
          : 800,
      perSecond:
        typeof body.perSecond === "number" && Number.isFinite(body.perSecond) && body.perSecond > 0
          ? Math.min(5, Math.round(body.perSecond))
          : 3,
      spacingMode: body.spacingMode === "daily" ? "daily" : "rate",
      updatedAt: new Date().toISOString(),
    };

    const saved = await upsertConvexCampaignDraft(draft);
    revalidatePath("/");
    revalidatePath("/purple-prices-email");

    return NextResponse.json({
      ok: true,
      updatedAt: saved?.updatedAt || draft.updatedAt,
      contactCount: draft.csvContacts.length + draft.typedContacts.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the campaign setup." },
      { status: 500 },
    );
  }
}
