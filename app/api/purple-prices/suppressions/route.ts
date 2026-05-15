import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { addConvexSuppression } from "../../../../lib/convex-server";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function normalizeEmail(value: unknown) {
  const text = typeof value === "string" ? value : "";
  const match = text.match(emailPattern);
  return match ? match[0].trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);

    if (!email) {
      return NextResponse.json({ error: "Enter a valid email address first." }, { status: 400 });
    }

    const result = await addConvexSuppression(email, "manual");
    revalidatePath("/");
    revalidatePath("/purple-prices-email");

    return NextResponse.json({
      ok: true,
      added: result?.added ?? true,
      email,
      count: result?.count,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add the suppression." },
      { status: 500 },
    );
  }
}
