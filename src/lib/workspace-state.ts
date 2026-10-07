import { LocalPreferencesRepository } from "./preferences-repository";
import { useAccount, accountKey, migrateAccountStorage } from "./account";
import { useEffect, useRef, useState } from "react";

export const workspaceKey = (name: string, id = "user") =>
  accountKey(id, `table.${name}`);
export function readWorkspace<T>(name: string, fallback: T, id = "user"): T {
  try {
    return new LocalPreferencesRepository(localStorage).read(
      id,
      `table.${name}`,
      fallback,
    );
  } catch {
    return fallback;
  }
}
export function writeWorkspace(name: string, value: unknown, id = "user") {
  try {
    new LocalPreferencesRepository(localStorage).write(
      id,
      `table.${name}`,
      value,
    );
  } catch {}
}
// Hydrate after mount so server and first client render agree. Never overwrite
// the stored value with the server default before hydration has finished.
export function useWorkspaceState<T>(
  name: string,
  fallback: T,
  validate: (value: unknown) => boolean = () => true,
  migrate: (value: T) => T = (value) => value,
) {
  const id = useAccount()?.id ?? "guest";
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  const validator = useRef(validate);
  const migrator = useRef(migrate);
  useEffect(() => {
    migrateAccountStorage(id);
    const saved = readWorkspace(name, fallback, id);
    if (validator.current(saved)) setValue(migrator.current(saved));
    setReady(true);
  }, [name, id]);
  useEffect(() => {
    if (ready) writeWorkspace(name, value, id);
  }, [name, id, value, ready]);
  return [value, setValue, ready] as const;
}
