import { envConfig } from "../../config/envConfig.js";

export class RailRadarProvider {
  private baseUrl = "https://api.railradar.in/v1";

  private get headers() {
    return {
      "Authorization": `Bearer ${envConfig.RAIL_API}`,
      "Content-Type": "application/json"
    };
  }

  async getTrainDetails(trainNo: string, haltsOnly: boolean = true) {
    const response = await fetch(`${this.baseUrl}/trains/${trainNo}?haltsOnly=${haltsOnly}`, {
      headers: this.headers
    });

    if (!response.ok) {
      throw new Error(`RailRadar Provider Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getTrainsBetweenStations(fromStation: string, toStation: string, date: string) {
    const response = await fetch(
      `${this.baseUrl}/trainsBetweenStations?fromStation=${fromStation}&toStation=${toStation}&date=${date}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`RailRadar Provider Error: ${response.statusText}`);
    }

    return response.json();
  }
}
