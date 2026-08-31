import { NextRequest } from "next/server";
import { getCurrentViewer, viewerUsername } from "@/lib/user-auth";
import {
  allowControlRequest,
  assertSameOrigin,
  controlError,
  controlResponse,
  correlationId,
  parseBoundedJson,
} from "@/lib/fivem-control-plane/http";
import { ControlPlaneError } from "@/lib/fivem-control-plane/contract";
import { createViewerPairingChallenge } from "@/lib/fivem-control-plane/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = correlationId(request);
  try {
    assertSameOrigin(request);
    const viewer = await getCurrentViewer();
    if (!viewer) throw new ControlPlaneError("UNAUTHORIZED", "Sign in first.", 401);
    if (!allowControlRequest(request, "viewer-link-challenge", 8, 60_000, viewer.id)) {
      throw new ControlPlaneError("RATE_LIMITED", "Too many pairing requests.", 429, true);
    }
    const body = await parseBoundedJson(request);
    const result = await createViewerPairingChallenge(viewer.id, viewerUsername(viewer), body.phone);
    return controlResponse(result, requestId);
  } catch (error) {
    return controlError(error, requestId);
  }
}
