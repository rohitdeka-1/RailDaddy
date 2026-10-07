import type { User } from "../../../generated/prisma/index.js";
import { UsersRepository } from "../repositories/users.repository.js";
import type { UpdateProfileInput } from "../users.schemas.js";

export class UsersService {
  private repository: UsersRepository;

  constructor() {
    this.repository = new UsersRepository();
  }

  async ensureUserExists(cognitoSub: string): Promise<User> {
    const user = await this.repository.findOrCreate(cognitoSub);
    return user;
  }

  async getProfile(cognitoSub: string): Promise<User | null> {
    const user = await this.repository.findByCognitoSub(cognitoSub);
    return user;
  }

  async saveProfile(cognitoSub: string, input: UpdateProfileInput): Promise<User> {
    const user = await this.repository.save(cognitoSub, input);
    return user;
  }
}
