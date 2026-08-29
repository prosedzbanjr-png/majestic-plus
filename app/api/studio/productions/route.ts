import { NextResponse } from "next/server";
import { adminCreateProduction, adminListProductions } from "@/lib/majestic-db";
import { isStudioAuthenticated } from "@/lib/studio-auth";

export async function GET() {
  if (!(await isStudioAuthenticated())) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  try {
    const productions = await adminListProductions();
    return NextResponse.json({ productions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się pobrać produkcji." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isStudioAuthenticated())) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const production = await adminCreateProduction(body);
    return NextResponse.json({ production }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się dodać produkcji." },
      { status: 400 },
    );
  }
}
