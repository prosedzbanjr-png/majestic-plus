import { NextRequest } from "next/server";
import { getCurrentViewer } from "@/lib/user-auth";
import {
  allowControlRequest,
  assertSameOrigin,
  controlError,
  controlResponse,
  correlationId,
} from "@/lib/fivem-control-plane/http";
import { ControlPlaneError } from "@/lib/fivem-control-plane/contract";
import { unlinkViewerFromFiveM } from "@/lib/fivem-control-plane/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = correlationId(request);
  try {
    assertSameOrigin(request);
    const viewer = await getCurrentViewer();
    if (!viewer) throw new ControlPlaneError("UNAUTHORIZED", "Sign in first.", 401);
    if (!allowControlRequest(request, "viewer-link-unlink", 10, 60_000, viewer.id)) {
      throw new ControlPlaneError("RATE_LIMITED", "Too many requests.", 429, true);
    }
    return controlResponse(await unlinkViewerFromFiveM(viewer.id), requestId);
  } catch (error) {
    return controlError(error, requestId);
  }
}
