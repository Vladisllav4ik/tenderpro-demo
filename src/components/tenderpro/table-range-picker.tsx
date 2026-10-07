import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fullDate } from "@/lib/tender-workflow";
import { dateValid, type TableRange } from "@/lib/table-range";
export function TableRangePicker({
  range,
  resolved,
  onChange,
}: {
  range: TableRange;
  resolved: { from: string; to: string };
  onChange: (range: TableRange) => void;
}) {
  const [from, setFrom] = useState(resolved.from),
    [to, setTo] = useState(resolved.to);
  useEffect(() => {
    setFrom(resolved.from);
    setTo(resolved.to);
  }, [resolved.from, resolved.to]);
  const change = (key: "from" | "to", value: string) => {
    const nextFrom = key === "from" ? value : from,
      nextTo = key === "to" ? value : to;
    key === "from" ? setFrom(value) : setTo(value);
    if (dateValid(nextFrom) && dateValid(nextTo) && nextFrom <= nextTo)
      onChange({ preset: "custom", from: nextFrom, to: nextTo });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="sheet-range-trigger"
          aria-label="Період відображення тендерів"
        >
          <CalendarDays size={14} />
          Тендери за {fullDate(resolved.from)} — {fullDate(resolved.to)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="sheet-range-picker" align="center">
        <h3>Період даних · дата публікації</h3>
        <div className="sheet-range-presets">
          {[
            ["7", "7 днів"],
            ["14", "14 днів"],
            ["month", "Місяць"],
            ["history", "Історичний"],
          ].map(([preset, label]) => (
            <button
              key={preset}
              aria-pressed={range.preset === preset}
              onClick={() =>
                onChange({
                  preset: preset as TableRange["preset"],
                  from: "",
                  to: "",
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="sheet-range-dates">
          <label>
            Від
            <input
              type="date"
              aria-label="Період від"
              value={from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label>
            До
            <input
              type="date"
              aria-label="Період до"
              value={to}
              onChange={(e) => change("to", e.target.value)}
            />
          </label>
        </div>
        {from > to && (
          <small role="alert">Початок має бути раніше завершення.</small>
        )}
        <small>Місяць — останні 30 днів. Зміни зберігаються автоматично.</small>
      </PopoverContent>
    </Popover>
  );
}
