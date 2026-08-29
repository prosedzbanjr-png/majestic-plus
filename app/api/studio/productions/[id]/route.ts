import { NextResponse } from "next/server";
import { adminDeleteProduction, adminUpdateProduction } from "@/lib/majestic-db";
import { isStudioAuthenticated } from "@/lib/studio-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isStudioAuthenticated())) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const production = await adminUpdateProduction(id, body);
    return NextResponse.json({ production });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isStudioAuthenticated())) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await adminDeleteProduction(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się usunąć produkcji." },
      { status: 400 },
    );
  }
}
