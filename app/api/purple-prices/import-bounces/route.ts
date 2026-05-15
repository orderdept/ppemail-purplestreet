import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runPurplePricesBounceImport } from "../../../../lib/purple-prices-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const result = await runPurplePricesBounceImport(
      typeof payload?.campaignSubject === "string" ? payload.campaignSubject : "",
    );
    revalidatePath("/");
    revalidatePath("/purple-prices-email");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not import bounce notices.",
      },
      { status: 500 },
    );
  }
}
