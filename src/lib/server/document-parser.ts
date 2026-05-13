export type ParsedFile = {
  content: string;
  parser: "text" | "pdf" | "docx";
};

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (extension === "pdf" || mimeType === "application/pdf") {
    return parsePdf(file);
  }

  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseDocx(file);
  }

  return {
    content: await file.text(),
    parser: "text",
  };
}

async function parsePdf(file: File): Promise<ParsedFile> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });

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

async function parseDocx(file: File): Promise<ParsedFile> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(await file.arrayBuffer()),
  });

  return {
    content: result.value.trim(),
    parser: "docx",
  };
}
