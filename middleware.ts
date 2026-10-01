import { NextRequest, NextResponse } from "next/server";

// Operator workflows use the private project scripts. Keep historical panel
// implementation and operational records intact while retiring public reads.
export function middleware(request: NextRequest) {
  const panel = request.nextUrl.pathname === "/purple-prices-email" ||
    request.nextUrl.pathname === "/pep-customers";
  const ordersRead = request.nextUrl.pathname === "/api/pep-customers/orders" &&
    (request.method === "GET" || request.method === "HEAD");

  if (panel || ordersRead) {
    return NextResponse.json(
      { error: "This operator view has been retired." },
      { status: 410, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/purple-prices-email", "/pep-customers", "/api/pep-customers/orders"],
};
