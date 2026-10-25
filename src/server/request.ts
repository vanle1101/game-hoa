import "server-only";
import { HttpError } from "./identity";

/** Bound actual bytes before JSON parsing; Content-Length is only an early rejection hint. */
export async function readJSON(request: Request, maxBytes: number): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) throw new HttpError(413, "Dữ liệu yêu cầu vượt giới hạn.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Yêu cầu JSON trống.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maxBytes) throw new HttpError(413, "Dữ liệu yêu cầu vượt giới hạn.");
      chunks.push(result.value);
    }
    const buffer = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
    catch { throw new HttpError(400, "Yêu cầu JSON không hợp lệ."); }
  } finally { await reader.cancel().catch(() => undefined); }
}
