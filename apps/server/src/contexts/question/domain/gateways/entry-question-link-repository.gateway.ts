export interface EntryQuestionLinkRepositoryGateway {
  link(entryId: string, questionId: string): Promise<void>;
  unlink(entryId: string, questionId: string): Promise<void>;
  listQuestionIdsByEntryId(entryId: string): Promise<string[]>;
}
