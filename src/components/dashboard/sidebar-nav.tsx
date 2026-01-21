'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trello, Home } from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { cn } from '@/lib/utils';
import { mockBoards } from '@/lib/data';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function SidebarNav() {
  const pathname = usePathname();
  // In a real app, you would fetch the user's boards here.
  const boards = mockBoards;
  const boardId = pathname.split('/').pop();

  return (
    <nav className="flex h-full flex-col gap-4 text-sm font-medium">
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-2 border-b px-4 text-lg font-semibold font-headline"
      >
        <Logo className="h-6 w-6 text-primary" />
        <span className="">Trello AI Assistant</span>
      </Link>
      <div className="flex-1 overflow-auto py-2">
        <div className="px-4">
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary',
              pathname === '/dashboard'
                ? 'bg-muted text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>

        <div className="px-4">
          <Accordion
            type="single"
            collapsible
            defaultValue="item-1"
            className="w-full"
          >
            <AccordionItem value="item-1" className="border-b-0">
              <AccordionTrigger className="rounded-lg px-3 py-2 text-muted-foreground hover:no-underline hover:text-primary [&[data-state=open]]:text-primary">
                <div className="flex items-center gap-3">
                  <Trello className="h-4 w-4" />
                  <span>Your Boards</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-5">
                {boards.map((board) => (
                  <Link
                    key={board.id}
                    href={`/dashboard/board/${board.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary',
                      pathname.includes(board.id)
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  >
                    {board.name}
                  </Link>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </nav>
  );
}
