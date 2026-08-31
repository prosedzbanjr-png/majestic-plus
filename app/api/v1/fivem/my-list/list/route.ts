import { NextRequest } from "next/server";
import { machinePost } from "@/lib/fivem-control-plane/http";
import { listFiveMMyList } from "@/lib/fivem-control-plane/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return machinePost(request, "fivem-my-list-list", (body) => listFiveMMyList(body));
}
