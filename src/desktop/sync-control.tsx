import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDemo } from "./store";
import { desktopRepository } from "./repository";
export function SyncControl() {
  const { refreshTenders } = useDemo();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function sync() {
    setBusy(true);
    setMessage("Отримання даних із сервера…");
    try {
      await desktopRepository.flush();
      const result = await invoke<{
        received: number;
        changed: number;
        hasMore: boolean;
      }>("desktop_sync");
      setMessage(
        `Отримано: ${result.received}; оновлено: ${result.changed}.${result.hasMore ? " Є наступна сторінка — натисніть ще раз." : ""}`,
      );
    } catch (error) {
      setMessage(String(error));
    } finally {
      // A later network failure may follow successfully committed pages.
      try {
        await refreshTenders();
      } catch (error) {
        setMessage(`Не вдалося перечитати локальні дані: ${String(error)}`);
      } finally {
        setBusy(false);
      }
    }
  }
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm">
      <button
        type="button"
        disabled={busy}
        onClick={() => void sync()}
        className="rounded border px-3 py-1 disabled:opacity-50"
      >
        {busy ? "Оновлення…" : "Оновити тендери"}
      </button>
      <span role="status">{message}</span>
    </div>
  );
}
