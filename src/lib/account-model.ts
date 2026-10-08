export type Account = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};
export const accountInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toLocaleUpperCase("uk-UA");
