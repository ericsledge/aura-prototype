import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeWithOpenAI, MODEL } from "@/lib/ai/analyze";
import { Goal } from "@/lib/types/aura";

interface AnalyzeRequestBody {
  images: { viewType: string; dataUrl: string }[];
  goal: Goal;
}

export async function POST(request: Request) {
  // Require a real (possibly anonymous) Supabase session — this endpoint
  // spends real money per call, so it must not be reachable unauthenticated.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: AnalyzeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (!Array.isArray(body.images) || body.images.length !== 3) {
    return NextResponse.json({ error: "expected_3_images" }, { status: 400 });
  }
  if (!body.goal || typeof body.goal !== "string") {
    return NextResponse.json({ error: "missing_goal" }, { status: 400 });
  }

  try {
    const modelOutput = await analyzeWithOpenAI(body.images, body.goal);
    return NextResponse.json({ modelOutput, model: MODEL });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    console.error("[api/aura/analyze]", message);
    const status = message.startsWith("ai_not_configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

