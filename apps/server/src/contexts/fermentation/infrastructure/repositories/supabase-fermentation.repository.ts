import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FermentationRepositoryGateway,
  FermentationResultWithDetails,
} from '../../domain/gateways/fermentation-repository.gateway.js';
import { AnalysisWorksheet } from '../../domain/models/analysis-worksheet.js';
import { ExtractedSnippet } from '../../domain/models/extracted-snippet.js';
import { FermentationResult } from '../../domain/models/fermentation-result.js';
import { Keyword } from '../../domain/models/keyword.js';
import { Letter } from '../../domain/models/letter.js';

export class SupabaseFermentationRepository implements FermentationRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async save(result: FermentationResult): Promise<void> {
    const props = result.toProps();
    const { error } = await this.supabase.from('fermentation_results').insert({
      id: props.id,
      user_id: props.userId,
      question_id: props.questionId,
      entry_id: props.entryId,
      target_period: props.targetPeriod,
      status: props.status,
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
      entryId: data.entry_id,
      targetPeriod: data.target_period,
      status: data.status,
      generationId: data.generation_id ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  async findByIdWithDetails(id: string): Promise<FermentationResultWithDetails | null> {
    const result = await this.findById(id);
    if (!result) return null;

    const [worksheetRes, snippetsRes, letterRes, keywordsRes] = await Promise.all([
      this.supabase
        .from('analysis_worksheets')
        .select('*')
        .eq('fermentation_result_id', id)
        .single(),
      this.supabase.from('extracted_snippets').select('*').eq('fermentation_result_id', id),
      this.supabase.from('letters').select('*').eq('fermentation_result_id', id).single(),
      this.supabase.from('keywords').select('*').eq('fermentation_result_id', id),
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

    const snippets = (snippetsRes.data ?? []).map((row: Record<string, string>) =>
      ExtractedSnippet.fromProps({
        id: row.id,
        fermentationResultId: row.fermentation_result_id,
        snippetType: row.snippet_type as 'new_perspective' | 'deepen' | 'core',
        originalText: row.original_text,
        sourceDate: row.source_date,
        selectionReason: row.selection_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );

    const letter = letterRes.data
      ? Letter.fromProps({
          id: letterRes.data.id,
          fermentationResultId: letterRes.data.fermentation_result_id,
          bodyText: letterRes.data.body_text,
          createdAt: letterRes.data.created_at,
          updatedAt: letterRes.data.updated_at,
        })
      : null;

    const keywords = (keywordsRes.data ?? []).map((row: Record<string, string>) =>
      Keyword.fromProps({
        id: row.id,
        fermentationResultId: row.fermentation_result_id,
        keyword: row.keyword,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );

    return { result, worksheet, snippets, letter, keywords };
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
        entryId: row.entry_id,
        targetPeriod: row.target_period,
        status: row.status as 'pending' | 'processing' | 'completed' | 'failed',
        generationId: row.generation_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
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
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      };
    });
    const { error } = await this.supabase.from('keywords').insert(rows);
    if (error) throw new Error(`Failed to save keywords: ${error.message}`);
  }
}
