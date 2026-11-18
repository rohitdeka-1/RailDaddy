import { createFileRoute, redirect } from "@tanstack/react-router";
import { findTrain, offerFor, parseTrip } from "@/lib/trip";

export const Route = createFileRoute("/seats")({
  validateSearch: parseTrip,
  beforeLoad: ({ search }) => {
    if (offerFor(findTrain(search), search.cls)) {
      throw redirect({ to: "/passengers", search, replace: true });
    }
    throw redirect({ to: "/trains", search: { ...search, train: undefined }, replace: true });
  },
});
