import { NextResponse } from "next/server";

import { getPurplePricesData } from "../../../../../lib/purple-prices-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPurplePricesData();
  return NextResponse.json(
    data.suppressions.map((email) => ({ email })),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="purple-prices-suppressions.json"',
      },
    },
  );
}
