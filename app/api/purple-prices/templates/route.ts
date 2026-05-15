import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { deleteConvexTemplate, upsertConvexTemplate } from "../../../../lib/convex-server";
import { type CampaignMessage } from "../../../../lib/purple-prices-types";

function parseMessage(value: unknown): CampaignMessage {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    subject: String(record.subject || "").trim(),
    previewText: String(record.previewText || "").trim(),
    body: String(record.body || ""),
    mailingAddress: String(record.mailingAddress || "").trim(),
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      message?: CampaignMessage;
    };
    const name = String(payload.name || "").trim();
    const message = parseMessage(payload.message);

    if (!name) {
      return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    }
    if (!message.subject || !message.body) {
      return NextResponse.json(
        { error: "Subject and message body are required." },
        { status: 400 },
      );
    }

    const result = await upsertConvexTemplate(name, message);
    revalidatePath("/");
    revalidatePath("/purple-prices-email");
    return NextResponse.json({
      ok: true,
      replaced: result.replaced,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save template." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = String(searchParams.get("name") || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    }

    const result = await deleteConvexTemplate(name);
    revalidatePath("/");
    revalidatePath("/purple-prices-email");
    return NextResponse.json({ ok: true, deleted: result.deleted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete template." },
      { status: 500 },
    );
  }
}
