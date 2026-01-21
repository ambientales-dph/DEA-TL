'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FeedbackButtonProps {
    onClick: () => void;
}

export function FeedbackButton({ onClick }: FeedbackButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            size="icon"
            className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-2xl bg-cyan-500 hover:bg-cyan-600 text-white z-50 transition-all duration-200 ease-in-out hover:scale-110"
          >
            <MessageSquare className="h-8 w-8" />
            <span className="sr-only">Enviar Comentarios</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Comentarios</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
