import type { JourneySearchInput } from "../journey.schemas.js";
import { RailRadarProvider } from "../../../integrations/railway/RailRadarProvider.js";

export class JourneyService {
  private provider: RailRadarProvider;

  constructor() {
    this.provider = new RailRadarProvider();
  }

  /**
   * Finds direct trains between source and destination stations on a specific date.
   */
  async findDirectJourneys(input: JourneySearchInput) {
    try {
      const data = await this.provider.getTrainsBetweenStations(
        input.source,
        input.destination,
        input.date
      );
      return data;
    } catch (error) {
      console.error("Error fetching direct journeys:", error);
      throw new Error("Failed to fetch direct journeys");
    }
  }
}
