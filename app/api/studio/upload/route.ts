import { NextResponse } from "next/server";
import { isStudioAuthenticated } from "@/lib/studio-auth";
import { isSupabaseConfigured, supabaseBaseUrl, supabaseServiceKey } from "@/lib/majestic-db";

export const runtime = "nodejs";

const BUCKET = "majestic-media";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function headers(extra?: Record<string, string>) {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    ...extra,
  };
}

async function ensureBucket() {
  const response = await fetch(`${supabaseBaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: MAX_SIZE,
      allowed_mime_types: Array.from(ALLOWED),
    }),
  });

  if (!response.ok && response.status !== 409) {
    const body = await response.text();
    throw new Error(`Nie udało się przygotować storage: ${body}`);
  }
}

export async function POST(request: Request) {
  if (!(await isStudioAuthenticated())) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase nie jest skonfigurowany." }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "image").replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "image";

    if (!(file instanceof File)) throw new Error("Nie wybrano pliku.");
    if (!ALLOWED.has(file.type)) throw new Error("Dozwolone formaty: JPG, PNG, WEBP.");
    if (file.size > MAX_SIZE) throw new Error("Grafika może mieć maksymalnie 10 MB.");

    await ensureBucket();

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const upload = await fetch(`${supabaseBaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: headers({
        "Content-Type": file.type,
        "x-upsert": "true",
      }),
      body: bytes,
    });

    if (!upload.ok) {
      const body = await upload.text();
      throw new Error(`Upload nie powiódł się: ${body}`);
    }

    const url = `${supabaseBaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
    return NextResponse.json({ url, path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się wysłać grafiki." },
      { status: 400 },
    );
  }
}
