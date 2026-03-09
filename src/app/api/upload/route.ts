import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth-guard";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const blob = await put(`${Date.now()}-${file.name}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json(
      { error: "Upload failed", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
