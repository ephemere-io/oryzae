import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FermentationRepositoryGateway,
  FermentationResultWithDetails,
  JarPositionUpdate,
} from '../../domain/gateways/fermentation-repository.gateway.js';
import { AnalysisWorksheet } from '../../domain/models/analysis-worksheet.js';
import { ExtractedSnippet } from '../../domain/models/extracted-snippet.js';
import { FermentationResult } from '../../domain/models/fermentation-result.js';
import { Keyword } from '../../domain/models/keyword.js';
import { Letter } from '../../domain/models/letter.js';

function readJarCoord(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export class SupabaseFermentationRepository implements FermentationRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async save(result: FermentationResult): Promise<void> {
    const props = result.toProps();
    const { error } = await this.supabase.from('fermentation_results').insert({
      id: props.id,
      user_id: props.userId,
      question_id: props.questionId,
      target_period: props.targetPeriod,
      status: props.status,
      error_message: props.errorMessage,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    if (error) throw new Error(`Failed to save fermentation result: ${error.message}`);
  }

  async update(result: FermentationResult): Promise<void> {
    const props = result.toProps();
    const { error } = await this.supabase
      .from('fermentation_results')
      .update({
        status: props.status,
        generation_id: props.generationId,
        error_message: props.errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', props.id);
    if (error) throw new Error(`Failed to update fermentation result: ${error.message}`);
  }

  async findById(id: string): Promise<FermentationResult | null> {
    const { data, error } = await this.supabase
      .from('fermentation_results')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return FermentationResult.fromProps({
      id: data.id,
      userId: data.user_id,
      questionId: data.question_id,
      targetPeriod: data.target_period,
      status: data.status,
      generationId: data.generation_id ?? null,
      errorMessage: data.error_message ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  async findByIdWithDetails(id: string): Promise<FermentationResultWithDetails | null> {
    const result = await this.findById(id);
    if (!result) return null;

    const [worksheetRes, snippetsRes, letterRes, keywordsRes, scannedEntryIds] = await Promise.all([
      this.supabase
        .from('analysis_worksheets')
        .select('*')
        .eq('fermentation_result_id', id)
        .single(),
      this.supabase.from('extracted_snippets').select('*').eq('fermentation_result_id', id),
      this.supabase.from('letters').select('*').eq('fermentation_result_id', id).single(),
      this.supabase.from('keywords').select('*').eq('fermentation_result_id', id),
      this.listScannedEntryIds(id),
    ]);

    const worksheet = worksheetRes.data
      ? AnalysisWorksheet.fromProps({
          id: worksheetRes.data.id,
          fermentationResultId: worksheetRes.data.fermentation_result_id,
          worksheetMarkdown: worksheetRes.data.worksheet_markdown,
          resultDiagramMarkdown: worksheetRes.data.result_diagram_markdown,
          createdAt: worksheetRes.data.created_at,
          updatedAt: worksheetRes.data.updated_at,
        })
      : null;

    const snippets = (snippetsRes.data ?? []).map((row: Record<string, unknown>) =>
      ExtractedSnippet.fromProps({
        id: row.id as string,
        fermentationResultId: row.fermentation_result_id as string,
        snippetType: row.snippet_type as 'new_perspective' | 'deepen' | 'core',
        originalText: row.original_text as string,
        sourceDate: row.source_date as string,
        selectionReason: row.selection_reason as string,
        jarX: readJarCoord(row.jar_x),
        jarY: readJarCoord(row.jar_y),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }),
    );

    const letter = letterRes.data
      ? Letter.fromProps({
          id: letterRes.data.id,
          fermentationResultId: letterRes.data.fermentation_result_id,
          bodyText: letterRes.data.body_text,
          jarX: readJarCoord(letterRes.data.jar_x),
          jarY: readJarCoord(letterRes.data.jar_y),
          createdAt: letterRes.data.created_at,
          updatedAt: letterRes.data.updated_at,
        })
      : null;

    const keywords = (keywordsRes.data ?? []).map((row: Record<string, unknown>) =>
      Keyword.fromProps({
        id: row.id as string,
        fermentationResultId: row.fermentation_result_id as string,
        keyword: row.keyword as string,
        description: row.description as string,
        jarX: readJarCoord(row.jar_x),
        jarY: readJarCoord(row.jar_y),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }),
    );

    return { result, worksheet, snippets, letter, keywords, scannedEntryIds };
  }

  async listByQuestionId(questionId: string): Promise<FermentationResult[]> {
    const { data, error } = await this.supabase
      .from('fermentation_results')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list fermentation results: ${error.message}`);
    return (data ?? []).map((row: Record<string, string>) =>
      FermentationResult.fromProps({
        id: row.id,
        userId: row.user_id,
        questionId: row.question_id,
        targetPeriod: row.target_period,
        status: row.status as 'pending' | 'processing' | 'completed' | 'failed',
        generationId: row.generation_id ?? null,
        errorMessage: row.error_message ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }

  async saveScannedEntries(fermentationResultId: string, entryIds: string[]): Promise<void> {
    if (entryIds.length === 0) return;
    const rows = entryIds.map((entryId) => ({
      fermentation_result_id: fermentationResultId,
      entry_id: entryId,
    }));
    const { error } = await this.supabase
      .from('fermentation_scanned_entries')
      .upsert(rows, { onConflict: 'fermentation_result_id,entry_id' });
    if (error) throw new Error(`Failed to save scanned entries: ${error.message}`);
  }

  async listScannedEntryIds(fermentationResultId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('fermentation_scanned_entries')
      .select('entry_id, created_at')
      .eq('fermentation_result_id', fermentationResultId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to list scanned entries: ${error.message}`);
    return (data ?? []).map((row: { entry_id: string }) => row.entry_id);
  }

  async saveWorksheet(worksheet: AnalysisWorksheet): Promise<void> {
    const props = worksheet.toProps();
    const { error } = await this.supabase.from('analysis_worksheets').insert({
      id: props.id,
      fermentation_result_id: props.fermentationResultId,
      worksheet_markdown: props.worksheetMarkdown,
      result_diagram_markdown: props.resultDiagramMarkdown,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    if (error) throw new Error(`Failed to save worksheet: ${error.message}`);
  }

  async saveSnippets(snippets: ExtractedSnippet[]): Promise<void> {
    if (snippets.length === 0) return;
    const rows = snippets.map((s) => {
      const p = s.toProps();
      return {
        id: p.id,
        fermentation_result_id: p.fermentationResultId,
        snippet_type: p.snippetType,
        original_text: p.originalText,
        source_date: p.sourceDate,
        selection_reason: p.selectionReason,
        jar_x: p.jarX,
        jar_y: p.jarY,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      };
    });
    const { error } = await this.supabase.from('extracted_snippets').insert(rows);
    if (error) throw new Error(`Failed to save snippets: ${error.message}`);
  }

  async saveLetter(letter: Letter): Promise<void> {
    const props = letter.toProps();
    const { error } = await this.supabase.from('letters').insert({
      id: props.id,
      fermentation_result_id: props.fermentationResultId,
      body_text: props.bodyText,
      jar_x: props.jarX,
      jar_y: props.jarY,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    if (error) throw new Error(`Failed to save letter: ${error.message}`);
  }

  async saveKeywords(keywords: Keyword[]): Promise<void> {
    if (keywords.length === 0) return;
    const rows = keywords.map((k) => {
      const p = k.toProps();
      return {
        id: p.id,
        fermentation_result_id: p.fermentationResultId,
        keyword: p.keyword,
        description: p.description,
        jar_x: p.jarX,
        jar_y: p.jarY,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      };
    });
    const { error } = await this.supabase.from('keywords').insert(rows);
    if (error) throw new Error(`Failed to save keywords: ${error.message}`);
  }

  async updateKeywordJarPositions(updates: JarPositionUpdate[]): Promise<void> {
    await this.batchUpdateJarPositions('keywords', updates);
  }

  async updateSnippetJarPositions(updates: JarPositionUpdate[]): Promise<void> {
    await this.batchUpdateJarPositions('extracted_snippets', updates);
  }

  async updateLetterJarPositions(updates: JarPositionUpdate[]): Promise<void> {
    await this.batchUpdateJarPositions('letters', updates);
  }

  private async batchUpdateJarPositions(
    table: 'keywords' | 'extracted_snippets' | 'letters',
    updates: JarPositionUpdate[],
  ): Promise<void> {
    if (updates.length === 0) return;
    const now = new Date().toISOString();
    const results = await Promise.all(
      updates.map((u) =>
        this.supabase
          .from(table)
          .update({ jar_x: u.jarX, jar_y: u.jarY, updated_at: now })
          .eq('id', u.id),
      ),
    );
    for (const res of results) {
      if (res.error)
        throw new Error(`Failed to update ${table} jar positions: ${res.error.message}`);
    }
  }
}
