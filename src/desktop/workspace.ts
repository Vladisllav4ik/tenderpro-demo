import { useEffect, useState, type SetStateAction } from "react";
import { toast } from "sonner";
import { desktopRepository, preferences } from "./repository";
export const workspaceKey = (name: string, id = "desktop-poc") =>
  `${id}:${name}`;
export function readWorkspace<T>(name: string, fallback: T, _id?: string): T {
  return preferences.has(name) ? (preferences.get(name) as T) : fallback;
}
export function writeWorkspace(name: string, value: unknown, _id?: string) {
  preferences.set(name, value);
  void desktopRepository
    .preference(name, value)
    .catch((e) => toast.error(`Налаштування не збережено: ${String(e)}`));
}
export function useWorkspaceState<T>(
  name: string,
  fallback: T,
  validate: (v: unknown) => boolean = () => true,
  migrate: (v: T) => T = (v) => v,
): [T, (v: SetStateAction<T>) => void, boolean] {
  const [value, setValue] = useState<T>(() => {
    const saved = readWorkspace(name, fallback);
    return validate(saved) ? migrate(saved) : fallback;
  });
  useEffect(() => {
    writeWorkspace(name, value);
  }, [name, value]);
  return [value, setValue, true];
}
