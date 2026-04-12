'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Questions ({questions.length})</CardTitle>
      </CardHeader>
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
                <Badge variant={question.isArchived ? 'secondary' : 'default'}>
                  {question.isArchived ? 'Archived' : 'Active'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {questions.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                No questions
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
