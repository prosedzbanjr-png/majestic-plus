import { NextRequest } from "next/server";
import { machinePost } from "@/lib/fivem-control-plane/http";
import { commitFiveMPurchase } from "@/lib/fivem-control-plane/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return machinePost(request, "fivem-purchase-commit", (body) => commitFiveMPurchase(body));
}
