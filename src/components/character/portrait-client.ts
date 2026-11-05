const portraitPrefix = "data:image/png;base64,";
const maxPortraitLength = 1_500_000;

export type PortraitTransport = typeof fetch;

function validPortrait(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(portraitPrefix) &&
    value.length > portraitPrefix.length && value.length <= maxPortraitLength &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value.slice(portraitPrefix.length));
}

export async function readServerPortrait(ownerId: string, key: string, transport: PortraitTransport = fetch): Promise<string | null> {
  const response = await transport(`/api/profile/portrait?key=${encodeURIComponent(key)}&expectedOwnerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Không thể tải ảnh nhân vật từ máy chủ.");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("key" in body) || !("ownerId" in body) || !("dataUrl" in body) ||
    body.key !== key || body.ownerId !== ownerId || !validPortrait(body.dataUrl)) throw new Error("Ảnh nhân vật trên máy chủ không hợp lệ.");
  return body.dataUrl;
}

export async function saveServerPortrait(ownerId: string, key: string, dataUrl: string, transport: PortraitTransport = fetch): Promise<void> {
  if (!validPortrait(dataUrl)) throw new Error("Ảnh nhân vật không phải PNG hợp lệ hoặc quá lớn.");
  const response = await transport("/api/profile/portrait", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedOwnerId: ownerId, key, dataUrl }),
  });
  if (!response.ok) throw new Error("Không thể lưu ảnh nhân vật trên máy chủ.");
}

/** Upload a legacy browser copy before removing it; a failed upload keeps the old copy intact. */
export async function migrateLegacyPortrait(ownerId: string, key: string, transport: PortraitTransport = fetch): Promise<string | null> {
  const storageKey = `lifelevel-portrait:${ownerId}:${key}`;
  let legacy: string | null;
  try { legacy = localStorage.getItem(storageKey); } catch { return null; }
  if (!legacy) return null;
  if (!validPortrait(legacy)) return null;
  await saveServerPortrait(ownerId, key, legacy, transport);
  try { localStorage.removeItem(storageKey); } catch { /* The server copy is authoritative. */ }
  return legacy;
}

export function clearLegacyPortrait(ownerId: string, key: string): void {
  try { localStorage.removeItem(`lifelevel-portrait:${ownerId}:${key}`); } catch { /* Optional cleanup. */ }
}
