import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronDown, GitBranch, Sparkles, TrainFront } from "lucide-react";
import { useId, useState } from "react";
import { TrainSkeletons, useBookingReducedMotion } from "@/components/booking-motion";
import { BookingShell } from "@/components/booking-shell";
import { ConnectionPlanner } from "@/components/connection-planner";
import { JourneyAssistant } from "@/components/journey-assistant";
import { Button } from "@/components/ui/button";
import { bookingMotion, motionTokens } from "@/lib/motion";
import { findStation, stationCodeFor, stationLabel, trainSearchQuery, trainTimetableQuery, type ScheduledTrain } from "@/lib/railway";
import { parseTrip, tripDateLabel } from "@/lib/trip";

export const Route = createFileRoute("/trains")({
  validateSearch: parseTrip,
  head: () => ({ meta: [
    { title: "Find scheduled trains — Rail Daddy" },
    { name: "description", content: "Find direct trains and compare scheduled departures, arrivals, and journey times." },
  ] }),
  component: Results,
});

function Results() {
  const trip = Route.useSearch();
  const [plannerOverride, setPlannerOverride] = useState<boolean | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const reduced = useBookingReducedMotion();
  const source = stationCodeFor(trip.from);
  const destination = stationCodeFor(trip.to);
  const canSearch = Boolean(source && destination && source !== destination);
  const search = useQuery({
    ...trainSearchQuery(source ?? "", destination ?? "", trip.date),
    enabled: canSearch,
  });
  const results = search.data;
  const noDirect = results?.trains.length === 0;
  const plannerTrip = source && destination && source !== destination ? { source, destination, date: trip.date } : undefined;
  const showPlanner = plannerOverride ?? noDirect;
  const summary = {
    ...trip,
    from: results?.from.name ?? findStation(trip.from)?.name ?? trip.from,
    to: results?.to.name ?? findStation(trip.to)?.name ?? trip.to,
  };
  const editSearch = {
    from: results ? stationLabel(results.from) : summary.from,
    to: results ? stationLabel(results.to) : summary.to,
    date: trip.date,
  };

  return (
    <BookingShell trip={summary} back={<Link to="/" search={editSearch} hash="booking">Edit search</Link>}>
      <div className="results-toolbar">
        <div className="flow-title-row">
          <h1 className="flow-title">{results ? `${results.trains.length} direct ${results.trains.length === 1 ? "train" : "trains"}` : "Direct trains"} · {tripDateLabel(trip.date)}</h1>
          <p className="flow-sub">Scheduled times are in IST. Fares and seat availability are unavailable.</p>
        </div>
        <Button variant="outline" onClick={() => setAssistantOpen(true)} aria-haspopup="dialog"><Sparkles size={16} /> Ask Daddy AI</Button>
      </div>
      <JourneyAssistant open={assistantOpen} onOpenChange={setAssistantOpen} trip={plannerTrip} />
      {noDirect && <p className="flow-sub">No direct trains are scheduled for these stations on this date. Try a connecting trip.</p>}
      {plannerTrip && (
        <div className="connection-entry">
          <Button type="button" variant="outline" aria-expanded={showPlanner} aria-controls="connection-planner"
            onClick={() => setPlannerOverride(!showPlanner)}><GitBranch size={16} />{showPlanner ? "Hide connection planner" : "Plan a connecting trip"}</Button>
          <div id="connection-planner" hidden={!showPlanner}>
            {showPlanner && <ConnectionPlanner key={`${source}/${destination}/${trip.date}`} trip={plannerTrip} />}
          </div>
        </div>
      )}
      {!canSearch ? (
        <p className="flow-sub" role="alert">Choose two different railway stations to search.</p>
      ) : search.isPending ? (
        <div role="status"><span className="sr-only">Searching for trains</span><TrainSkeletons /></div>
      ) : search.isError && !results ? (
        <div className="flow-card">
          <p role="alert">{search.error.message}</p>
          <Button variant="journey" onClick={() => void search.refetch()} disabled={search.isFetching}>Try again</Button>
        </div>
      ) : results?.trains.length ? (
        <motion.ul className="train-list" aria-label="Scheduled trains" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : motionTokens.duration.standard }}>
          {results.trains.map((result, index) => (
            <TrainCard key={`${result.train.number}-${result.from.departure}`} result={result} index={index} reduced={reduced} />
          ))}
        </motion.ul>
      ) : null}
    </BookingShell>
  );
}

