import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRouteWithContext, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { format } from "date-fns";
import { afterEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

vi.mock("@/routes/__root", () => {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => (
      <QueryClientProvider client={root.useRouteContext().queryClient}><Outlet /></QueryClientProvider>
    ),
  });
  return { Route: root };
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

it("searches the selected stations and date and shows the provider's timetable", async () => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  const ujjain = { code: "UJN", name: "Ujjain Jn", city: "Ujjain" };
  const indore = { code: "INDB", name: "Indore Junction", city: "Indore" };
  const timetablePath = "/api/v1/trains/19304";
  const fetchRailway = vi.fn(async (path: string) => {
    const url = new URL(path, "http://localhost");
    if (url.pathname === "/api/v1/users/me") return new Response(null, { status: 401 });
    if (url.pathname === "/api/v1/journey/stations") return Response.json({ success: true, data: [ujjain] });
    if (url.pathname === "/api/v1/journey/ask") return Response.json({ answer: "Check the booking channel for every leg." });
    if (url.pathname === "/api/v1/journey/plan") {
      const date = "2026-11-20";
      const dewas = { code: "DWX", name: "Dewas Junction", date };
      return Response.json({ success: true, data: { itineraries: [{
        legs: [
          { train: { number: "19304", name: "Bhopal - Indore Express" }, from: { ...ujjain, date, departure: "13:00" }, to: { ...dewas, arrival: "14:00" } },
          { train: { number: "22984", name: "Indore Express" }, from: { ...dewas, departure: "15:00" }, to: { ...indore, date, arrival: "16:00" } },
        ],
        transfers: [{ waitMinutes: 60 }],
        totalDurationMinutes: 180,
      }] } });
    }
    if (url.pathname === timetablePath) return Response.json({ success: true, data: { route: [
      { sequence: 1, station: { code: "BPL", name: "Bhopal Junction" }, departure: "19:00", departureDay: 2 },
      { sequence: 25, station: ujjain, departure: "23:05", departureDay: 2 },
      { sequence: 32, station: { code: "DWX", name: "Dewas Junction" }, arrival: "23:58", arrivalDay: 2, departure: "00:03", departureDay: 3 },
      { sequence: 37, station: indore, arrival: "00:45", arrivalDay: 3, departure: "00:50", departureDay: 3 },
    ] } });
    return Response.json({ success: true, data: {
      from: ujjain,
      to: indore,
      trains: [{
        train: { number: "19304", name: "Bhopal - Indore Express", type: "Mail/Express" },
        from: { ...ujjain, departure: "23:05", day: 2, sequence: 25 },
        to: { ...indore, arrival: "00:45", day: 3, sequence: 37 },
        duration: 100,
        totalHaltsBetween: 1,
      }],
    } });
  });
  vi.stubGlobal("fetch", fetchRailway);
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);

  fireEvent.change(await screen.findByRole("combobox", { name: "From" }), { target: { value: "Ujjain" } });
  fireEvent.click(await screen.findByRole("option", { name: /Ujjain Jn/ }));
  fireEvent.change(screen.getByRole("combobox", { name: "To" }), { target: { value: "INDB" } });
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  fireEvent.click(screen.getByRole("button", { name: "Find my train" }));

  expect(await screen.findByRole("heading", { name: "Bhopal - Indore Express" })).toBeInTheDocument();
  expect(screen.getByText("00:45")).toBeInTheDocument();
  expect(screen.getByText("+1 day")).toBeInTheDocument();
  expect(fetchRailway).toHaveBeenCalledWith(
    `/api/v1/journey/search?source=UJN&destination=INDB&date=${format(new Date(), "yyyy-MM-dd")}`,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );

  expect(fetchRailway.mock.calls.some(([path]) => path === timetablePath)).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /View stops/ }));
  const stops = within(await screen.findByRole("table", { name: /Scheduled stops/ }));
  expect(stops.queryByRole("rowheader", { name: /Bhopal Junction/ })).not.toBeInTheDocument();
  const dewas = within(stops.getByRole("row", { name: /Dewas Junction/ }));
  expect(dewas.getByRole("cell", { name: "23:58" })).toBeInTheDocument();
  expect(dewas.getByRole("cell", { name: /00:03.*\+1 day/ })).toBeInTheDocument();
  expect(stops.queryByText("00:50")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Hide stops/ }));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /View stops/ }));
  expect(await screen.findByRole("table")).toBeInTheDocument();
  expect(fetchRailway.mock.calls.filter(([path]) => path === timetablePath)).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: "Plan a connecting trip" }));
  expect(screen.getByRole("spinbutton", { name: /Maximum budget/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Depart after (IST)"), { target: { value: "12:30" } });
  fireEvent.change(screen.getByLabelText("Avoid transfers at"), { target: { value: "  bpl, BPL " } });
  fireEvent.click(screen.getByRole("button", { name: "Find connections" }));
  expect(await screen.findByText(/Change at Dewas Junction/)).toBeInTheDocument();
  expect(fetchRailway).toHaveBeenCalledWith("/api/v1/journey/plan", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ source: "UJN", destination: "INDB", date: format(new Date(), "yyyy-MM-dd"), departAfter: "12:30", maxTransfers: 2, avoidTransfers: ["BPL"] }),
  }));

  fireEvent.click(screen.getByRole("button", { name: "Ask Daddy AI" }));
  const assistant = within(await screen.findByRole("dialog", { name: "Ask Daddy AI" }));
  fireEvent.click(assistant.getByRole("button", { name: "Can I check seats and fares?" }));
  const chat = within(assistant.getByRole("log", { name: "Conversation" }));
  const quickAnswer = chat.getByText(/authorized booking channel/).textContent;
  expect(quickAnswer).toBeTruthy();
  const composer = assistant.getByRole("textbox", { name: "Rail travel question" });
  fireEvent.change(composer, { target: { value: "What about connecting trains?" } });
  fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
  expect(fetchRailway.mock.calls.some(([path]) => path === "/api/v1/journey/ask")).toBe(false);
  fireEvent.keyDown(composer, { key: "Enter" });
  expect(await chat.findByText("Check the booking channel for every leg.")).toBeInTheDocument();
  expect(chat.getByText("What about connecting trains?")).toBeInTheDocument();
  expect(fetchRailway).toHaveBeenCalledWith("/api/v1/journey/ask", expect.objectContaining({
    body: JSON.stringify({
      question: "What about connecting trains?",
      trip: { source: "UJN", destination: "INDB", date: format(new Date(), "yyyy-MM-dd") },
      history: [{ question: "Can I check seats and fares?", answer: quickAnswer }],
    }),
  }));
  fireEvent.click(assistant.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Ask Daddy AI" }));
  const reopened = within(await screen.findByRole("dialog", { name: "Ask Daddy AI" }));
  expect(reopened.getByText("What about connecting trains?")).toBeInTheDocument();
  fireEvent.click(reopened.getByRole("button", { name: "New chat" }));
  expect(reopened.queryByText("What about connecting trains?")).not.toBeInTheDocument();
  expect(reopened.getByRole("button", { name: "Can I check seats and fares?" })).toBeInTheDocument();
  fireEvent.click(reopened.getByRole("button", { name: "Close" }));

  fireEvent.click(screen.getByRole("link", { name: "Edit search" }));
  expect(await screen.findByRole("combobox", { name: "From" })).toHaveValue("Ujjain Jn (UJN)");
  expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("Indore Junction");
});
