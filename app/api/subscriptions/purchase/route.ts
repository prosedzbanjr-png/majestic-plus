import { NextResponse } from "next/server";
import { getCurrentViewer } from "@/lib/user-auth";
import { purchaseSubscription } from "@/lib/billing";

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Zaloguj się, aby kupić subskrypcję." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const planCode = String(body.plan_code ?? "").trim().toLowerCase();
    if (!planCode) {
      return NextResponse.json({ error: "Wybierz plan subskrypcji." }, { status: 400 });
    }

    const result = await purchaseSubscription(viewer.id, planCode);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się aktywować subskrypcji." },
      { status: 400 },
    );
  }
}
