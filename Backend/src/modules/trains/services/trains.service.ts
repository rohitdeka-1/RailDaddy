import { RailRadarProvider } from "../../../integrations/railway/RailRadarProvider.js";

export class TrainsService {
  private provider: RailRadarProvider;

  constructor() {
    this.provider = new RailRadarProvider();
  }

  async getTrainByNo(trainNo: string) {
    return this.provider.getTrainDetails(trainNo, true);
  }
}
