import { NextResponse } from "next/server";
import { adminCreateEpisode, adminListEpisodes } from "@/lib/majestic-db";
import { isStudioAuthenticated } from "@/lib/studio-auth";

export async function GET(request: Request) {
  if (!(await isStudioAuthenticated())) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const productionId = url.searchParams.get("production_id") ?? "";
    if (!productionId) return NextResponse.json({ error: "Brak production_id." }, { status: 400 });
    const episodes = await adminListEpisodes(productionId);
    return NextResponse.json({ episodes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się pobrać odcinków." },
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
    const episode = await adminCreateEpisode(body);
    return NextResponse.json({ episode }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się dodać odcinka." },
      { status: 400 },
    );
  }
}
