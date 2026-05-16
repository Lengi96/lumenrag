import { NextResponse } from "next/server";
import { cancelIngestionJob, retryIngestionJob } from "@/lib/server/ingestion-queue";

export const runtime = "nodejs";

type JobActionBody = {
  action?: "cancel" | "retry";
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as JobActionBody;

  try {
    if (body.action === "cancel") {
      return NextResponse.json({ job: await cancelIngestionJob(id) });
    }
    if (body.action === "retry") {
      return NextResponse.json({ job: await retryIngestionJob(id) });
    }
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("Ingestion job action failed", error);
    return NextResponse.json({ error: "Ingestion job action failed" }, { status: 503 });
  }
}
