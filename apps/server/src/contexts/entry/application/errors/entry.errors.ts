export class EntryNotFoundError extends Error {
  constructor(entryId: string) {
    super(`Entry not found: ${entryId}`);
    this.name = 'EntryNotFoundError';
  }
}
