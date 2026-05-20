import { NextResponse } from "next/server";

import { getPurplePricesData } from "../../../../lib/purple-prices-data";
import { hostedSmtpLoginTest } from "../../../../lib/purple-prices-mail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      password?: unknown;
      username?: unknown;
    };
    const data = await getPurplePricesData();
    const result = await hostedSmtpLoginTest(data.draft, {
      password: typeof payload?.password === "string" ? payload.password : "",
      username: typeof payload?.username === "string" ? payload.username : "",
    });
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
