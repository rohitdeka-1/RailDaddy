import { envConfig } from "../../config/envConfig.js";

const baseUrl = "https://api.railradar.in/v1";

async function fetchRailData(path: string) {
  const response = await fetch(baseUrl + path, {
    headers: {
      Authorization: `Bearer ${envConfig.RAIL_API}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`RailRadar Provider Error: ${response.statusText}`);
  }
  return response.json();
}

export function getTrainDetails(trainNo: string, haltsOnly = true) {
  return fetchRailData(`/trains/${encodeURIComponent(trainNo)}?haltsOnly=${haltsOnly}`);
}

export function getTrainsBetweenStations(source: string, destination: string, date: string) {
  const query = new URLSearchParams({ fromStation: source, toStation: destination, date });
  return fetchRailData(`/trainsBetweenStations?${query}`);
}
