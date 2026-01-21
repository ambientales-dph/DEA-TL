'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateTaskDescription } from '@/ai/flows/generate-task-descriptions';
import { getBoardById } from '@/lib/data';

export function NewTaskDialog({
  listId,
  boardId,
}: {
  listId: string;
  boardId: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateDesc = async () => {
    if (!title) {
      toast({
        title: 'Title is required',
        description: 'Please enter a task title to generate a description.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const board = getBoardById(boardId);
      const boardContent = `Board: ${board?.name}. Description: ${board?.desc}`;
      const similarTasks =
        board?.lists.flatMap((l) => l.cards.map((c) => c.name)) || [];

      const result = await generateTaskDescription({
        taskTitle: title,
        boardContent: boardContent,
        similarTasks: similarTasks.slice(0, 5), // limit context
      });
      setDescription(result.description);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error generating description',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTask = () => {
    // In a real app, this would call an action to add the task to Trello
    console.log('Adding task:', { title, description, listId });
    toast({
      title: 'Task Added (Mock)',
      description: `"${title}" has been added to the list.`,
    });
    setOpen(false);
    setTitle('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add a card...
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add a new task</DialogTitle>
          <DialogDescription>
            Enter the details for your new task. Use AI to generate a detailed
            description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Title
            </Label>
            <Input
              id="name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              placeholder="e.g. Design the new settings page"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right mt-2">
              Description
            </Label>
            <div className="col-span-3 space-y-2">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details to this card..."
              />
              <Button
                onClick={handleGenerateDesc}
                disabled={isGenerating}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate with AI'}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAddTask}>Add Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
