import { useMutation } from "@tanstack/react-query";
import { Clock, GitBranch, TrainFront } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SeatAvailability } from "@/components/seat-availability";
import { postJourney, type ConnectionPlan, type JourneyFilters, type JourneyTrip } from "@/lib/railway";
import { tripDateLabel, type TravelClass } from "@/lib/trip";

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function ConnectionPlanner({ trip, preferredClass }: { trip: JourneyTrip; preferredClass?: TravelClass | undefined }) {
  const titleId = useId();
  const [filterError, setFilterError] = useState("");
  const search = useMutation({
    mutationFn: (filters: JourneyFilters) => postJourney<{ success: true; data: { itineraries: ConnectionPlan[] } }>("plan", { ...trip, ...filters }),
  });
  const plans = search.data?.data.itineraries;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const field = (name: string) => fields.get(name)?.toString().trim() ?? "";
    const avoidTransfers = [...new Set(field("avoidTransfers").toUpperCase().split(/[\s,]+/).filter(Boolean))];
    if (avoidTransfers.length > 10 || avoidTransfers.some((code) => !/^[A-Z0-9]{1,10}$/.test(code))) {
      setFilterError("Enter up to 10 station codes, separated by commas or spaces.");
      return;
    }
    setFilterError("");
    search.mutate({
      departAfter: field("departAfter") || undefined,
      arriveBefore: field("arriveBefore") || undefined,
      maxTransfers: field("maxTransfers") === "1" ? 1 : 2,
      avoidTransfers,
    });
  }

  return (
    <section className="flow-card connection-planner" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId}><GitBranch size={20} aria-hidden="true" /> Plan a connecting trip</h2>
        <p className="flow-sub">Find trains with up to two changes. Filter by local station time and where you want to change trains.</p>
      </div>
      <form className="planner-form" onSubmit={submit} aria-busy={search.isPending}>
        <div className="planner-filters">
          <label>Depart after (IST)<input name="departAfter" type="time" /></label>
          <label>Arrive before (IST)<input name="arriveBefore" type="time" /></label>
          <label>Maximum transfers<select name="maxTransfers" defaultValue="2"><option value="1">1 transfer</option><option value="2">2 transfers</option></select></label>
          <label>Avoid transfers at<input name="avoidTransfers" placeholder="e.g. MTJ, BKI" maxLength={110} aria-invalid={Boolean(filterError)} /></label>
          <label>Maximum budget (₹)<input type="number" placeholder="Check fares per leg below" disabled /></label>
        </div>
        {filterError && <p role="alert" className="flow-sub">{filterError}</p>}
        <div className="planner-actions">
          <Button variant="journey" type="submit" disabled={search.isPending}>{search.isPending ? "Finding connections…" : "Find connections"}</Button>
        </div>
      </form>
      {search.isError && <p role="alert" className="flow-sub">{search.error.message}</p>}
      {plans && (
        <div className="planner-results">
          <p role="status" className="flow-sub">{plans.length === 0
            ? "No connecting routes matched. Try broadening your filters or changing the travel date."
            : `${plans.length} ${plans.length === 1 ? "connection" : "connections"} found. Check seats on each leg before booking.`}</p>
          {plans.map((plan) => <PlanCard key={plan.legs.map(({ train, from, to }) => `${train.number}-${from.code}-${from.date}-${from.departure}-${to.code}`).join("/")} plan={plan} preferredClass={preferredClass} />)}
        </div>
      )}
    </section>
  );
}

function PlanCard({ plan, preferredClass }: { plan: ConnectionPlan; preferredClass?: TravelClass | undefined }) {
  return (
    <article className="planner-itinerary">
      <h3>{plan.legs.length - 1} {plan.legs.length === 2 ? "transfer" : "transfers"} · {duration(plan.totalDurationMinutes)} total</h3>
      <ol className="planner-legs">
        {plan.legs.map((leg, index) => {
          const previous = plan.legs[index - 1];
          const wait = plan.transfers[index - 1]?.waitMinutes;
          return (
            <li key={`${leg.train.number}-${leg.from.code}-${leg.from.date}-${leg.from.departure}`}>
              {previous && <p className="planner-transfer">
                <Clock size={15} aria-hidden="true" />
                {wait !== undefined && `${duration(wait)} between trains · `}
                {previous.to.code === leg.from.code ? `Change at ${leg.from.name} (${leg.from.code})` :
                  `Change stations from ${previous.to.name} (${previous.to.code}) to ${leg.from.name} (${leg.from.code})`}
              </p>}
              <div className="planner-leg">
                <strong><TrainFront size={16} aria-hidden="true" /> {leg.train.name} <small>#{leg.train.number}</small></strong>
                <div className="planner-leg-times">
                  <span>{leg.from.name} ({leg.from.code}) <b>{leg.from.departure} · {tripDateLabel(leg.from.date)}</b></span>
                  <span>{leg.to.name} ({leg.to.code}) <b>{leg.to.arrival} · {tripDateLabel(leg.to.date)}</b></span>
                </div>
                <SeatAvailability train={leg.train.number} from={leg.from.code} to={leg.to.code} date={leg.from.date}
                  preferredClass={preferredClass} offeredClasses={leg.train.classes} />
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
