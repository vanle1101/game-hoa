import type { Route } from "@playwright/test";

/** Model the two guest bootstrap reads required before the local UI appears. */
export async function fulfillIsolatedGuestBootstrap(route: Route, ownerId: string): Promise<boolean> {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname === "/api/auth" && request.method() === "GET") {
    await route.fulfill({ json: { authenticated: false, account: null, guestSaveAvailable: false, localMode: true } });
    return true;
  }
  if (url.pathname === "/api/game/intent" && request.method() === "GET") {
    const expectedOwnerId = url.searchParams.get("expectedOwnerId");
    if (expectedOwnerId && expectedOwnerId !== ownerId) {
      await route.fulfill({ status: 409, json: { code: "OWNER_CHANGED", error: "Phiên người chơi đã thay đổi." } });
      return true;
    }
    await route.fulfill({ json: { ownerId, mode: "local", intent: null } });
    return true;
  }
  return false;
}
