import { createServerFn } from "@tanstack/react-start";
export const getAccount = createServerFn({ method: "GET" }).handler(async () =>
  (await import("./session.server")).currentAccount(),
);
export const login = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => (await import("./session.server")).signIn(data));
export const logout = createServerFn({ method: "POST" }).handler(async () =>
  (await import("./session.server")).signOut(),
);
