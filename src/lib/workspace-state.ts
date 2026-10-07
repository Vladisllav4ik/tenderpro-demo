import { useEffect, useRef, useState } from "react";

export const workspaceKey = (name: string) => `tenderpro.table.${name}`;
export function readWorkspace<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(workspaceKey(name));
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
export function writeWorkspace(name: string, value: unknown) {
  try {
    localStorage.setItem(workspaceKey(name), JSON.stringify(value));
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
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  const validator = useRef(validate);
  const migrator = useRef(migrate);
  useEffect(() => {
    const saved = readWorkspace(name, fallback);
    if (validator.current(saved)) setValue(migrator.current(saved));
    setReady(true);
  }, [name]);
  useEffect(() => {
    if (ready) writeWorkspace(name, value);
  }, [name, value, ready]);
  return [value, setValue, ready] as const;
}
