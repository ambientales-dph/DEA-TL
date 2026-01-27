'use client';

import * as React from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Timeline } from '@/components/timeline';
import { MilestoneDetail } from '@/components/milestone-detail';
import { type Milestone, type Category, type AssociatedFile } from '@/types';
import { CATEGORIES } from '@/lib/data';
import { toast } from '@/hooks/use-toast';
import { addMonths, endOfDay, parseISO, startOfDay, subMonths, subYears, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getCardAttachments, type TrelloCardBasic, getCardById, getCardActions, type TrelloAction } from '@/services/trello';
import { FileUpload } from '@/components/file-upload';
import { MilestoneSummaryTable } from '@/components/milestone-summary-sheet';
import { WelcomeScreen } from '@/components/welcome-screen';
import { RSB002_MILESTONES } from '@/lib/rsb002-data';
import { RSA060_MILESTONES } from '@/lib/rsa060-data';
import { FeedbackButton } from '@/components/feedback-button';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { TrelloSummary } from '@/components/trello-summary';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, setDoc, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const DEFAULT_CATEGORY_COLORS = ['#a3e635', '#22c55e', '#14b8a6', '#0ea5e9', '#4f46e5', '#8b5cf6', '#be185d', '#f97316', '#facc15'];

function getTrelloObjectCreationDate(trelloId: string): Date {
    const timestampHex = trelloId.substring(0, 8);
    const timestampSeconds = parseInt(timestampHex, 16);
    return new Date(timestampSeconds * 1000);
}

