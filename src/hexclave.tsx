import "server-only";

import { HexclaveServerApp } from "@hexclave/next";

export const hexclaveServerApp = new HexclaveServerApp({
  tokenStore: "nextjs-cookie",
  urls: {
    afterSignIn: "/dashboard",
    afterSignUp: "/dashboard",
    accountSettings: "/dashboard/account-settings",
  },
});
