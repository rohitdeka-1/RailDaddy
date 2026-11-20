import { useMutation } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { useState } from "react";
import { parseTravelClass, rupees, travelClasses, type TravelClass } from "@/lib/trip";

const quotas = [["GN", "General"], ["TQ", "Tatkal"], ["SS", "Lower berth / senior citizen"], ["LD", "Ladies"]];
const statuses = {
  AVAILABLE: { label: "Available", tone: "green" },
  RAC: { label: "RAC", tone: "yellow" },
  WAITLIST: { label: "Waitlisted", tone: "red" },
  REGRET: { label: "Waitlist closed", tone: "red" },
  NOT_AVAILABLE: { label: "Not available", tone: "red" },
  TRAIN_CANCELLED: { label: "Train cancelled", tone: "red" },
  TRAIN_DEPARTED: { label: "Train departed", tone: "red" },
  UNKNOWN: { label: "Availability unknown", tone: "neutral" },
} as const;

type SeatResult = {
  status: keyof typeof statuses;
  description: string | null;
  availableCount: number | null;
  totalFare: number | null;
  observedAt: string | null;
};

type SeatSegment = { train: string; from: string; to: string; date: string };

const sourceTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});

export function SeatAvailability({ preferredClass, offeredClasses, ...segment }: SeatSegment & {
  preferredClass?: TravelClass | undefined;
  offeredClasses?: string[] | undefined;
}) {
  const [quota, setQuota] = useState("GN");
  const knownClasses = offeredClasses?.length ? offeredClasses.map(parseTravelClass).filter((code) => code !== undefined) : undefined;
  const possibleClasses = Object.keys(travelClasses) as TravelClass[];
  const choices = [...new Set(knownClasses ?? possibleClasses)];
  if (preferredClass && choices.includes(preferredClass)) {
    choices.splice(choices.indexOf(preferredClass), 1);
    choices.unshift(preferredClass);
  }
  if (!choices.length) return <p className="flow-sub">No supported reserved classes on this train.</p>;

  return (
    <section className="seat-availability" aria-label="Seat availability">
      <div className="seat-availability-header">
        <span>Seat availability</span>
        <label>Quota <select value={quota} onChange={(event) => setQuota(event.target.value)}>
          {quotas.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select></label>
      </div>
      <ul className="seat-tiles">
        {choices.map((travelClass) => (
          <SeatTile key={`${quota}/${travelClass}`} segment={segment} travelClass={travelClass} quota={quota} />
        ))}
      </ul>
    </section>
  );
}

function SeatTile({ segment: { train, from, to, date }, travelClass, quota }: {
  segment: SeatSegment; travelClass: TravelClass; quota: string;
}) {
  const check = useMutation({
    async mutationFn(): Promise<SeatResult> {
      const query = new URLSearchParams({ from, to, date, class: travelClass, quota });
      const response = await fetch(`/api/v1/trains/${encodeURIComponent(train)}/availability?${query}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) throw new Error(body?.message ?? "Seat availability could not be checked.");
      return body.data;
    },
  });
  const result = check.data;
  const status = result && statuses[result.status];
  const label = `${travelClasses[travelClass]} (${travelClass})`;

  return (
    <li className="seat-tile" data-tone={status?.tone ?? "neutral"}>
      <strong className="seat-tile-class">{label}</strong>
      <div className="seat-tile-result" aria-live="polite">
        {check.isError && <p className="seat-tile-error">{check.error.message}</p>}
        {result && status && (
          <>
            <p className="seat-tile-status">
              {status.label}
              {result.status === "AVAILABLE" && result.availableCount !== null && ` · ${result.availableCount}`}
            </p>
            {(result.status === "RAC" || result.status === "WAITLIST") && result.description && <p>{result.description}</p>}
            {result.totalFare !== null && <p>{rupees(result.totalFare)} quoted fare</p>}
            {result.observedAt && <p className="seat-tile-source">Read <time dateTime={result.observedAt}>{sourceTime.format(new Date(result.observedAt))} IST</time></p>}
          </>
        )}
      </div>
      <button className="seat-refresh" type="button" disabled={check.isPending}
        aria-label={`Refresh ${label} availability`} onClick={() => check.mutate()}>
        <RotateCw size={14} aria-hidden="true" />
        {check.isPending ? "Refreshing…" : "Refresh"}
      </button>
    </li>
  );
}
