import { NextResponse } from "next/server";
import { listIngestionJobs } from "@/lib/server/ingestion-queue";

export const runtime = "nodejs";

export async function GET() {
  try {
    const jobs = await listIngestionJobs();
    return NextResponse.json({ mode: process.env.DATABASE_URL ? "database" : "local", jobs });
  } catch (error) {
    console.error("Ingestion job listing failed", error);
    return NextResponse.json({ mode: "local", jobs: [] }, { status: 503 });
  }
}
