import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getConvexPepCustomerOrders,
  markConvexPepCustomerOrdersProcessed,
} from "../../../../lib/convex-server";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderIds: string[] = Array.isArray(body?.orderIds)
      ? Array.from(new Set(body.orderIds.map(cleanText).filter(Boolean)))
      : [];
    const trackingNumber = cleanText(body?.trackingNumber);

    if (!orderIds.length) {
      return NextResponse.json({ error: "Choose an order to process first." }, { status: 400 });
    }

    if (!trackingNumber) {
      return NextResponse.json({ error: "Enter a tracking number first." }, { status: 400 });
    }

    const result = await markConvexPepCustomerOrdersProcessed(orderIds, trackingNumber);
    const orders = await getConvexPepCustomerOrders();

    revalidatePath("/pep-customers");

    return NextResponse.json({
      ok: true,
      updated: result?.updated ?? 0,
      orders: orders ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not process that order." },
      { status: 500 },
    );
  }
}
