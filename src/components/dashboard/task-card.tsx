import type { Card, Member } from '@/lib/types';
import {
  Card as ShadCard,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TaskCardProps {
  card: Card;
  members: Member[];
}

export function TaskCard({ card, members }: TaskCardProps) {
  const cardMembers = members.filter((m) => card.idMembers.includes(m.id));

  return (
    <ShadCard className="hover:border-primary/50 cursor-pointer">
      <CardHeader className="p-3">
        <CardTitle className="text-sm font-medium">{card.name}</CardTitle>
      </CardHeader>
      {cardMembers.length > 0 && (
        <CardContent className="p-3 pt-0">
          <div className="flex justify-end items-center">
            <div className="flex -space-x-2">
              <TooltipProvider>
                {cardMembers.map((member) => (
                  <Tooltip key={member.id}>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6 border-2 border-card">
                        <AvatarImage
                          src={member.avatarUrl}
                          alt={member.fullName}
                        />
                        <AvatarFallback>
                          {member.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{member.fullName}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      )}
    </ShadCard>
  );
}
