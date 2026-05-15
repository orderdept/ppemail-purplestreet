import { NextResponse } from "next/server";

import { getPurplePricesData } from "../../../../../lib/purple-prices-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPurplePricesData();
  const csv = ["email", ...data.suppressions].join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="purple-prices-suppressions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
