export type ParsedFile = {
  content: string;
  parser: "text" | "pdf" | "docx";
};

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const mimeType = file.type.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  return parseUploadedBuffer({
    name: file.name,
    mimeType,
    buffer,
  });
}

export async function parseUploadedBuffer(input: {
  name: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ParsedFile> {
  const extension = input.name.split(".").pop()?.toLowerCase();
  const mimeType = input.mimeType.toLowerCase();

  if (extension === "pdf" || mimeType === "application/pdf") {
    return parsePdf(input.buffer);
  }

  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseDocx(input.buffer);
  }

  return {
    content: input.buffer.toString("utf8"),
    parser: "text",
  };
}

async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return {
      content: result.text.trim(),
      parser: "pdf",
    };
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<ParsedFile> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({
    buffer,
  });

  return {
    content: result.value.trim(),
    parser: "docx",
  };
}
