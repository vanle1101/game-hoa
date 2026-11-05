/* eslint-disable @typescript-eslint/no-require-imports */
const { createGateway, loadCredentials } = require("C:/Users/phamc/.dsh/workai/life-level-v12/preview/gateway.js");
(async () => {
  const gateway = createGateway({
    credentials: loadCredentials(),
    port: 3335,
    // This loopback-bound production build opts into the owner's local save.
    // The gateway still authenticates Home and all mutation APIs.
    upstreamPort: 3336,
    publicOrigin: process.env.PREVIEW_PUBLIC_ORIGIN || "https://perfume-diving-resolved-aging.trycloudflare.com",
    publicShowcase: true,
    showcasePath: "/showcase/apartment-v18",
  });
  await gateway.listen();
  console.log("V21 unified read-only showcase gateway listening on 127.0.0.1:3335");
})().catch(error => { console.error(error); process.exitCode = 1; });
