import { NextResponse } from "next/server";

import { getPurplePricesData } from "../../../../lib/purple-prices-data";
import { hostedSmtpLoginTest } from "../../../../lib/purple-prices-mail";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await getPurplePricesData();
    const result = await hostedSmtpLoginTest(data.draft);
    return NextResponse.json({
      ok: true,
      message: `Hosted SMTP login works for ${result.username} on ${result.host}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hosted SMTP login failed." },
      { status: 500 },
    );
  }
}
