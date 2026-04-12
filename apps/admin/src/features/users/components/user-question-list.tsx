'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UserQuestion } from '../hooks/use-user-detail';

export function UserQuestionList({ questions }: { questions: UserQuestion[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Questions
        <span className="ml-1.5 text-foreground">{questions.length}</span>
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Text</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((question) => (
            <TableRow key={question.id}>
              <TableCell className="text-sm max-w-xs truncate">{question.text || '-'}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${question.isArchived ? 'bg-muted-foreground/40' : 'bg-green-500'}`}
                  />
                  {question.isArchived ? 'Archived' : 'Active'}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {questions.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                No questions
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
