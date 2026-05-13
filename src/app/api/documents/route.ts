import { NextResponse } from "next/server";
import { analyzeDocument } from "@/lib/knowledge";
import { parseUploadedFile } from "@/lib/server/document-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const documents = await Promise.all(
    files.map(async (file) => {
      const parsed = await parseUploadedFile(file);
      const document = analyzeDocument({
        id: stableId(`${file.name}-${file.size}-${file.lastModified}`),
        title: file.name,
        type: file.type || "text/plain",
        size: file.size,
        content: parsed.content,
      });
      return {
        ...document,
        metadata: {
          parser: parsed.parser,
          originalMimeType: file.type || null,
        },
      };
    }),
  );

  return NextResponse.json({ documents });
}

function stableId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
