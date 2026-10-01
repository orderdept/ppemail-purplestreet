import { NextResponse } from "next/server";
function retired() {
  return NextResponse.json({ error: "This unused operator control has been retired." },
    { status: 410, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
export const GET = retired;
export const HEAD = retired;
export const POST = retired;
export const PATCH = retired;
export const DELETE = retired;
