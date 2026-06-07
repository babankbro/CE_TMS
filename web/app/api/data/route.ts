import { NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";
import { getDataset, saveDataset } from "@/lib/dataStore";
import type { Dataset } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dataset = await getDataset(getStorage());
  return NextResponse.json(dataset);
}

export async function PUT(req: Request) {
  let incoming: Dataset;
  try {
    incoming = (await req.json()) as Dataset;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  if (typeof incoming?.version !== "number") {
    return NextResponse.json({ error: "missing-version" }, { status: 400 });
  }

  const result = await saveDataset(getStorage(), incoming);
  if (!result.ok) {
    return NextResponse.json(
      { error: "version-conflict", current: result.current },
      { status: 409 },
    );
  }
  return NextResponse.json(result.dataset);
}
