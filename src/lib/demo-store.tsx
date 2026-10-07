import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { tenders as seed, type Tender } from "./demo-data";
import {
  normalizeTender,
  newTender,
  viewTender as markViewed,
  saveComment as applyComment,
  recalculateTender,
  recordEvent,
  STATUS_RECALC_DELAY_MS,
  syncLifecycle as applyLifecycle,
  expireTender,
  isCompleted,
} from "./tender-workflow";

const configuredDelay = Number(import.meta.env["VITE_STATUS_RECALC_DELAY_MS"]);
const validDelay =
  Number.isFinite(configuredDelay) && configuredDelay >= 0
    ? configuredDelay
    : STATUS_RECALC_DELAY_MS;

type Rule = { name: string; weight: number; enabled: boolean };
const initialKnowledge = {
  company:
    "Постачальник вантажної та будівельної техніки, промислових запчастин та обладнання",
  brands: "DONGFENG, XCMG, Fleetguard, Donaldson, Cummins, SKF",
  groups:
    "Вантажна техніка, автокрани, будівельна техніка, фільтри, гідравліка, двигуни, залізничні запчастини",
  no: "Будівельні роботи, харчування, медицина",
  regions: "Вся Україна, пріоритет — Центр і Схід",
  terms: "Техніка — до 90 днів; запчастини — 14–45 днів",
  margin: "12%",
  strengths: "Підбір техніки та аналогів, технічна експертиза",
  certs: "ISO 9001, дилерські сертифікати, 24 аналогічні договори",
};
type DemoState = {
  tenders: Tender[];
  rules: Rule[];
  pipeline: Record<string, string>;
  settings: Record<string, boolean>;
  knowledge: typeof initialKnowledge;
};
const initial: DemoState = {
  tenders: seed.map((t) => normalizeTender(t)),
  rules: [
    { name: "DONGFENG або XCMG", weight: 25, enabled: true },
    { name: "Точна товарна група", weight: 20, enabled: true },
    { name: "Бюджет < 100 000 грн", weight: -20, enabled: true },
    { name: "Дедлайн < 48 год", weight: -15, enabled: true },
    { name: "Є точна модель або номер", weight: 15, enabled: true },
    { name: "Потрібен авторизаційний лист", weight: -10, enabled: true },
  ],
  pipeline: {},
  settings: { autoAI: true, fast: true, full: false, telegram: false },
  knowledge: initialKnowledge,
};
type Ctx = {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  documentAction: (
    id: string,
    name: string,
    action: "downloaded" | "parsed",
  ) => void;
  viewTender: (id: string) => void;
  saveComment: (id: string, comment: string) => void;
  setCommentColor: (
    id: string,
    color: NonNullable<Tender["commentColor"]>,
  ) => void;
  syncLifecycle: (id: string, data: NonNullable<Tender["lifecycle"]>) => void;
  now: Date;
  ready: boolean;
};
const DemoContext = createContext<Ctx | undefined>(undefined);

function migrate(raw: unknown): DemoState {
  if (!raw || typeof raw !== "object") return initial;
  const saved = raw as Partial<DemoState>;
  const byId = new Map((saved.tenders ?? []).map((t) => [t.id, t]));
  const tenders = seed.map((base) => ({
    ...base,
    ...(byId.get(base.id) ?? {}),
  }));
  for (const old of saved.tenders ?? [])
    if (!tenders.some((t) => t.id === old.id))
      tenders.push({ ...seed[0], ...old });
  return {
    tenders: tenders.map((t) => normalizeTender(t)),
    rules: saved.rules ?? initial.rules,
    pipeline: saved.pipeline ?? {},
    settings: { ...initial.settings, ...saved.settings },
    knowledge: { ...initialKnowledge, ...saved.knowledge },
  };
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setInternalState] = useState(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [now, setNow] = useState(() => new Date());
  const setState: React.Dispatch<React.SetStateAction<DemoState>> = useCallback(
    (update) =>
      setInternalState((previous) => {
        const next = typeof update === "function" ? update(previous) : update;
        if (next === previous) return previous;
        const known = new Set(previous.tenders.map((t) => t.id));
        return {
          ...next,
          tenders: next.tenders.map((t) =>
            recalculateTender(
              known.has(t.id) ? normalizeTender(t) : newTender(t),
            ),
          ),
        };
      }),
    [],
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem("tenderpro-demo");
      if (value) setInternalState(migrate(JSON.parse(value)));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem("tenderpro-demo", JSON.stringify(state));
      } catch {}
    }
  }, [state, ready]);
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const time = new Date();
      setNow((previous) =>
        Math.floor(previous.getTime() / 60000) ===
        Math.floor(time.getTime() / 60000)
          ? previous
          : time,
      );
      setInternalState((s) => {
        const tenders = s.tenders.map((t) => recalculateTender(t, time));
        return tenders.some((t, i) => t !== s.tenders[i])
          ? { ...s, tenders }
          : s;
      });
    };
    check();
    const timer = setInterval(check, 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [ready]);
  const viewTender = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        tenders: s.tenders.map((t) => (t.id === id ? markViewed(t) : t)),
      })),
    [setState],
  );
  const saveComment = (id: string, comment: string) => {
    const current = stateRef.current;
    const next = {
      ...current,
      tenders: current.tenders.map((t) =>
        t.id === id ? applyComment(t, comment, new Date(), validDelay) : t,
      ),
    };
    stateRef.current = next;
    setInternalState(next);
    try {
      localStorage.setItem("tenderpro-demo", JSON.stringify(next));
    } catch {}
  };
  const setCommentColor = (
    id: string,
    color: NonNullable<Tender["commentColor"]>,
  ) =>
    setState((s) => ({
      ...s,
      tenders: s.tenders.map((t) =>
        t.id === id
          ? recordEvent(
              { ...t, commentColor: color },
              "comment-color",
              "Змінено колір коментаря",
            )
          : t,
      ),
    }));
  const syncLifecycle = (id: string, data: NonNullable<Tender["lifecycle"]>) =>
    setState((s) => ({
      ...s,
      tenders: s.tenders.map((t) =>
        t.id === id ? applyLifecycle(t, data, new Date(), validDelay) : t,
      ),
    }));
  const documentAction = (
    id: string,
    name: string,
    action: "downloaded" | "parsed",
  ) =>
    setState((s) => ({
      ...s,
      tenders: s.tenders.map((t) =>
        t.id === id
          ? recordEvent(
              {
                ...t,
                documentStates: {
                  ...t.documentStates,
                  [name]: { ...t.documentStates?.[name], [action]: true },
                },
              },
              "document",
              action === "downloaded"
                ? "Завантажено демо-витяг: " + name
                : "AI аналіз документа: " + name,
            )
          : t,
      ),
    }));
  return (
    <DemoContext.Provider
      value={{
        state,
        setState,
        documentAction,
        viewTender,
        saveComment,
        setCommentColor,
        syncLifecycle,
        now,
        ready,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider missing");
  return value;
}
