import { HttpError } from "./errors";

const MAX_PORTRAITS_PER_OWNER = 24;
const MAX_PORTRAIT_BYTES_PER_OWNER = 8_000_000;

/** Enforced while holding the owner's player row lock to serialize uploads. */
export function assertPortraitQuota(rows: { portraitKey: string; dataUrl: string }[], key: string, dataUrl: string): void {
  const previous = rows.find(row => row.portraitKey === key);
  if (!previous && rows.length >= MAX_PORTRAITS_PER_OWNER)
    throw new HttpError(413, "Đã đạt giới hạn ảnh nhân vật cho tài khoản này.");
  const currentBytes = rows.reduce((total, row) => total + Buffer.byteLength(row.dataUrl), 0);
  const nextBytes = currentBytes - (previous ? Buffer.byteLength(previous.dataUrl) : 0) + Buffer.byteLength(dataUrl);
  if (nextBytes > MAX_PORTRAIT_BYTES_PER_OWNER && nextBytes >= currentBytes)
    throw new HttpError(413, "Dung lượng ảnh nhân vật đã vượt giới hạn tài khoản.");
}
