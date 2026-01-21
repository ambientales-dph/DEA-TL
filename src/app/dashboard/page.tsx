import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { mockBoards } from '@/lib/data';

export default function DashboardPage() {
  const boards = mockBoards;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 font-headline">Your Boards</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <Link href={`/dashboard/board/${board.id}`} key={board.id}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader>
                <CardTitle>{board.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {board.desc}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Card className="flex items-center justify-center border-dashed hover:border-primary transition-colors">
            <CardHeader className="text-center">
                <CardTitle>Connect New Board</CardTitle>
                <CardDescription>Expand your AI workspace</CardDescription>
            </CardHeader>
        </Card>
      </div>
    </div>
  );
}
