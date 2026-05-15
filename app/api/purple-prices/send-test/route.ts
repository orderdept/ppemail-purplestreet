import { NextResponse } from "next/server";

import { getPurplePricesData } from "../../../../lib/purple-prices-data";
import { sendHostedPurplePricesTestEmail } from "../../../../lib/purple-prices-mail";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await getPurplePricesData();
    const template = data.latestTemplate;

    if (!template) {
      return NextResponse.json(
        { error: "Save a message template first so PS has something to send." },
        { status: 400 },
      );
    }

    const result = await sendHostedPurplePricesTestEmail(data.draft, template.message);
    return NextResponse.json({
      ok: true,
      message: `Sent hosted test to ${result.name} <${result.to}> from ${result.from}.`,
      templateName: template.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hosted test send failed." },
      { status: 500 },
    );
  }
}
