'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Lightbulb, PlusCircle, CircleDashed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestRelevantTasks } from '@/ai/flows/suggest-relevant-tasks';
import { useParams } from 'next/navigation';
import { getBoardById } from '@/lib/data';

export function AiTaskSuggester() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const params = useParams();
  const boardId = params.id as string | undefined;

  const handleSuggestTasks = async () => {
    if (!boardId) {
      toast({
        title: 'Select a board first',
        description:
          'You need to be on a board page to get task suggestions.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    setSuggestions([]);
    try {
      const board = getBoardById(boardId);
      if (!board) throw new Error('Board not found');

      const result = await suggestRelevantTasks({
        boardName: board.name,
        boardDescription: board.desc,
        existingTasks: board.lists.flatMap((l) => l.cards.map((c) => c.name)),
      });
      setSuggestions(result.suggestedTasks);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error suggesting tasks',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = (taskTitle: string) => {
    // In a real app, this would open the NewTaskDialog with the title pre-filled.
    toast({
      title: `Added "${taskTitle}" to backlog (Mock).`,
    });
  };

  return (
    <Popover onOpenChange={(open) => !open && setSuggestions([])}>
      <PopoverTrigger asChild>
        <Button variant="outline" onClick={handleSuggestTasks} disabled={!boardId}>
          {isLoading ? (
            <CircleDashed className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          Suggest Tasks
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">AI Task Suggestions</h4>
            <p className="text-sm text-muted-foreground">
              AI suggestions for your board. Click the plus to add one.
            </p>
          </div>
          <div className="grid gap-2">
            {isLoading && (
              <p className="text-sm text-muted-foreground">Generating...</p>
            )}
            {!isLoading && suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No suggestions available. Try generating some!
              </p>
            )}
            {suggestions.map((task, i) => (
              <div
                key={i}
                className="flex items-center justify-between group"
              >
                <p className="text-sm">{task}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => handleAddTask(task)}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
