/**
 * Turn an uploaded file into chunks of plain text.
 *
 * Deliberately dependency-free. A PDF parser is a large, frequently-vulnerable
 * dependency, and the shape of text we need — a small business's policy sheet,
 * not a scientific paper — doesn't justify it. What's here handles the common
 * cases and says so clearly when it can't.
 */

export type Chunk = { heading?: string; text: string };

export type Extracted = {
  ok: boolean;
  chunks: Chunk[];
  pages?: number;
  reason?: string;
  hint?: string;
};

const MAX_CHUNK_WORDS = 220;   // long enough to hold an idea, short enough to be quotable

/** Route by type, then chunk whatever comes back. */
export async function extractText(
  buf: ArrayBuffer, filename: string, mime: string,
): Promise<Extracted> {
  const lower = filename.toLowerCase();

  try {
    if (mime.startsWith("text/") || /\.(txt|md|csv)$/.test(lower)) {
      return chunkIt(new TextDecoder().decode(buf));
    }
    if (mime === "application/pdf" || lower.endsWith(".pdf")) {
      return fromPdf(buf);
    }
    if (lower.endsWith(".docx") ||
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return await fromDocx(buf);
    }
    if (lower.endsWith(".doc")) {
      return {
        ok: false, chunks: [], reason: "old_word_format",
        hint: "Save it as .docx or PDF and upload again.",
      };
    }
    return {
      ok: false, chunks: [], reason: "unsupported",
      hint: "PDF, Word (.docx), or a plain text file works.",
    };
  } catch (e: any) {
    console.error("extract failed:", e?.message ?? e);
    return { ok: false, chunks: [], reason: "extract_failed",
             hint: "Couldn't read that file. Try saving it as a PDF." };
  }
}

/**
 * PDF text lives inside compressed streams, but a great many PDFs — anything
 * produced by Word, Google Docs or a browser's Print to PDF — also carry
 * readable text operators. We pull those.
 *
 * A scanned PDF is an image with no text at all. We detect that and say so
 * rather than importing an empty document.
 */
function fromPdf(buf: ArrayBuffer): Extracted {
  const bytes = new Uint8Array(buf);
  const raw = new TextDecoder("latin1").decode(bytes);
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length || undefined;

  const out: string[] = [];

  // text-showing operators: (string) Tj  and  [(a) -2 (b)] TJ
  for (const m of raw.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)) out.push(unescapePdf(m[1]));
  for (const m of raw.matchAll(/\[((?:\\.|[^\][\\])*)\]\s*TJ/g)) {
    const parts: string[] = [];
    for (const p of m[1].matchAll(/\(((?:\\.|[^()\\])*)\)/g)) parts.push(unescapePdf(p[1]));
    if (parts.length) out.push(parts.join(""));
  }

  const text = out.join(" ").replace(/\s+/g, " ").trim();

  if (text.length < 40) {
    return {
      ok: false, chunks: [], pages, reason: "no_text_layer",
      hint: "This looks like a scan — the pages are images, so there's no text to read. " +
            "Open it in Google Docs or Word, which can convert it, then upload that.",
    };
  }

  const r = chunkIt(text);
  return { ...r, pages };
}

function unescapePdf(s: string) {
  return s
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1");
}

/**
 * A .docx is a zip, and its text sits in word/document.xml. We find that entry
 * and inflate it with DecompressionStream, which the runtime already has.
 */
async function fromDocx(buf: ArrayBuffer): Promise<Extracted> {
  const xml = await readZipEntry(new Uint8Array(buf), "word/document.xml");
  if (!xml) {
    return { ok: false, chunks: [], reason: "bad_docx",
             hint: "That didn't look like a Word file. Try saving it again as .docx." };
  }

  const s = new TextDecoder().decode(xml);
  const paras: string[] = [];
  for (const p of s.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const runs = [...p[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]);
    const line = runs.join("").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
                     .replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
    if (line) paras.push(line);
  }

  if (!paras.length) {
    return { ok: false, chunks: [], reason: "no_text",
             hint: "That document appears to be empty." };
  }
  return chunkIt(paras.join("\n\n"));
}

/** Minimal zip reader: find one entry by name and inflate it. */
async function readZipEntry(zip: Uint8Array, want: string): Promise<Uint8Array | null> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const sig = 0x04034b50;

  for (let i = 0; i < zip.length - 30; i++) {
    if (dv.getUint32(i, true) !== sig) continue;
    const method = dv.getUint16(i + 8, true);
    const compSize = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const name = new TextDecoder().decode(zip.subarray(i + 30, i + 30 + nameLen));
    if (name !== want) continue;

    const start = i + 30 + nameLen + extraLen;
    const body = zip.subarray(start, start + compSize);
    if (method === 0) return body;                       // stored
    if (method !== 8) return null;                       // not deflate

    const stream = new Blob([body as unknown as BlobPart]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return null;
}

/**
 * Split on meaning, not on character count. Blank lines and headings are where
 * a human would break, so a chunk stays a whole thought and quotes cleanly.
 */
function chunkIt(text: string): Extracted {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 20) {
    return { ok: false, chunks: [], reason: "no_text",
             hint: "There wasn't enough readable text in that file." };
  }

  const chunks: Chunk[] = [];
  let heading: string | undefined;
  let buf: string[] = [];
  let words = 0;

  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) chunks.push(heading ? { heading, text: body } : { text: body });
    buf = []; words = 0;
  };

  for (const block of clean.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // People write "Refunds:" and then the text on the very next line, with no
    // blank line between. Treat the first line of a block as a heading when it
    // looks like one, or the heading gets swallowed into the chunk above it.
    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    let body = lines;

    if (lines.length > 1 && looksLikeHeading(lines[0])) {
      flush();
      heading = lines[0].replace(/^#+\s*/, "").replace(/[:.]$/, "").slice(0, 90);
      body = lines.slice(1);
    } else if (lines.length === 1 && looksLikeHeading(lines[0])) {
      flush();
      heading = lines[0].replace(/^#+\s*/, "").replace(/[:.]$/, "").slice(0, 90);
      continue;
    }

    const joined = body.join("\n");
    if (!joined) continue;

    const n = joined.split(/\s+/).length;
    if (words + n > MAX_CHUNK_WORDS && buf.length) flush();
    buf.push(joined);
    words += n;
  }
  flush();

  return chunks.length
    ? { ok: true, chunks }
    : { ok: false, chunks: [], reason: "no_text" };
}

function looksLikeHeading(line: string): boolean {
  if (line.length > 90) return false;
  if (/^#{1,6}\s/.test(line)) return true;                    // markdown
  if (/^\d+[.)]\s+\S/.test(line) && line.length < 70) return true;  // "3. Refunds"
  if (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length < 70) return true;
  if (line.endsWith(":") && line.split(/\s+/).length <= 8) return true;
  return false;
}
