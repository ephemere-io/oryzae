import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway.js';
import { EntryNotFoundError } from '../errors/entry.errors.js';

export class DeleteEntryUsecase {
  constructor(private entryRepo: EntryRepositoryGateway) {}

  async execute(entryId: string): Promise<void> {
    const existing = await this.entryRepo.findById(entryId);
    if (!existing) throw new EntryNotFoundError(entryId);

    await this.entryRepo.delete(entryId);
  }
}
