// Sanitize before any response or repository write. Never snapshot process.env.
export function sanitizeSnapshot<T>(value: T, extraSecrets: string[] = []): T {
  const secrets = [
    ...extraSecrets,
    ...Object.entries(process.env)
      .filter(([name]) =>
        /SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY/i.test(name),
      )
      .map(([, v]) => v ?? ""),
  ].filter((v) => v.length >= 4);
  const visit = (item: unknown, depth = 0): unknown => {
    if (depth > 20) return "[TRUNCATED]";
    if (typeof item === "string") {
      let text = item.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]");
      for (const secret of secrets)
        text = text.split(secret).join("[REDACTED]");
      return text;
    }
    if (Array.isArray(item)) return item.map((v) => visit(v, depth + 1));
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item).map(([key, v]) => [
          key,
          /^(?:token|key|authorization|cookie|set-cookie)$|password|secret|(?:api|private)[_-]?key|access[_-]?token|refresh[_-]?token/i.test(
            key,
          )
            ? "[REDACTED]"
            : visit(v, depth + 1),
        ]),
      );
    return item;
  };
  return visit(value) as T;
}
