'use client';

import type { WorksheetData } from '../hooks/use-fermentation-detail';

interface FermentationWorksheetProps {
  worksheet: WorksheetData;
}

export function FermentationWorksheet({ worksheet }: FermentationWorksheetProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Analysis Worksheet
      </h3>
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-4">
        {worksheet.worksheetMarkdown && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {worksheet.worksheetMarkdown}
          </div>
        )}
        {worksheet.resultDiagramMarkdown && (
          <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground/80">
            {worksheet.resultDiagramMarkdown}
          </div>
        )}
      </div>
    </section>
  );
}