function TrainCard({ result, index, reduced }: { result: ScheduledTrain; index: number; reduced: boolean }) {
  const { train, from, to, duration, totalHaltsBetween } = result;
  const [showStops, setShowStops] = useState(false);
  const stopsId = useId();
  const arrivalOffset = to.day - from.day;
  const durationLabel = duration >= 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration}m`;
  return (
    <motion.li className="train-card" data-motion-owned="true"
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : motionTokens.duration.entrance, delay: reduced ? 0 : Math.min(index, 5) * bookingMotion.cardStagger, ease: motionTokens.easing.entrance }}>
      <div className="train-head">
        <div>
          <h2 className="train-name">{train.name}</h2>
          <span className="train-number"><TrainFront size={14} aria-hidden="true" />#{train.number} · {train.type}</span>
        </div>
      </div>
      <div className="train-times">
        <div><strong>{from.departure ?? "—"}</strong><span>{from.name} ({from.code})</span></div>
        <div className="train-duration"><span>{durationLabel}</span><i aria-hidden="true" /><span>{totalHaltsBetween === 0 ? "Nonstop" : `${totalHaltsBetween} ${totalHaltsBetween === 1 ? "stop" : "stops"}`}</span></div>
        <div className="end"><strong>{to.arrival ?? "—"}{arrivalOffset > 0 && <sup>+{arrivalOffset} {arrivalOffset === 1 ? "day" : "days"}</sup>}</strong><span>{to.name} ({to.code})</span></div>
      </div>
      <Button variant="ghost" type="button" className="train-details-toggle" aria-label={`${showStops ? "Hide stops" : "View stops"} for ${train.name}`}
        aria-expanded={showStops} aria-controls={stopsId} onClick={() => setShowStops((open) => !open)}>
        {showStops ? "Hide stops" : "View stops"} <ChevronDown size={16} aria-hidden="true" />
      </Button>
      <div id={stopsId} hidden={!showStops}>
        {showStops && <JourneyStops result={result} />}
      </div>
    </motion.li>
  );
}

function JourneyStops({ result }: { result: ScheduledTrain }) {
  const { train, from, to } = result;
  const timetable = useQuery(trainTimetableQuery(train.number));
  if (timetable.isPending) return <p className="flow-sub" role="status">Loading scheduled stops…</p>;
  if (!timetable.data) return (
    <div>
      <p className="flow-sub" role="alert">{timetable.error?.message}</p>
      <Button variant="ghost" type="button" onClick={() => void timetable.refetch()} disabled={timetable.isFetching}>Retry loading stops</Button>
    </div>
  );

  const route = timetable.data;
  const boarding = route.findIndex((stop) => stop.sequence === from.sequence && stop.station.code === from.code);
  const destination = route.findIndex((stop) => stop.sequence === to.sequence && stop.station.code === to.code);
  if (boarding < 0 || destination <= boarding) {
    return <p className="flow-sub" role="status">Scheduled stops are unavailable for this part of the journey.</p>;
  }

  return (
    <table className="train-stops">
      <caption className="sr-only">Scheduled stops from {from.name} to {to.name}, times in IST</caption>
      <thead><tr><th scope="col">Station</th><th scope="col">Arrival</th><th scope="col">Departure</th></tr></thead>
      <tbody>
        {route.slice(boarding, destination + 1).map((stop) => (
          <tr key={stop.sequence}>
            <th scope="row">{stop.station.name} <small>{stop.station.code}</small></th>
            <td>{stop.sequence === from.sequence ? "—" : formatStopTime(stop.arrival, stop.arrivalDay)}</td>
            <td>{stop.sequence === to.sequence ? "—" : formatStopTime(stop.departure, stop.departureDay)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  function formatStopTime(time: string | null | undefined, day: number | null | undefined) {
    if (!time) return "—";
    const offset = (day ?? from.day) - from.day;
    return <>{time}{offset > 0 && <small className="train-stop-offset">+{offset} {offset === 1 ? "day" : "days"}</small>}</>;
  }
}
