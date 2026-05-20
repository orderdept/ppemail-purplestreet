import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  type PepCustomerOrder,
  getConvexPepCustomerOrders,
  upsertConvexPepCustomerOrders,
} from "../../../../lib/convex-server";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanMoney(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function cleanOrder(value: unknown): PepCustomerOrder | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!row) return null;

  const orderId = cleanText(row.orderId);
  const customerName = cleanText(row.customerName);
  if (!orderId || !customerName) return null;

  const cost = cleanMoney(row.cost);
  const price = cleanMoney(row.price);

  return {
    id: orderId,
    orderId,
    orderGroup: cleanText(row.orderGroup) || orderId.match(/^(\d{5})/)?.[1] || orderId.slice(0, 5),
    orderDate: cleanText(row.orderDate),
    sku: cleanText(row.sku),
    productName: cleanText(row.productName),
    brand: cleanText(row.brand),
    qty: cleanMoney(row.qty),
    cost,
    price,
    profit: price - cost,
    customerName,
    firstName: cleanText(row.firstName),
    lastName: cleanText(row.lastName),
    company: cleanText(row.company),
    address: cleanText(row.address),
    address2: cleanText(row.address2),
    city: cleanText(row.city),
    state: cleanText(row.state),
    zipcode: cleanText(row.zipcode),
    country: cleanText(row.country),
    email: cleanText(row.email).toLowerCase(),
    customerId: cleanText(row.customerId),
  };
}

export async function GET() {
  try {
    const orders = await getConvexPepCustomerOrders();
    return NextResponse.json({ ok: true, orders: orders ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Pep Customers orders." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: unknown[] = Array.isArray(body?.orders) ? body.orders : [];
    const orders = rows.map(cleanOrder).filter((order): order is PepCustomerOrder => Boolean(order));

    if (!orders.length) {
      return NextResponse.json({ error: "No valid order rows were found." }, { status: 400 });
    }

    const result = await upsertConvexPepCustomerOrders(orders, cleanText(body?.sourceFile) || undefined);
    const savedOrders = await getConvexPepCustomerOrders();

    revalidatePath("/pep-customers");

    return NextResponse.json({
      ok: true,
      added: result?.added ?? 0,
      updated: result?.updated ?? 0,
      orders: savedOrders ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save Pep Customers orders." },
      { status: 500 },
    );
  }
}
