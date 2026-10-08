import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { Tender } from "../lib/demo-data";
import { desktopRepository, type DesktopData } from "./repository";
type Context = ReturnType<typeof import("../lib/demo-store").useDemo>;
const Context = createContext<Context | null>(null);
let initial: DesktopData;
export function initializeDesktopStore(data: DesktopData) {
  initial = data;
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Context["state"]>({
    tenders: initial.tenders,
    rules: [],
    pipeline: {},
    settings: {},
    knowledge: {
      company: "",
      brands: "",
      groups: "",
      no: "",
      regions: "",
      terms: "",
      margin: "",
      strengths: "",
      certs: "",
    },
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const replace = useCallback(
    (saved: Tender) =>
      setState((s) => ({
        ...s,
        tenders: s.tenders.map((t) => (t.id === saved.id ? saved : t)),
      })),
    [],
  );
  const refreshTenders = useCallback(async () => {
    const data = await desktopRepository.load();
    setState((s) => ({ ...s, tenders: data.tenders }));
  }, []);
  const update = useCallback(
    (
      id: string,
      comment?: string,
      color?: NonNullable<Tender["commentColor"]>,
    ) => {
      setState((s) => ({
        ...s,
        tenders: s.tenders.map((t) =>
          t.id === id
            ? {
                ...t,
                ...(comment === undefined
                  ? {}
                  : { comment, commentText: comment }),
                ...(color === undefined ? {} : { commentColor: color }),
              }
            : t,
        ),
      }));
      void desktopRepository
        .comment(id, comment, color)
        .then(replace)
        .catch((e) => toast.error(`Зміни не збережено: ${String(e)}`));
    },
    [replace],
  );
  const viewTender = useCallback(
    (id: string) => {
      if (stateRef.current.tenders.find((t) => t.id === id)?.firstViewedAt)
        return;
      void desktopRepository
        .view(id)
        .then(replace)
        .catch((e) => toast.error(String(e)));
    },
    [replace],
  );
  const value: Context = {
    state,
    setState,
    viewTender,
    saveComment: (id, text) => update(id, text),
    setCommentColor: (id, color) => update(id, undefined, color),
    documentAction: () =>
      toast.info(
        "Аналіз документів не підключено; позначку успішного аналізу не створено.",
      ),
    syncLifecycle: () =>
      toast.info("Моніторинг джерела не підключено на етапі №2."),
    now: new Date(),
    ready: true,
    refreshTenders,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDemo(): Context {
  const value = useContext(Context);
  if (!value) throw new Error("Desktop provider missing");
  return value;
}
