import { ListGroup, ListRow } from "@/design-system/components/list-row";
import { Badge } from "@/design-system/components/badge";
import { formatDayShort, formatTime } from "@/lib/time/berlin";
import { formatHours, formatMinutesShort } from "@/lib/time/format";
import type { DayRow } from "../queries";

export function DayList({ days, today, hrefFor }: { days: DayRow[]; today: string; hrefFor: (d: string) => string }) {
  const visible = days.filter((d) => d.status !== "none" || (d.targetMinutes > 0 && d.date < today));
  if (visible.length === 0) return <p className="py-6 text-center text-sm text-fg-2">Keine Buchungen in diesem Zeitraum.</p>;
  return (
    <ListGroup>
      {[...visible].reverse().map((d) => {
        const missing = d.status === "none";
        const subtitle = missing
          ? "Keine Buchung"
          : `${d.firstIn ? formatTime(d.firstIn) : "–"} – ${d.lastOut ? formatTime(d.lastOut) : "läuft"}${
              d.breakMinutes > 0 ? ` · Pause ${formatMinutesShort(d.breakMinutes)}` : ""
            }`;
        return (
          <ListRow
            key={d.date}
            href={hrefFor(d.date)}
            title={d.date === today ? `Heute, ${formatDayShort(d.date).split(", ")[1]}` : formatDayShort(d.date)}
            subtitle={subtitle}
            trailing={
              missing ? (
                <Badge tone="pause">fehlt</Badge>
              ) : d.status === "incomplete" ? (
                <Badge tone="alert">offen</Badge>
              ) : (
                <span className="font-semibold text-fg">{formatHours(d.netMinutes)}</span>
              )
            }
          />
        );
      })}
    </ListGroup>
  );
}
