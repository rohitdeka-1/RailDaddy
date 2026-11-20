import { envConfig } from "../../config/envConfig.js";

const baseUrl = "https://api.railradar.in/v1";

export class RailRadarError extends Error {
  constructor(public readonly status: number) {
    super(`RailRadar returned HTTP ${status}`);
  }
}

async function fetchRailData(path: string, body?: Record<string, unknown>) {
  if (!envConfig.RAIL_API) throw new Error("RAIL_API is required for RailRadar requests");
  const response = await fetch(baseUrl + path, {
    ...(body && { method: "POST", body: JSON.stringify(body) }),
    headers: {
      Authorization: `Bearer ${envConfig.RAIL_API}`,
      Accept: "application/json",
      ...(body && { "Content-Type": "application/json" }),
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new RailRadarError(response.status);
  }
  return response.json();
}

export function getTrainDetails(trainNo: string, haltsOnly = true) {
  return fetchRailData(`/trains/${encodeURIComponent(trainNo)}?haltsOnly=${haltsOnly}`);
}

export function getTrainsBetweenStations(source: string, destination: string, date: string) {
  const query = new URLSearchParams({ date });
  return fetchRailData(`/trains/between/${encodeURIComponent(source)}/${encodeURIComponent(destination)}?${query}`);
}

export function searchStations(keyword: string) {
  const query = new URLSearchParams({ q: keyword, limit: "8" });
  return fetchRailData(`/lookup/search/stations?${query}`);
}

export function planRailJourney(options: Record<string, unknown>) {
  return fetchRailData("/journeys/plan", options);
}
