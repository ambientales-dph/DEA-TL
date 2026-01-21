'use client';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/dashboard/user-nav';
import { SidebarNav } from './sidebar-nav';

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 sm:justify-end sm:px-6 lg:h-[60px]">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 sm:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col p-0">
          <SidebarNav />
        </SheetContent>
      </Sheet>

      <UserNav />
    </header>
  );
}