export default function Home() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState<{ start: Date; end: Date } | null>(null);
  const [selectedMilestone, setSelectedMilestone] = React.useState<Milestone | null>(null);
  const [selectedCard, setSelectedCard] = React.useState<TrelloCardBasic | null>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const [isTrelloSummaryOpen, setIsTrelloSummaryOpen] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [view, setView] = React.useState<'timeline' | 'summary'>('timeline');
  const [hasLoadedFromUrl, setHasLoadedFromUrl] = React.useState(false);
  const [cardFromUrl, setCardFromUrl] = React.useState<TrelloCardBasic | null>(null);
  
  const firestore = useFirestore();
  const syncPerformedForCard = React.useRef<string | null>(null);

  // Memoize the Firestore query to prevent re-renders
  const milestonesCollection = React.useMemo(() => {
    if (!firestore || !selectedCard) return null;
    const cardNameLower = selectedCard.name.toLowerCase();
    if (cardNameLower.includes('rsb002') || cardNameLower.includes('rlu002') || cardNameLower.includes('rsa060')) {
      return null;
    }
    return collection(firestore, 'projects', selectedCard.id, 'milestones');
  }, [firestore, selectedCard]);

  // Hook to get real-time updates from Firestore
  const { data: milestones, loading: firestoreLoading } = useCollection(milestonesCollection);

  const isLoadingTimeline = firestoreLoading;
  
  // Resizing state
  const [isResizing, setIsResizing] = React.useState(false);
  const [timelinePanelHeight, setTimelinePanelHeight] = React.useState(40); // Initial percentage
  const resizeContainerRef = React.useRef<HTMLDivElement>(null);
  const milestoneDateBounds = React.useRef<{start: string; end: string} | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedCategories = localStorage.getItem('deas-tl-categories');
        const parsedCategories: Category[] | null = storedCategories ? JSON.parse(storedCategories) : null;
        
        let finalCategories: Category[];

        if (parsedCategories) {
          const defaultCategoriesMap = new Map(CATEGORIES.map(c => [c.id, c]));
          const parsedCategoriesMap = new Map(parsedCategories.map(c => [c.id, c]));
          const mergedBaseCategories = CATEGORIES.map(defaultCat => {
            return parsedCategoriesMap.get(defaultCat.id) || defaultCat;
          });
          const customUserCategories = parsedCategories.filter(parsedCat => !defaultCategoriesMap.has(parsedCat.id));
          finalCategories = [...mergedBaseCategories, ...customUserCategories];
        } else {
          finalCategories = [...CATEGORIES];
        }
        
        finalCategories = finalCategories.filter(c => c.id !== 'cat-rsb002' && c.id !== 'cat-sistema');
        
        if (!finalCategories.some(c => c.id === 'cat-sistema')) {
          finalCategories.push({ id: 'cat-sistema', name: 'Sistema', color: '#000000' });
        }

        setCategories(finalCategories);

      } catch (error) {
          console.error("Failed to load or merge categories from localStorage", error);
          setCategories(CATEGORIES);
      } finally {
        setIsLoaded(true);
      }
    }
  }, []);

  React.useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem('deas-tl-categories', JSON.stringify(categories));
    }
  }, [categories, isLoaded]);

  const handleCardSelect = React.useCallback(async (card: TrelloCardBasic | null) => {
    setSelectedCard(card);
    setSelectedMilestone(null);
  }, []);
  
  // Effect to sync Trello data to Firestore (runs ONCE per card load)
  React.useEffect(() => {
    const syncTrelloToFirestore = async () => {
        if (!selectedCard || !firestore || syncPerformedForCard.current === selectedCard.id) {
            return;
        }

        const cardNameLower = selectedCard.name.toLowerCase();
        const isDemoProject = cardNameLower.includes('rsb002') || cardNameLower.includes('rlu002') || cardNameLower.includes('rsa060');

        if (isDemoProject) {
            syncPerformedForCard.current = selectedCard.id;
            return;
        }

        syncPerformedForCard.current = selectedCard.id;
        
        try {
            console.log(`Syncing Trello data for card ${selectedCard.id} to Firestore...`);

            const [attachments, actions] = await Promise.all([
                getCardAttachments(selectedCard.id),
                getCardActions(selectedCard.id),
            ]);

            const milestonesRef = collection(firestore, 'projects', selectedCard.id, 'milestones');
            const existingDocsSnapshot = await getDocs(milestonesRef);
            const existingMilestoneIds = new Set(existingDocsSnapshot.docs.map(d => d.id));

            const systemCategory = categories.find(c => c.id === 'cat-sistema') || { id: 'cat-sistema', name: 'Sistema', color: '#000000' };
            const creationDate = getTrelloObjectCreationDate(selectedCard.id);
            const creationMilestone: Milestone = {
              id: `hito-creacion-${selectedCard.id}`,
              name: 'Ingreso al sistema',
              description: `La tarjeta de Trello fue creada en esta fecha.`,
              occurredAt: creationDate.toISOString(),
              category: systemCategory,
              tags: ['sistema', 'creación'],
              associatedFiles: [],
              isImportant: false,
              history: [`${format(new Date(), "PPpp", { locale: es })} - Hito de creación generado automáticamente.`],
            };

            const defaultCategory = categories.find(c => c.name.toLowerCase().includes('trello')) || CATEGORIES[1];
            const attachmentMilestones: Milestone[] = attachments.map(att => {
              const fileType: AssociatedFile['type'] = att.mimeType.startsWith('image/') ? 'image' : att.mimeType.startsWith('video/') ? 'video' : att.mimeType.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => att.mimeType.includes(t)) ? 'document' : 'other';
              const associatedFile: AssociatedFile = { id: `file-${att.id}`, name: att.fileName, size: `${(att.bytes / 1024).toFixed(2)} KB`, type: fileType };
              return {
                  id: `hito-${att.id}`,
                  name: att.fileName,
                  description: `Archivo adjuntado a la tarjeta de Trello el ${new Date(att.date).toLocaleDateString()}.`,
                  occurredAt: att.date,
                  category: defaultCategory, tags: ['adjunto'], associatedFiles: [associatedFile], isImportant: false,
                  history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde Trello.`],
              };
            });
            
            const commentsCategory = categories.find(c => c.id === 'cat-10') || { id: 'cat-10', name: 'Comentarios', color: '#607D8B' };
            const activityCategory = categories.find(c => c.id === 'cat-11') || { id: 'cat-11', name: 'Actividad de Tarjeta', color: '#9E9E9E' };

            const actionMilestones: Milestone[] = actions.map(action => {
                let milestone: Milestone | null = null;
                if (action.type === 'commentCard' && action.data.text) {
                    milestone = { id: `hito-${action.id}`, name: `Comentario de ${action.memberCreator.fullName}`, description: action.data.text, occurredAt: action.date, category: commentsCategory, tags: ['comentario'], associatedFiles: [], isImportant: false, history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] };
                } else if (action.type === 'updateCard' && action.data.listAfter && action.data.listBefore) {
                    milestone = { id: `hito-${action.id}`, name: `Tarjeta movida`, description: `Movida de "${action.data.listBefore.name}" a "${action.data.listAfter.name}" por ${action.memberCreator.fullName}.`, occurredAt: action.date, category: activityCategory, tags: ['actividad', 'movimiento'], associatedFiles: [], isImportant: false, history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] };
                }
                return milestone;
            }).filter((m): m is Milestone => m !== null);

            const allTrelloMilestones = [creationMilestone, ...attachmentMilestones, ...actionMilestones];
            
            const newMilestonesToSync = allTrelloMilestones.filter(m => !existingMilestoneIds.has(m.id));

            if (newMilestonesToSync.length > 0) {
                const batch = writeBatch(firestore);
                newMilestonesToSync.forEach(milestone => {
                    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', milestone.id);
                    batch.set(milestoneRef, milestone);
                });
                batch.commit().then(() => {
                    toast({ title: "Sincronización completa", description: `Se guardaron ${newMilestonesToSync.length} nuevos hitos desde Trello.` });
                }).catch((serverError) => {
                    console.error("Firestore Batch Commit Error:", serverError);
                    toast({
                        variant: "destructive",
                        title: "Error al sincronizar con Trello",
                        description: serverError.message || "No se pudieron guardar los datos de Trello en la base de datos.",
                        duration: 10000,
                    });
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: `projects/${selectedCard.id}/milestones`,
                        operation: 'create',
                        requestResourceData: { info: `Batch write for ${newMilestonesToSync.length} milestones` }
                    }));
                });
            }
        } catch (error) {
            console.error("Error preparing Trello sync data:", error);
            toast({ variant: 'destructive', title: 'Error de Sincronización', description: 'No se pudieron obtener los datos de Trello.' });
            syncPerformedForCard.current = null;
        }
    };

    syncTrelloToFirestore();
  }, [selectedCard, firestore, categories]);


  React.useEffect(() => {
    if (isLoaded && !hasLoadedFromUrl) {
      const urlParams = new URLSearchParams(window.location.search);
      const cardId = urlParams.get('cardId');
  
      if (cardId) {
        setHasLoadedFromUrl(true);
        const loadCardFromUrl = async () => {
          try {
            const card = await getCardById(cardId);
            if (card) {
              setCardFromUrl(card);
              handleCardSelect(card);
            } else {
              toast({ variant: "destructive", title: "Tarjeta no encontrada", description: `No se pudo encontrar una tarjeta de Trello con el ID: ${cardId}` });
            }
          } catch (error) {
            console.error("Failed to load card from URL", error);
            toast({ variant: "destructive", title: "Error al cargar tarjeta", description: "Hubo un problema al intentar cargar la tarjeta desde la URL." });
          }
        };
        loadCardFromUrl();
      }
    }
  }, [isLoaded, hasLoadedFromUrl, handleCardSelect]);

  const displayedMilestones = React.useMemo(() => {
    if (selectedCard) {
        const cardNameLower = selectedCard.name.toLowerCase();
        if (cardNameLower.includes('rsb002') || cardNameLower.includes('rlu002')) return RSB002_MILESTONES;
        if (cardNameLower.includes('rsa060')) return RSA060_MILESTONES;
    }
    return milestones || [];
  }, [selectedCard, milestones]);


  React.useEffect(() => {
    if (displayedMilestones.length > 0) {
      const allDates = displayedMilestones.map(m => parseISO(m.occurredAt));
      const oldest = new Date(Math.min(...allDates.map(d => d.getTime())));
      const newest = new Date(Math.max(...allDates.map(d => d.getTime())));
      const newBounds = { start: oldest.toISOString(), end: newest.toISOString() };
      const hasBoundsChanged = newBounds.start !== milestoneDateBounds.current?.start || newBounds.end !== milestoneDateBounds.current?.end;
      if (hasBoundsChanged) {
        milestoneDateBounds.current = newBounds;
        setDateRange({ start: subMonths(oldest, 1), end: addMonths(newest, 1) });
      }
    } else {
        milestoneDateBounds.current = null;
        setDateRange(null);
    }
  }, [displayedMilestones]);

  const handleUpload = React.useCallback(async (data: { files?: File[], categoryId: string, name: string, description: string, occurredAt: Date }) => {
    if (!firestore || !selectedCard) return;

    if ((selectedCard.name.toLowerCase().includes('rsb002') || selectedCard.name.toLowerCase().includes('rsa060') || selectedCard.name.toLowerCase().includes('rlu002'))) {
        toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden crear hitos para los proyectos de ejemplo." });
        return;
    }

    const { files, categoryId, name, description, occurredAt } = data;
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
        toast({ variant: "destructive", title: "Error al crear hito", description: "La categoría seleccionada no es válida." });
        return;
    };

    const associatedFiles: AssociatedFile[] = (files || []).map(file => ({
      id: `file-local-${Date.now()}-${file.name}`,
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => file.type.includes(t)) ? 'document' : 'other',
    }));
    
    const newMilestoneData = {
        name: name,
        description: description,
        occurredAt: occurredAt.toISOString(),
        category: category,
        tags: ['manual'],
        associatedFiles: associatedFiles,
        isImportant: false,
        history: [`${format(new Date(), "PPpp", { locale: es })} - Creación de hito.`],
    };

    const milestonesRef = collection(firestore, 'projects', selectedCard.id, 'milestones');
    addDoc(milestonesRef, newMilestoneData)
      .then(() => {
        toast({ title: "Hito creado", description: "El nuevo hito ha sido guardado en la base de datos." });
      })
      .catch((serverError) => {
        console.error("Error creating milestone:", serverError);
        toast({
            variant: "destructive",
            title: "Error al guardar hito",
            description: serverError.message || "No se pudo comunicar con la base de datos.",
            duration: 10000,
        });
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: milestonesRef.path,
            operation: 'create',
            requestResourceData: newMilestoneData,
        }));
      });

    setIsUploadOpen(false);
  }, [categories, selectedCard, firestore]);

  const handleMilestoneUpdate = React.useCallback(async (updatedMilestone: Milestone) => {
    if (!firestore || !selectedCard) return;

    if ((selectedCard.name.toLowerCase().includes('rsb002') || selectedCard.name.toLowerCase().includes('rsa060') || selectedCard.name.toLowerCase().includes('rlu002'))) {
      toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden guardar cambios para los proyectos de ejemplo." });
      return;
    }

    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', updatedMilestone.id);
    setDoc(milestoneRef, updatedMilestone, { merge: true })
      .then(() => {
          toast({ title: "Hito actualizado", description: "Los cambios se guardaron correctamente." });
      })
      .catch((serverError) => {
          console.error("Error updating milestone:", serverError);
          toast({
              variant: "destructive",
              title: "Error al actualizar hito",
              description: serverError.message || "No se pudo comunicar con la base de datos.",
              duration: 10000,
          });
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: milestoneRef.path,
              operation: 'update',
              requestResourceData: updatedMilestone
          }));
      });
    
    if (selectedMilestone && selectedMilestone.id === updatedMilestone.id) {
        setSelectedMilestone(updatedMilestone);
    }
  }, [selectedCard, selectedMilestone, firestore]);


  const handleSetRange = React.useCallback((rangeType: '1D' | '1M' | '1Y' | 'All') => {
    if (rangeType === 'All') {
        if (milestoneDateBounds.current) {
            setDateRange({ start: subMonths(parseISO(milestoneDateBounds.current.start), 1), end: addMonths(parseISO(milestoneDateBounds.current.end), 1) });
        }
        return;
    }
    const now = new Date();
    if (rangeType === '1D') setDateRange({ start: startOfDay(now), end: endOfDay(now) });
    else if (rangeType === '1M') setDateRange({ start: subMonths(now, 1), end: now });
    else if (rangeType === '1Y') setDateRange({ start: subYears(now, 1), end: now });
  }, []);

  const handleMilestoneClick = React.useCallback((milestone: Milestone) => {
    setSelectedMilestone(milestone);
  }, []);

  const handleDetailClose = React.useCallback(() => {
    setSelectedMilestone(null);
  }, []);
  
  const handleGoHome = React.useCallback(() => {
    setSelectedCard(null);
    setSelectedMilestone(null);
    setSearchTerm('');
    setView('timeline');
    setCardFromUrl(null);
    syncPerformedForCard.current = null;
  }, []);

  const filteredMilestones = (displayedMilestones || [])
    .filter(milestone => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return [milestone.name, milestone.description, milestone.category.name, ...(milestone.tags || [])]
        .some(text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalizedTerm));
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const handleCategoryColorChange = React.useCallback((categoryId: string, color: string) => {
    setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, color } : c));
  }, []);
  
  const handleCategoryAdd = React.useCallback((name: string) => {
    setCategories(prev => [...prev, { id: `cat-${Date.now()}`, name, color: DEFAULT_CATEGORY_COLORS[prev.length % DEFAULT_CATEGORY_COLORS.length] }]);
  }, []);

  const handleCategoryUpdate = React.useCallback((categoryId: string, name: string) => {
    const newName = name.trim();
    if (!newName) return;
    setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, name: newName } : c));
  }, []);
  
  const handleCategoryDelete = React.useCallback((categoryId: string) => {
    if (displayedMilestones.some(m => m.category.id === categoryId)) {
      toast({ variant: "destructive", title: "Categoría en uso", description: "No se puede eliminar una categoría que está asignada a uno o más hitos." });
      return;
    }
    setCategories(prev => prev.filter(c => c.id !== categoryId));
  }, [displayedMilestones]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };
  
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeContainerRef.current) return;
      const container = resizeContainerRef.current;
      const rect = container.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      let newHeightPercent = (newHeight / rect.height) * 100;
      if (newHeightPercent < 20) newHeightPercent = 20;
      if (newHeightPercent > 80) newHeightPercent = 80;
      setTimelinePanelHeight(newHeightPercent);
    };

    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  React.useEffect(() => {
    if (selectedCard) {
      const match = selectedCard.name.match(/\b([A-Z]{3}\d{3})\b/i);
      document.title = `DEA TL | ${match ? match[0].toUpperCase() : selectedCard.name}`;
    } else {
      document.title = 'DEA TL';
    }
  }, [selectedCard]);

  const handleToggleView = () => setView(prev => prev === 'timeline' ? 'summary' : 'timeline');

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar 
        categories={categories} 
        onCategoryColorChange={handleCategoryColorChange}
        onCategoryAdd={handleCategoryAdd}
        onCategoryUpdate={handleCategoryUpdate}
        onCategoryDelete={handleCategoryDelete}
        onCardSelect={handleCardSelect}
        selectedCard={selectedCard}
        onNewMilestoneClick={() => setIsUploadOpen(true)}
        onGoHome={handleGoHome}
        cardFromUrl={cardFromUrl}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          onSetRange={handleSetRange}
          onToggleView={handleToggleView}
          view={view}
          onGoHome={handleGoHome}
          trelloCardUrl={selectedCard?.url ?? null}
          isProjectLoaded={!!selectedCard}
          onToggleTrelloSummary={() => setIsTrelloSummaryOpen(true)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedCard && (
              <div className="px-4 md:px-6 py-3 border-b bg-background shrink-0">
                  <h2 className="text-xl font-headline font-medium text-foreground truncate" title={selectedCard.name}>
                      {selectedCard.name}
                  </h2>
              </div>
          )}
          <div ref={resizeContainerRef} className="flex-1 flex flex-col overflow-hidden">
            {view === 'timeline' ? (
              <>
                <main 
                  className="overflow-y-auto p-4 md:p-6"
                  style={{ height: selectedMilestone ? `${timelinePanelHeight}%` : '100%' }}
                >
                {isLoadingTimeline ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <h2 className="text-2xl font-medium font-headline mt-4">Cargando línea de tiempo...</h2>
                        <p className="mt-2 text-muted-foreground">
                            Conectando con la base de datos.
                        </p>
                    </div>
                ) : displayedMilestones.length > 0 && dateRange ? (
                    <div className="h-full w-full">
                        <Timeline 
                            milestones={filteredMilestones} 
                            startDate={dateRange.start}
                            endDate={dateRange.end}
                            onMilestoneClick={handleMilestoneClick}
                        />
                    </div>
                ) : (
                    <WelcomeScreen />
                )}
                </main>
                {selectedMilestone && (
                   <>
                      <div
                        onMouseDown={handleResizeMouseDown}
                        className="h-2 bg-border cursor-row-resize hover:bg-ring transition-colors flex-shrink-0"
                        title="Arrastrar para redimensionar"
                      />
                      <div className="flex-1 shrink-0 overflow-y-auto bg-zinc-300">
                          <MilestoneDetail
                              milestone={selectedMilestone}
                              categories={categories}
                              onMilestoneUpdate={handleMilestoneUpdate}
                              onClose={handleDetailClose}
                          />
                      </div>
                   </>
                )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto bg-zinc-200">
                <MilestoneSummaryTable milestones={filteredMilestones} projectName={selectedCard?.name} />
              </div>
            )}
          </div>
        </div>
      </div>

      <FileUpload
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        categories={categories}
        onUpload={handleUpload}
      />
      
      <TrelloSummary 
        isOpen={isTrelloSummaryOpen}
        onOpenChange={setIsTrelloSummaryOpen}
      />

      <FeedbackButton onClick={() => setIsFeedbackOpen(true)} />
      <FeedbackDialog isOpen={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
    </div>
  );
}
