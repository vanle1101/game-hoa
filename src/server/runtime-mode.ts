// Shared by Next route handlers and the standalone worker; keep this free of Next APIs.
export const isLocalDevelopment = () => process.env.LOCAL_DEV_MODE === "true" && !process.env.VERCEL &&
  (process.env.NODE_ENV !== "production" || process.env.PREVIEW_LOCAL_SAVE === "true");
export const isLocalDemo = () => isLocalDevelopment() && process.env.NODE_ENV === "development" && process.env.LOCAL_DEV_MOCK_MODE === "true";
