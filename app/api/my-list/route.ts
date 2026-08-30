import { NextResponse } from "next/server";
import { getCurrentViewer } from "@/lib/user-auth";
import { addToMyList, isOnMyList, removeFromMyList } from "@/lib/viewer-data";

export async function GET(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) return NextResponse.json({ error: "Zaloguj się, aby korzystać z listy." }, { status: 401 });

  const url = new URL(request.url);
  const productionId = url.searchParams.get("productionId")?.trim();
  if (!productionId) return NextResponse.json({ error: "Brak produkcji." }, { status: 400 });

  try {
    const saved = await isOnMyList(viewer.id, productionId);
    return NextResponse.json({ saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się pobrać listy." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) return NextResponse.json({ error: "Zaloguj się, aby korzystać z listy." }, { status: 401 });

  try {
    const body = await request.json();
    const productionId = String(body.productionId ?? "").trim();
    if (!productionId) return NextResponse.json({ error: "Brak produkcji." }, { status: 400 });
    await addToMyList(viewer.id, productionId);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się dodać do listy." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) return NextResponse.json({ error: "Zaloguj się, aby korzystać z listy." }, { status: 401 });

  try {
    const body = await request.json();
    const productionId = String(body.productionId ?? "").trim();
    if (!productionId) return NextResponse.json({ error: "Brak produkcji." }, { status: 400 });
    await removeFromMyList(viewer.id, productionId);
    return NextResponse.json({ saved: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się usunąć z listy." }, { status: 400 });
  }
}
