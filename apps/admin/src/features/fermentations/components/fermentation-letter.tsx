'use client';

import type { LetterData } from '../hooks/use-fermentation-detail';

interface FermentationLetterProps {
  letter: LetterData;
}

export function FermentationLetter({ letter }: FermentationLetterProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Letter</h3>
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="text-sm leading-[1.8] text-foreground/90 whitespace-pre-wrap">
          {letter.bodyText}
        </p>
      </div>
    </section>
  );
}
