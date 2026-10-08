import { invoke } from "@tauri-apps/api/core";
import type { Tender } from "../lib/demo-data";
export type DesktopData = {
  tenders: Tender[];
  preferences: Record<string, unknown>;
  diagnostics: {
    databasePath: string;
    schemaVersion: number;
    integrity: string;
  };
};
export interface DesktopRepository {
  load(): Promise<DesktopData>;
  comment(
    id: string,
    comment?: string,
    color?: NonNullable<Tender["commentColor"]>,
  ): Promise<Tender>;
  preference(key: string, value: unknown): Promise<void>;
  view(id: string): Promise<Tender>;
  flush(): Promise<void>;
}
let queue: Promise<unknown> = Promise.resolve();
const tracked = <T>(work: () => Promise<T>) => {
  const next = queue.then(work);
  queue = next.catch(() => {});
  return next;
};
let lastError: unknown;
function write<T>(work: () => Promise<T>): Promise<T> {
  return tracked(work).catch((e) => {
    lastError = e;
    throw e;
  });
}
export const desktopRepository: DesktopRepository = {
  load: () => invoke("desktop_load"),
  comment: (id, comment, color) =>
    write(() =>
      invoke("desktop_save_comment", {
        id,
        comment: comment ?? null,
        color: color ?? null,
      }),
    ),
  preference: (key, value) =>
    write(() => invoke("desktop_save_preference", { key, value })),
  view: (id) => write(() => invoke("desktop_record_view", { id })),
  flush: async () => {
    await queue;
    if (lastError) {
      const error = lastError;
      lastError = undefined;
      throw error;
    }
  },
};
export const preferences = new Map<string, unknown>();
export function hydratePreferences(data: DesktopData) {
  preferences.clear();
  for (const [k, v] of Object.entries(data.preferences)) preferences.set(k, v);
}
