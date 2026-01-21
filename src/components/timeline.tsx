'use client';

import * as React from 'react';
import type { Milestone } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  format,
  parseISO,
  differenceInMilliseconds,
  eachMonthOfInterval,
  differenceInMonths,
  getMonth,
  getYear,
  differenceInDays,
  eachDayOfInterval,
  eachHourOfInterval,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface TimelineProps {
  milestones: Milestone[];
  startDate: Date;
  endDate: Date;
  onMilestoneClick: (milestone: Milestone) => void;
}

interface DateMarker {
    date: Date;
    label: string; // For hours or month/year
    dayLabel?: string; // For day number
    monthLabel?: string; // For month name
    position: number;
}

interface TimelineData {
  markers: DateMarker[];
  filePositions: Map<string, number>;
  visibleMilestones: Milestone[];
  centralMonthLabel?: string;
}

export function Timeline({ milestones, startDate, endDate, onMilestoneClick }: TimelineProps) {
  const [timelineData, setTimelineData] = React.useState<TimelineData | null>(null);
  const heights = React.useRef(new Map<string, number>());
  const timelineContainerRef = React.useRef<HTMLDivElement>(null);
  const [viewRange, setViewRange] = React.useState({ start: startDate, end: endDate });
  const [isPanning, setIsPanning] = React.useState(false);
  const panStartRef = React.useRef({x: 0, rangeStart: new Date(), rangeEnd: new Date()});
  const [activeMilestoneId, setActiveMilestoneId] = React.useState<string | null>(null);
  const prevMilestoneIdsRef = React.useRef<string>('');

  React.useEffect(() => {
    setViewRange({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  React.useEffect(() => {
    const currentMilestoneIds = milestones.map(m => m.id).sort().join(',');

    // Only recalculate heights if the set of milestone IDs has changed.
    // This prevents re-calculation when only metadata (like tags) is updated.
    if (currentMilestoneIds !== prevMilestoneIdsRef.current) {
      prevMilestoneIdsRef.current = currentMilestoneIds;

      if (milestones.length > 0) {
        const newHeights = new Map<string, number>();
        const sortedMilestones = [...milestones].sort(
          (a, b) => parseISO(a.occurredAt).getTime() - parseISO(b.occurredAt).getTime()
        );

        const MIN_HEIGHT = 60;
        const MAX_HEIGHT = 150;
        const VERTICAL_SEPARATION = 35;

        const allDates = sortedMilestones.map(m => parseISO(m.occurredAt));
        const oldestTime = allDates[0]?.getTime() ?? 0;
        const newestTime = allDates[allDates.length - 1]?.getTime() ?? 0;
        const totalDuration = newestTime - oldestTime;
        
        const TIME_SEPARATION_THRESHOLD = totalDuration > 0 ? totalDuration * 0.015 : 1;

        const placedMilestones: { time: number; height: number }[] = [];

        sortedMilestones.forEach(milestone => {
          const milestoneTime = parseISO(milestone.occurredAt).getTime();
          
          let finalHeight: number = MIN_HEIGHT;
          let collision = true;
          let attempts = 0;
          const MAX_ATTEMPTS = 20;

          while (collision && attempts < MAX_ATTEMPTS) {
            attempts++;
            collision = false;
            finalHeight = Math.floor(Math.random() * (MAX_HEIGHT - MIN_HEIGHT + 1)) + MIN_HEIGHT;

            for (const placed of placedMilestones) {
              const timeDiff = Math.abs(milestoneTime - placed.time);
              const heightDiff = Math.abs(finalHeight - placed.height);
              
              if (timeDiff < TIME_SEPARATION_THRESHOLD && heightDiff < VERTICAL_SEPARATION) {
                collision = true;
                break;
              }
            }
          }
          
          newHeights.set(milestone.id, finalHeight);
          placedMilestones.push({ time: milestoneTime, height: finalHeight });
        });

        heights.current = newHeights;
      } else {
        heights.current.clear();
      }
    }
  }, [milestones]);
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const container = timelineContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseXPercent = (e.clientX - rect.left) / rect.width;
    
    const currentDuration = viewRange.end.getTime() - viewRange.start.getTime();
    if(currentDuration <= 0) return;

    const zoomIntensity = 0.1;
    const delta = currentDuration * zoomIntensity * (e.deltaY > 0 ? 1 : -1);
    
    const newStartMs = viewRange.start.getTime() - delta * mouseXPercent;
    const newEndMs = viewRange.end.getTime() + delta * (1 - mouseXPercent);

    if (newEndMs <= newStartMs) {
        return; 
    }
    
    setViewRange({
        start: new Date(newStartMs),
        end: new Date(newEndMs),
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2 && e.button !== 1) return; // Only right or middle click
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
        x: e.clientX,
        rangeStart: viewRange.start,
        rangeEnd: viewRange.end,
    };
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    e.preventDefault();

    const container = timelineContainerRef.current;
    if (!container) return;
    
    const deltaX = e.clientX - panStartRef.current.x;
    if (deltaX === 0) return;

    const fullDuration = panStartRef.current.rangeEnd.getTime() - panStartRef.current.rangeStart.getTime();
    const pixelToMs = fullDuration / container.offsetWidth;
    const timeDelta = deltaX * pixelToMs;

    setViewRange({
        start: new Date(panStartRef.current.rangeStart.getTime() - timeDelta),
        end: new Date(panStartRef.current.rangeEnd.getTime() - timeDelta),
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button !== 2 && e.button !== 1) return;
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  React.useEffect(() => {
    const timelineStart = viewRange.start;
    const timelineEnd = viewRange.end;
  
    const visibleMilestones = milestones.filter(milestone => {
      const fileDate = parseISO(milestone.occurredAt);
      return fileDate >= timelineStart && fileDate <= timelineEnd;
    });
  
    if (timelineStart && timelineEnd && timelineEnd > timelineStart) {
      const totalTimelineDuration = differenceInMilliseconds(timelineEnd, timelineStart);
  
      const getPositionOnTimeline = (date: Date) => {
        if (totalTimelineDuration <= 0) return 0;
        const dateOffset = differenceInMilliseconds(date, timelineStart);
        return (dateOffset / totalTimelineDuration) * 100;
      };
  
      const durationInDays = differenceInDays(timelineEnd, timelineStart);
      const durationInMonths = differenceInMonths(timelineEnd, timelineStart);
  
      let dateMarkers: Omit<DateMarker, 'position'>[] = [];
      let centralMonthLabel: string | undefined = undefined;
  
      if (durationInDays <= 1) {
        // Show hours (every 2 hours)
        const rawHourMarkers = eachHourOfInterval({ start: timelineStart, end: timelineEnd });
        dateMarkers = rawHourMarkers
          .filter((_, index) => index % 2 === 0)
          .map(hourDate => ({
            date: hourDate,
            label: format(hourDate, 'HH:mm'),
          }));
      } else if (durationInMonths < 1) {
        // Show days with a single month label
        const rawDayMarkers = eachDayOfInterval({ start: timelineStart, end: timelineEnd });
        dateMarkers = rawDayMarkers.map(dayDate => ({
            date: dayDate,
            label: '', // Not used in this view
            dayLabel: format(dayDate, 'd'),
            monthLabel: '', // This is handled by centralMonthLabel now
        }));
        
        // Determine the central month label
        const middleDate = new Date(timelineStart.getTime() + (timelineEnd.getTime() - timelineStart.getTime()) / 2);
        centralMonthLabel = format(middleDate, 'MMMM yyyy', { locale: es });
      } else {
        // Show months (default behavior)
        const durationInYears = durationInMonths / 12;
        const rawMonthMarkersSource = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
  
        let filteredMonths: Date[];
        if (durationInYears >= 2) {
          filteredMonths = rawMonthMarkersSource.filter(date => getMonth(date) % 6 === 0); // Ene, Jul
        } else if (durationInYears >= 1) {
          filteredMonths = rawMonthMarkersSource.filter(date => getMonth(date) % 3 === 0); // Ene, Abr, Jul, Oct
        } else {
            filteredMonths = rawMonthMarkersSource;
        }

        let lastShownYear: number | null = null;
        dateMarkers = filteredMonths.map(monthDate => {
            const year = getYear(monthDate);
            let showYear = false;
            if (lastShownYear === null || year !== lastShownYear || getMonth(monthDate) === 0) {
                showYear = true;
            }
            lastShownYear = year;
            return {
                date: monthDate,
                label: format(monthDate, showYear ? 'MMM yyyy' : 'MMM', { locale: es }),
            };
        });
      }
      
      const markersWithPosition: DateMarker[] = dateMarkers.map(marker => ({
          ...marker,
          position: getPositionOnTimeline(marker.date),
      }));

      const filePositions = new Map<string, number>();
      visibleMilestones.forEach(milestone => {
        const fileDate = parseISO(milestone.occurredAt);
        const position = getPositionOnTimeline(fileDate);
        filePositions.set(milestone.id, position);
      });
  
      setTimelineData({
        markers: markersWithPosition,
        filePositions,
        visibleMilestones,
        centralMonthLabel,
      });
    } else {
      setTimelineData({
        markers: [],
        filePositions: new Map(),
        visibleMilestones: [],
      });
    }
  }, [milestones, viewRange]);


  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-semibold font-headline">Bienvenido a DEAS TL</h2>
        <p className="mt-2 text-muted-foreground">
          Arrastra y suelta un archivo para empezar o usa el botón de subir.
        </p>
      </div>
    );
  }

  if (!timelineData) {
    return (
      <div className="w-full h-full flex items-end justify-start p-4 sm:p-8 pb-16">
        <div className="relative h-full w-full">
          <div className="absolute bottom-7 left-0 right-0 h-px bg-gray-400" />
          <div className="w-full h-32 flex items-end">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  const { markers, filePositions, visibleMilestones, centralMonthLabel } = timelineData;
  
  const milestonesInView = visibleMilestones.filter(milestone => {
    const pos = filePositions.get(milestone.id);
    return pos !== undefined && pos >= 0 && pos <= 100;
  });

  return (
    <div 
      ref={timelineContainerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative w-full h-full flex items-end justify-start p-4 sm:p-8 pb-16 touch-none",
        (isPanning || milestones.length > 0) && "cursor-grab",
        isPanning && "cursor-grabbing"
      )}
    >
        {milestonesInView.length === 0 && milestones.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <h2 className="text-2xl font-semibold font-headline">No hay hitos en este rango de tiempo.</h2>
                <p className="mt-2 text-muted-foreground">
                Intenta alejar el zoom o seleccionar un rango de tiempo diferente.
                </p>
            </div>
        )}
      <div 
        className="relative h-full w-full"
      >
        <div className="absolute bottom-7 left-0 right-0 h-px bg-gray-400" />

        {markers.map(({ label, dayLabel, monthLabel, position }, index) => (
          position >= 0 && position <= 100 && (
            <div
              key={label + position + index}
              className="absolute -bottom-0.5 flex flex-col items-center"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
            >
              <div className="h-2 w-px bg-gray-400" />
              {dayLabel ? (
                 <span className="absolute top-4 text-xs font-medium text-foreground">{dayLabel}</span>
              ) : (
                <span className="absolute top-4 text-xs text-muted-foreground whitespace-nowrap">
                    {label}
                </span>
              )}
            </div>
          )
        ))}

        {centralMonthLabel && (
            <div className="absolute bottom-[-50px] w-full text-center">
                <span className="text-lg font-bold text-muted-foreground/50 capitalize">
                    {centralMonthLabel}
                </span>
            </div>
        )}

        <TooltipProvider>
          {visibleMilestones.map(milestone => {
            const milestoneDate = parseISO(milestone.occurredAt);
            const position = filePositions.get(milestone.id) ?? 0;
            const height = heights.current.get(milestone.id) ?? 60;

            if (position < 0 || position > 100) return null;

            return (
              <div
                key={milestone.id}
                className={cn(
                  "absolute bottom-7 flex flex-col items-center",
                  activeMilestoneId === milestone.id && 'z-20'
                )}
                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              >
                <Tooltip 
                    delayDuration={100} 
                    onOpenChange={(isOpen) => {
                        setActiveMilestoneId(isOpen ? milestone.id : null);
                    }}
                >
                  <TooltipTrigger asChild>
                    <div 
                      className="relative flex flex-col-reverse items-center cursor-pointer group"
                      onClick={() => onMilestoneClick(milestone)}
                    >
                       <div
                        className="w-px bg-gray-300"
                        style={{ height: `${height}px` }}
                      />
                       <div
                        className="w-2.5 h-2.5 rounded-full border-2 border-background shadow-md group-hover:scale-125 transition-transform z-10"
                        style={{ backgroundColor: milestone.category.color }}
                      />
                      {milestone.isImportant && (
                        <div style={{ bottom: `${height + 10}px`}} className="absolute">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">{milestone.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(milestoneDate, "PPP 'a las' p", { locale: es })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}

    