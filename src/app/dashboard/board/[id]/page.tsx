import { getBoardById } from '@/lib/data';
import { TaskColumn } from '@/components/dashboard/task-column';
import { notFound } from 'next/navigation';
import { AiTaskSuggester } from '@/components/dashboard/ai-task-suggester';

export default function BoardPage({ params }: { params: { id: string } }) {
  const board = getBoardById(params.id);

  if (!board) {
    notFound();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.24))]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold font-headline">{board.name}</h1>
        <AiTaskSuggester />
      </div>
      <div className="flex-1 overflow-x-auto">
        <div className="inline-flex gap-4 pb-4 h-full">
          {board.lists.map((list) => (
            <TaskColumn
              key={list.id}
              list={list}
              members={board.members}
              boardId={board.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
