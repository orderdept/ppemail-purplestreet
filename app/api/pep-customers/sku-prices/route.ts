import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  deleteConvexPepSkuPrice,
  getConvexPepSkuPrices,
  upsertConvexPepSkuPrice,
} from "../../../../lib/convex-server";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanSku(value: unknown) {
  return cleanText(value).toUpperCase();
}

function cleanMoney(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export async function GET() {
  try {
    const prices = await getConvexPepSkuPrices();
    return NextResponse.json({ ok: true, prices: prices ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load saved SKU pricing." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sku = cleanSku(body?.sku);
    const cost = cleanMoney(body?.cost);
    const price = cleanMoney(body?.price);

    if (!sku) {
      return NextResponse.json({ error: "Enter a SKU first." }, { status: 400 });
    }

    const result = await upsertConvexPepSkuPrice({ sku, cost, price });
    const prices = await getConvexPepSkuPrices();

    revalidatePath("/pep-customers");

    return NextResponse.json({
      ok: true,
      added: result?.added ?? 0,
      updated: result?.updated ?? 0,
      prices: prices ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save that SKU pricing." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const sku = cleanSku(new URL(request.url).searchParams.get("sku"));

    if (!sku) {
      return NextResponse.json({ error: "Choose a SKU to remove first." }, { status: 400 });
    }

    const result = await deleteConvexPepSkuPrice(sku);
    const prices = await getConvexPepSkuPrices();

    revalidatePath("/pep-customers");

    return NextResponse.json({
      ok: true,
      deleted: result?.deleted ?? 0,
      prices: prices ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove that SKU pricing." },
      { status: 500 },
    );
  }
}
