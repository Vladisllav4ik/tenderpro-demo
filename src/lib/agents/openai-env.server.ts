let triedLocalEnv = false;
export function getOpenAIKey(): string | undefined {
  // Node 22 dotenv loader only on the local dev server; Vercel uses server env.
  if (
    !triedLocalEnv &&
    !process.env["OPENAI_API_KEY"] &&
    process.env["NODE_ENV"] !== "production"
  ) {
    triedLocalEnv = true;
    try {
      process.loadEnvFile(".env");
    } catch {
      /* Missing local file is handled as a safe UI error. */
    }
  }
  return process.env["OPENAI_API_KEY"]?.trim() || undefined;
}
