import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import request from "supertest";
import journeyRouter from "../src/modules/journey/routes/journey.routes.js";
import trainsRouter from "../src/modules/trains/routes/trains.routes.js";
import { envConfig } from "../src/config/envConfig.js";

test("journey routes use RailRadar's station and dated timetable endpoints", async (context) => {
  const app = express();
  app.use("/journey", journeyRouter);
  const client = request(app);
  const originalKey = envConfig.RAIL_API;
  envConfig.RAIL_API = "test-only-railradar-key";
  context.after(() => { envConfig.RAIL_API = originalKey; });

  const stations = { success: true, data: [{ code: "NDLS", name: "New Delhi", city: "Delhi" }] };
  const journeys = { success: true, data: { count: 0, trains: [] } };
  const upstream = context.mock.method(globalThis, "fetch", async (input: string, options?: RequestInit) => {
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer test-only-railradar-key");
    const url = new URL(input);
    if (url.pathname === "/v1/lookup/search/stations") return Response.json(stations);
    if (url.pathname === "/v1/trains/between/NDLS/JP") return Response.json(journeys);
    return new Response(null, { status: 404 });
  });

  await client.get("/journey/stations").query({ q: "New Delhi" }).expect(200, stations);
  await client.get("/journey/search").query({ source: "ndls", destination: "JP", date: "2028-02-29" }).expect(200, journeys);
  await client.get("/journey/search").query({ source: "ndls", destination: "NDLS", date: "2028-02-29" }).expect(400);
  await client.get("/journey/search").query({ source: "NDLS", destination: "JP", date: "2027-02-29" }).expect(400);
  await client.get("/journey/search").query({ source: "NDLS", destination: "UNKNOWN", date: "2028-02-29" }).expect(404);
  assert.equal(upstream.mock.callCount(), 3);
  assert.equal(new URL(upstream.mock.calls[0]!.arguments[0]).searchParams.get("q"), "New Delhi");
  assert.equal(new URL(upstream.mock.calls[1]!.arguments[0]).searchParams.get("date"), "2028-02-29");
});

test("connecting journeys send time filters and exclude either side of a blocked transfer", async (context) => {
  const app = express();
  app.use("/journey", journeyRouter);
  const key = envConfig.RAIL_API;
  envConfig.RAIL_API = "test-only-railradar-key";
  context.after(() => { envConfig.RAIL_API = key; });

  const date = "2028-02-29";
  const stop = (code: string) => ({ code, name: code, date });
  const leg = (number: string, from: string, to: string) => ({
    train: { number, name: number },
    from: { ...stop(from), departure: "08:00" },
    to: { ...stop(to), arrival: "09:00" },
  });
  const option = (alight: string, board: string) => ({
    legs: [leg("10001", "NDLS", alight), leg("10002", board, "JP")],
    transfers: [{ waitMinutes: 60 }],
    totalDurationMinutes: 180,
  });
  const allowed = option("RE", "RE");
  const fetchRail = context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "https://api.railradar.in/v1/journeys/plan");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(String(options.body)), {
      stops: ["NDLS", "JP"], date, minTransfers: 1, maxTransfers: 1, maxItineraries: 30, departAfter: "07:30", arriveBefore: "20:00",
    });
    return Response.json({ success: true, data: { segments: [{ plan: {
      itineraries: [option("MTJ", "BKI"), option("BKI", "MTJ"), allowed],
    } }] } });
  });

  const params = { source: "NDLS", destination: "JP", date, departAfter: "07:30", arriveBefore: "20:00", maxTransfers: 1, avoidTransfers: ["mtj"] };
  const client = request(app);
  await client.post("/journey/plan").send(params).expect(200, { success: true, data: { itineraries: [allowed] } });
  await client.post("/journey/plan").send({ ...params, departAfter: "24:00" }).expect(400);
  assert.equal(fetchRail.mock.callCount(), 1);
});

test("custom journey questions use Gemini only when the backend is configured", async (context) => {
  const app = express();
  app.use("/journey", journeyRouter);
  const originalKey = envConfig.GEMINI_API_KEY;
  const originalModel = envConfig.GEMINI_CHAT_MODEL;
  context.after(() => {
    envConfig.GEMINI_API_KEY = originalKey;
    envConfig.GEMINI_CHAT_MODEL = originalModel;
  });

  const client = request(app);
  const question = { question: "What about when changing stations?", trip: { source: "NDLS", destination: "JP", date: "2028-02-29" } };
  const history = [{ question: "How do transfers work?", answer: "Allow time between trains." }];
  const input = { ...question, history };
  envConfig.GEMINI_API_KEY = undefined;
  await client.post("/journey/ask").send(input).expect(503);

  envConfig.GEMINI_API_KEY = "test-only-gemini-key";
  envConfig.GEMINI_CHAT_MODEL = "test-model";
  const generate = context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent");
    assert.equal(new Headers(options.headers).get("x-goog-api-key"), "test-only-gemini-key");
    const body = JSON.parse(String(options.body));
    assert.deepEqual(body.contents, [
      { role: "user", parts: [{ text: history[0]!.question }] },
      { role: "model", parts: [{ text: history[0]!.answer }] },
      { role: "user", parts: [{ text: JSON.stringify(question) }] },
    ]);
    return Response.json({ candidates: [{ content: { parts: [
      { thought: true, text: "Internal thought" },
      { text: "Leave time to change stations." },
    ] } }] });
  });
  await client.post("/journey/ask").send(input).expect(200, { answer: "Leave time to change stations." });
  assert.equal(generate.mock.callCount(), 1);
});

test("seat enquiries use RailCore and return the observation for the requested segment and class", async (context) => {
  const app = express();
  app.use("/trains", trainsRouter);
  const originalKey = envConfig.RAIL_CORE_API;
  envConfig.RAIL_CORE_API = "test-only-railcore-key";
  context.after(() => { envConfig.RAIL_CORE_API = originalKey; });

  const query = { from: "NDLS", to: "JP", date: "2028-02-29", class: "CC", quota: "GN" };
  const observedAt = "2028-02-23T13:01:51+05:30";
  const upstream = context.mock.method(globalThis, "fetch", async (input: string, options: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.origin + url.pathname, "https://ir.railcore.tech/v1/availability/seats");
    assert.equal(new Headers(options.headers).get("X-RailCore-Key"), "test-only-railcore-key");
    assert.deepEqual(Object.fromEntries(url.searchParams), { train_number: "12015", ...query, quota: url.searchParams.get("quota") });
    if (url.searchParams.get("quota") === "TQ") {
      return Response.json({ error: { message: "Tatkal booking has not opened." } }, { status: 422 });
    }

    return Response.json({ success: true, data: {
      train_number: "12015", from_station_code: "NDLS", to_station_code: "JP", journey_date: query.date, quota: "GN",
      classes: [{ class_code: "CC", status: "AVAILABLE", availability_text: "AVAILABLE-9", available_count: 9, total_fare: 900, last_updated_at: observedAt }],
    } });
  });

  const client = request(app);
  await client.get("/trains/12015/availability").query({ ...query, from: "ndls" })
    .expect("Cache-Control", "no-store").expect(200, {
      data: { status: "AVAILABLE", description: "AVAILABLE-9", availableCount: 9, totalFare: 900, observedAt },
    });
  await client.get("/trains/12015/availability").query({ ...query, quota: "TQ" })
    .expect(422, { message: "Tatkal booking has not opened." });
  await client.get("/trains/12015/availability").query({ ...query, quota: "PT" }).expect(400);
  assert.equal(upstream.mock.callCount(), 2);
});
