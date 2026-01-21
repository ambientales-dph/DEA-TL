import type { List, Member, Board } from '@/lib/types';
import { TaskCard } from './task-card';
import { NewTaskDialog } from './new-task-dialog';

interface TaskColumnProps {
  list: List;
  members: Member[];
  boardId: Board['id'];
}

export function TaskColumn({ list, members, boardId }: TaskColumnProps) {
  return (
    <div className="w-72 flex-shrink-0 h-full">
      <div className="bg-muted/80 rounded-lg h-full flex flex-col">
        <div className="p-3 font-semibold text-foreground flex justify-between items-center">
          {list.name}
          <span className="text-sm font-normal text-muted-foreground">
            {list.cards.length}
          </span>
        </div>
        <div className="p-2 flex-1 overflow-y-auto space-y-2">
          {list.cards.map((card) => (
            <TaskCard key={card.id} card={card} members={members} />
          ))}
        </div>
        <div className="p-2 border-t">
          <NewTaskDialog listId={list.id} boardId={boardId} />
        </div>
      </div>
    </div>
  );
}
