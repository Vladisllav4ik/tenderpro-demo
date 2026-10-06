import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { tenders as seed, type Tender } from "./demo-data";

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
  tenders: seed,
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
  updateTender: (id: string, status: string) => void;
  assignTender: (id: string, manager: string) => void;
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
    tenders,
    rules: saved.rules ?? initial.rules,
    pipeline: saved.pipeline ?? {},
    settings: { ...initial.settings, ...saved.settings },
    knowledge: { ...initialKnowledge, ...saved.knowledge },
  };
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem("tenderpro-demo");
      if (value) setState(migrate(JSON.parse(value)));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("tenderpro-demo", JSON.stringify(state));
  }, [state, ready]);
  const updateTender = (id: string, status: string) =>
    setState((s) => ({
      ...s,
      tenders: s.tenders.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  const assignTender = (id: string, manager: string) =>
    setState((s) => ({
      ...s,
      tenders: s.tenders.map((t) =>
        t.id === id
          ? { ...t, status: "В роботі", manager, stage: t.stage || "Аналіз" }
          : t,
      ),
    }));
  return (
    <DemoContext.Provider
      value={{ state, setState, updateTender, assignTender }}
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
