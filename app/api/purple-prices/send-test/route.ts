import { NextResponse } from "next/server";

import { getPurplePricesData } from "../../../../lib/purple-prices-data";
import { sendHostedPurplePricesTestEmail } from "../../../../lib/purple-prices-mail";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await getPurplePricesData();
    if (!data.draft.messageSubject || !data.draft.messageBody) {
      return NextResponse.json(
        { error: "Save or load a campaign message first so PS has something to send." },
        { status: 400 },
      );
    }

    const result = await sendHostedPurplePricesTestEmail(data.draft, {
      subject: data.draft.messageSubject,
      previewText: data.draft.messagePreviewText,
      body: data.draft.messageBody,
      mailingAddress: data.draft.messageMailingAddress,
    });
    return NextResponse.json({
      ok: true,
      message: `Sent hosted test to ${result.name} <${result.to}> from ${result.from}.`,
      templateName: data.draft.draftMessageName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hosted test send failed." },
      { status: 500 },
    );
  }
}
