import { queryOptions } from "@tanstack/react-query";

export type Station = { name: string; code: string; city: string | null };

const stations: Station[] = [
  { name: "New Delhi", code: "NDLS", city: "Delhi" },
  { name: "Mumbai Central", code: "MMCT", city: "Mumbai" },
  { name: "Indore Junction", code: "INDB", city: "Indore" },
  { name: "Bengaluru", code: "SBC", city: "Bengaluru" },
  { name: "Chennai Central", code: "MAS", city: "Chennai" },
  { name: "Kolkata", code: "HWH", city: "Howrah" },
  { name: "Jaipur", code: "JP", city: "Jaipur" },
  { name: "Hyderabad", code: "HYB", city: "Hyderabad" },
  { name: "Pune", code: "PUNE", city: "Pune" },
  { name: "Ahmedabad", code: "ADI", city: "Ahmedabad" },
  { name: "Goa", code: "MAO", city: "Madgaon" },
  { name: "Varanasi", code: "BSB", city: "Varanasi" },
  { name: "Shimla", code: "SML", city: "Shimla" },
  { name: "Lucknow", code: "LKO", city: "Lucknow" },
  { name: "Bhopal", code: "BPL", city: "Bhopal" },
  { name: "Chandigarh", code: "CDG", city: "Chandigarh" },
  { name: "Patna", code: "PNBE", city: "Patna" },
  { name: "Kochi", code: "ERS", city: "Ernakulam" },
  { name: "Udaipur", code: "UDZ", city: "Udaipur" },
  { name: "Darjeeling", code: "NJP", city: "New Jalpaiguri" },
  { name: "Amritsar", code: "ASR", city: "Amritsar" },
  { name: "Agra Cantt", code: "AGC", city: "Agra" },
];
export const popularStationNames = ["New Delhi", "Mumbai Central", "Bengaluru", "Indore Junction", "Goa"];
export function findStation(value: string) {
  const query = value.trim().toUpperCase();
  return stations.find(({ name, code }) => name.toUpperCase() === query || code === query);
}

const stationCode = /^[A-Z0-9]{1,10}$/;

export function stationCodeFor(value: string) {
  const text = value.trim();
  return findStation(text)?.code ?? /\(([A-Z0-9]{1,10})\)$/.exec(text)?.[1]
    ?? (stationCode.test(text) ? text : undefined);
}

export function stationLabel({ name, code }: Pick<Station, "name" | "code">) {
  return findStation(code)?.name === name ? name : `${name} (${code})`;
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = (row[0] ?? 0); row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = (row[j] ?? 0);
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return (row[b.length] ?? 0);
}

/** Ranks stations by code, name, city, then typo-tolerant similarity. */
function localStations(query: string): Station[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = stations.map((s) => {
    const name = s.name.toLowerCase(), city = s.city?.toLowerCase() ?? "", code = s.code.toLowerCase();
    let score = 99;
    if (code === q) score = 0;
    else if (name.startsWith(q) || city.startsWith(q) || code.startsWith(q)) score = 1;
    else if (name.includes(q) || city.includes(q)) score = 2;
    else if (q.length >= 3) {
      const d = Math.min(editDistance(q, name.slice(0, q.length)), editDistance(q, city.slice(0, q.length)), editDistance(q, name), editDistance(q, city));
      if (d <= (q.length >= 6 ? 2 : 1)) score = 3 + d;
    }
    return { s, score };
  });
  return scored.filter((x) => x.score < 99).sort((a, b) => a.score - b.score).slice(0, 8).map((x) => x.s);
}

export function stationSuggestions(keyword: string, remote: Station[] = []) {
  const query = keyword.toUpperCase();
  const exactMatch = findStation(keyword);
  const combined = new Map<string, Station>();
  if (exactMatch) combined.set(exactMatch.code, exactMatch);
  for (const station of remote) combined.set(station.code, station);
  for (const station of localStations(keyword)) {
    if (!combined.has(station.code)) combined.set(station.code, station);
  }
  return [...combined.values()].sort((a, b) =>
    Number(b.code === query) - Number(a.code === query)).slice(0, 8);
}

type StationStop = Pick<Station, "code" | "name"> & { day: number; sequence: number };

type TimetableStop = {
  sequence: number;
  station: Pick<Station, "code" | "name">;
  arrival?: string | null;
  arrivalDay?: number | null;
  departure?: string | null;
  departureDay?: number | null;
};

export type ScheduledTrain = {
  train: { number: string; name: string; type: string };
  from: StationStop & { departure: string | null };
  to: StationStop & { arrival: string | null };
  duration: number;
  totalHaltsBetween: number;
};

type TrainSearch = {
  from: Pick<Station, "code" | "name">;
  to: Pick<Station, "code" | "name">;
  trains: ScheduledTrain[];
};

async function fetchRailway<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true || body.data == null) {
    throw new Error(body?.message ?? "Railway data is temporarily unavailable. Try again shortly.");
  }
  return body.data;
}

export function stationSearchQuery(keyword: string) {
  return queryOptions({
    queryKey: ["railway-stations", keyword],
    queryFn: ({ signal }) => fetchRailway<Station[]>(`journey/stations?${new URLSearchParams({ q: keyword })}`, signal),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function trainSearchQuery(source: string, destination: string, date: string) {
  return queryOptions({
    queryKey: ["train-search", source, destination, date],
    queryFn: ({ signal }) => fetchRailway<TrainSearch>(`journey/search?${new URLSearchParams({ source, destination, date })}`, signal),
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function trainTimetableQuery(number: string) {
  return queryOptions({
    queryKey: ["train-timetable", number],
    async queryFn({ signal }) {
      const { route } = await fetchRailway<{ route: TimetableStop[] }>(`trains/${encodeURIComponent(number)}`, signal);
      if (!Array.isArray(route)) throw new Error("The train timetable is temporarily unavailable.");
      return route;
    },
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
}

export type JourneyTrip = { source: string; destination: string; date: string };
export type JourneyFilters = {
  departAfter?: string | undefined;
  arriveBefore?: string | undefined;
  maxTransfers: 1 | 2;
  avoidTransfers: string[];
};

type DatedStation = Pick<Station, "code" | "name"> & { date: string };
export type ConnectionPlan = {
  legs: {
    train: { number: string; name: string };
    from: DatedStation & { departure: string };
    to: DatedStation & { arrival: string };
  }[];
  transfers: { waitMinutes: number }[];
  totalDurationMinutes: number;
};

export async function postJourney<T>(path: "plan" | "ask", input: object): Promise<T> {
  const response = await fetch(`/api/v1/journey/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.message ?? "The journey service is unavailable. Try again shortly.");
  return body;
}
