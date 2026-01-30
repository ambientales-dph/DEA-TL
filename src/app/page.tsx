
'use client';

import * as React from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Timeline } from '@/components/timeline';
import { MilestoneDetail } from '@/components/milestone-detail';
import { type Milestone, type Category, type AssociatedFile } from '@/types';
import { CATEGORIES } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { addMonths, endOfDay, parseISO, startOfDay, subMonths, subYears, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { getCardAttachments, type TrelloCardBasic, getCardActions, uploadAttachmentToCard, attachUrlToCard } from '@/services/trello';
import { FileUpload } from '@/components/file-upload';
import { MilestoneSummaryTable } from '@/components/milestone-summary-sheet';
import { WelcomeScreen } from '@/components/welcome-screen';
import { RSA060_MILESTONES } from '@/lib/rsa060-data';
import { FeedbackButton } from '@/components/feedback-button';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { TrelloSummary } from '@/components/trello-summary';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, setDoc, addDoc, getDocs, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { uploadFileToDrive } from '@/services/google-drive';
import { Buffer } from 'buffer';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';

function getTrelloObjectCreationDate(trelloId: string): Date {
    const timestampHex = trelloId.substring(0, 8);
    const timestampSeconds = parseInt(timestampHex, 16);
    return new Date(timestampSeconds * 1000);
}

export default function Home() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState<{ start: Date; end: Date } | null>(null);
  const [selectedMilestone, setSelectedMilestone] = React.useState<Milestone | null>(null);
  const [selectedCard, setSelectedCard] = React.useState<TrelloCardBasic | null>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const [isTrelloSummaryOpen, setIsTrelloSummaryOpen] = React.useState(false);
  const [view, setView] = React.useState<'timeline' | 'summary'>('timeline');
  const [cardFromUrl, setCardFromUrl] = React.useState<TrelloCardBasic | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadText, setUploadText] = React.useState('');

  const firestore = useFirestore();
  const syncPerformedForCard = React.useRef<string | null>(null);
  const { toast } = useToast();

  const categoriesCollection = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'categories');
  }, [firestore]);

  const { data: firestoreCategories, loading: categoriesLoading } = useCollection(categoriesCollection);

  const categories = React.useMemo(() => {
    if (firestoreCategories && firestoreCategories.length > 0) {
      return firestoreCategories as Category[];
    }
    return CATEGORIES;
  }, [firestoreCategories]);

  React.useEffect(() => {
    if (firestore && firestoreCategories && firestoreCategories.length === 0) {
        const batch = writeBatch(firestore);
        CATEGORIES.forEach(cat => {
            const docRef = doc(firestore, 'categories', cat.id);
            batch.set(docRef, cat);
        });
        batch.commit().catch(err => console.error("Error seeding categories:", err));
    }
  }, [firestore, firestoreCategories]);

  const milestonesCollection = React.useMemo(() => {
    if (!firestore || !selectedCard) return null;
    if (selectedCard.id === 'training-rsa999') return null;
    return collection(firestore, 'projects', selectedCard.id, 'milestones');
  }, [firestore, selectedCard]);

  const { data: rawMilestones, loading: firestoreLoading } = useCollection(milestonesCollection);

  const milestones = React.useMemo(() => {
    if (!rawMilestones) return null;
    return rawMilestones.map(m => {
        const currentCat = categories.find(c => c.id === m.category.id);
        if (currentCat) {
            return { ...m, category: currentCat };
        }
        return m;
    }) as Milestone[];
  }, [rawMilestones, categories]);

  const displayedMilestones = React.useMemo(() => {
    if (selectedCard?.id === 'training-rsa999') {
        return RSA060_MILESTONES.map(m => {
            const currentCat = categories.find(c => c.id === m.category.id);
            return currentCat ? { ...m, category: currentCat } : m;
        });
    }
    return milestones || [];
  }, [selectedCard, milestones, categories]);

  const filteredMilestones = React.useMemo(() => {
    return (displayedMilestones || [])
    .filter(milestone => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return [milestone.name, milestone.description, milestone.category.name, ...(milestone.tags || [])]
        .some(text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalizedTerm));
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [displayedMilestones, searchTerm]);

  const isLoadingTimeline = firestoreLoading || categoriesLoading;
  
  const [isResizing, setIsResizing] = React.useState(false);
  const [timelinePanelHeight, setTimelinePanelHeight] = React.useState(40);
  const resizeContainerRef = React.useRef<HTMLDivElement>(null);
  const milestoneDateBounds = React.useRef<{start: string; end: string} | null>(null);

  const handleCardSelect = React.useCallback(async (card: TrelloCardBasic | null) => {
    setSelectedCard(card);
    setSelectedMilestone(null);
  }, []);
  
  React.useEffect(() => {
    const syncTrelloToFirestore = async () => {
        if (!selectedCard || !firestore || syncPerformedForCard.current === selectedCard.id) {
            return;
        }

        if (selectedCard.id === 'training-rsa999') {
            syncPerformedForCard.current = selectedCard.id;
            return;
        }

        syncPerformedForCard.current = selectedCard.id;
        
        try {
            const projectRef = doc(firestore, 'projects', selectedCard.id);
            const codeMatch = selectedCard.name.match(/\b([A-Z]{3}\d{3})\b/i);
            const projectData = {
                name: selectedCard.name,
                code: codeMatch ? codeMatch[0].toUpperCase() : null
            };
            
            setDoc(projectRef, projectData, { merge: true })
                .catch((serverError) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: projectRef.path,
                        operation: 'update',
                        requestResourceData: projectData
                    }));
                });

            const [attachments, actions] = await Promise.all([
                getCardAttachments(selectedCard.id),
                getCardActions(selectedCard.id),
            ]);

            const milestonesRef = collection(firestore, 'projects', selectedCard.id, 'milestones');
            const existingDocsSnapshot = await getDocs(milestonesRef);
            
            const existingHitosByTrelloId = new Map();
            existingDocsSnapshot.docs.forEach(d => {
                const data = d.data() as Milestone;
                data.associatedFiles.forEach(f => {
                    if (f.trelloId) existingHitosByTrelloId.set(f.trelloId, d.id);
                });
                if (d.id.startsWith('hito-')) {
                   existingHitosByTrelloId.set(d.id.replace('hito-', ''), d.id);
                }
            });

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
            const attachmentMilestones: Milestone[] = attachments
              .filter(att => !existingHitosByTrelloId.has(att.id))
              .map(att => {
                const fileType: AssociatedFile['type'] = att.mimeType.startsWith('image/') ? 'image' : att.mimeType.startsWith('video/') ? 'video' : att.mimeType.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => att.mimeType.includes(t)) ? 'document' : 'other';
                const associatedFile: AssociatedFile = { 
                    id: att.id, 
                    trelloId: att.id, 
                    name: att.fileName, 
                    size: `${(att.bytes / 1024).toFixed(2)} KB`, 
                    type: fileType, 
                    url: att.url 
                };
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

            const actionMilestones: Milestone[] = actions
              .filter(action => !existingHitosByTrelloId.has(action.id))
              .map(action => {
                let milestone: Milestone | null = null;
                if (action.type === 'commentCard' && action.data.text) {
                    milestone = { id: `hito-${action.id}`, name: `Comentario de ${action.memberCreator.fullName}`, description: action.data.text, occurredAt: action.date, category: commentsCategory, tags: ['comentario'], associatedFiles: [], isImportant: false, history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] };
                } else if (action.type === 'updateCard' && action.data.listAfter && action.data.listBefore) {
                    milestone = { id: `hito-${action.id}`, name: `Tarjeta movida`, description: `Movida de "${action.data.listBefore.name}" a "${action.data.listAfter.name}" por ${action.memberCreator.fullName}.`, occurredAt: action.date, category: activityCategory, tags: ['actividad', 'movimiento'], associatedFiles: [], isImportant: false, history: [`${format(new Date(), "PPpp", { locale: es })} - Creación desde actividad de Trello.`] };
                }
                return milestone;
            }).filter((m): m is Milestone => m !== null);

            const allTrelloItems = [creationMilestone, ...attachmentMilestones, ...actionMilestones];
            
            const currentTrelloIds = new Set([selectedCard.id, ...attachments.map(a => a.id), ...actions.map(a => a.id)]);
            const idsToRemove = existingDocsSnapshot.docs
              .filter(d => d.id.startsWith('hito-'))
              .map(d => d.id)
              .filter(id => !currentTrelloIds.has(id.replace('hito-', '')) && !id.includes('creacion'));

            if (allTrelloItems.length > 0 || idsToRemove.length > 0) {
                const batch = writeBatch(firestore);
                allTrelloItems.forEach(milestone => {
                    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', milestone.id);
                    batch.set(milestoneRef, milestone, { merge: true });
                });
                idsToRemove.forEach(id => {
                    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', id);
                    batch.delete(milestoneRef);
                });
                batch.commit().catch(err => console.error("Error committing sync batch:", err));
            }
        } catch (error: any) {
            console.error("Error synchronizing Trello:", error);
            syncPerformedForCard.current = null;
        }
    };

    syncTrelloToFirestore();
  }, [selectedCard, firestore, categories, toast]);


  const handleUpload = React.useCallback(async (data: { files?: File[], categoryId: string, name: string, description: string, occurredAt: Date }) => {
    if (!firestore || !selectedCard) return;

    if (selectedCard.id === 'training-rsa999') {
        toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden crear hitos para el proyecto de entrenamiento." });
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const { files, categoryId, name, description, occurredAt } = data;
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
        setIsUploading(false);
        return;
    };

    const { id: toastId, update, dismiss } = toast({
      title: "Verificando sincronización...",
      description: "Por favor, espera.",
      duration: Infinity,
    });

    try {
      // Fetch current Trello attachments to avoid duplicates
      const currentAttachments = await getCardAttachments(selectedCard.id);
      const existingNamesMap = new Map(currentAttachments.map(a => [a.fileName, a]));

      const codeMatch = selectedCard.name.match(/\b([A-Z]{3}\d{3})\b/i);
      const projectCode = codeMatch ? codeMatch[0].toUpperCase() : null;

      const associatedFiles: AssociatedFile[] = [];
      if (files && files.length > 0) {
        const totalFiles = files.length;
        for (const [index, file] of files.entries()) {
          const progressText = `(${index + 1}/${totalFiles}) ${file.name}`;
          setUploadText(progressText);
          update({ id: toastId, description: progressText });
          
          let fileId: string;
          let fileUrl: string;
          let trelloId: string | null = null;
          let driveId: string | null = null;

          // Check for existing attachment with same name to avoid duplicates
          const existingAtt = existingNamesMap.get(file.name);

          if (existingAtt) {
            update({ id: toastId, title: "Archivo ya existe en Trello", description: `Usando versión existente de ${file.name}` });
            fileId = existingAtt.id;
            fileUrl = existingAtt.url;
            trelloId = existingAtt.id;
          } else {
            const arrayBuffer = await file.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            
            if (file.size < 10 * 1024 * 1024) {
                update({ id: toastId, title: "Subiendo a Trello...", description: progressText });
                const trelloAtt = await uploadAttachmentToCard(selectedCard.id, file.name, base64Data);
                if (!trelloAtt) throw new Error("Error al subir a Trello");
                fileId = trelloAtt.id;
                fileUrl = trelloAtt.url;
                trelloId = trelloAtt.id;
            } else {
                update({ id: toastId, title: "Archivo grande: Subiendo a Drive...", description: progressText });
                const driveResult = await uploadFileToDrive(file.name, file.type, base64Data, projectCode);
                fileId = driveResult.id;
                fileUrl = driveResult.webViewLink;
                driveId = driveResult.id;
                
                update({ id: toastId, title: "Vinculando Drive con Trello...", description: progressText });
                const trelloAtt = await attachUrlToCard(selectedCard.id, file.name, driveResult.webViewLink);
                if (trelloAtt) trelloId = trelloAtt.id;
            }
          }
          
          const fileObj: AssociatedFile = {
            id: fileId,
            name: file.name,
            size: `${(file.size / 1024).toFixed(2)} KB`,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : ['application/pdf', 'application/msword', 'text/plain'].some(t => file.type.includes(t)) ? 'document' : 'other',
            url: fileUrl,
          };

          if (trelloId) fileObj.trelloId = trelloId;
          if (driveId) fileObj.driveId = driveId;

          associatedFiles.push(fileObj);
          setUploadProgress(((index + 1) / totalFiles) * 100);
        }
      }
      
      const now = new Date();
      const finalDate = new Date(occurredAt);
      if (isSameDay(finalDate, now)) {
        finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      } else {
        finalDate.setHours(7, 0, 0, 0);
      }

      const newMilestoneData = {
          name: name,
          description: description,
          occurredAt: finalDate.toISOString(),
          category: { id: category.id, name: category.name, color: category.color },
          tags: ['manual'],
          associatedFiles: associatedFiles,
          isImportant: false,
          history: [`${format(new Date(), "PPpp", { locale: es })} - Creación de hito con ${associatedFiles.length} archivo(s).`],
      };

      const milestonesRef = collection(firestore, 'projects', selectedCard.id, 'milestones');
      addDoc(milestonesRef, newMilestoneData)
        .catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: milestonesRef.path,
                operation: 'create',
                requestResourceData: newMilestoneData
            }));
        });
      
      setIsUploadOpen(false);
      dismiss(toastId);
      toast({ title: "Hito creado", description: "Sincronización completada correctamente." });
      
    } catch (error: any) {
        console.error("Upload error:", error);
        dismiss(toastId);
        toast({ variant: "destructive", title: "Error en la carga", description: error.message });
    } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadText('');
    }
  }, [categories, selectedCard, firestore, toast]);

  const handleMilestoneUpdate = React.useCallback((updatedMilestone: Milestone) => {
    if (!firestore || !selectedCard) return;

    if (selectedCard.id === 'training-rsa999') {
      toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden guardar cambios para el proyecto de entrenamiento." });
      return;
    }

    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', updatedMilestone.id);
    
    setDoc(milestoneRef, updatedMilestone, { merge: true })
        .then(() => {
            toast({ title: "Hito actualizado" });
            if (selectedMilestone && selectedMilestone.id === updatedMilestone.id) {
                setSelectedMilestone(updatedMilestone);
            }
        })
        .catch((serverError: any) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: milestoneRef.path,
                operation: 'update',
                requestResourceData: updatedMilestone
            }));
        });
  }, [selectedCard, selectedMilestone, firestore, toast]);

  const handleMilestoneDelete = React.useCallback((milestoneId: string) => {
    if (!firestore || !selectedCard) return;

    if (selectedCard.id === 'training-rsa999') {
      toast({ variant: "destructive", title: "Acción no permitida", description: "No se pueden borrar hitos del proyecto de entrenamiento." });
      return;
    }

    const milestoneRef = doc(firestore, 'projects', selectedCard.id, 'milestones', milestoneId);
    
    deleteDoc(milestoneRef)
        .then(() => {
            toast({ title: "Hito eliminado" });
            setSelectedMilestone(null);
        })
        .catch((serverError: any) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: milestoneRef.path,
                operation: 'delete'
            }));
        });
  }, [selectedCard, firestore, toast]);


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

  const handleCategoryColorChange = React.useCallback((categoryId: string, color: string) => {
    if (!firestore) return;
    const catRef = doc(firestore, 'categories', categoryId);
    updateDoc(catRef, { color })
        .catch(err => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: catRef.path,
                operation: 'update',
                requestResourceData: { color }
            }));
        });
  }, [firestore]);
  
  const handleCategoryAdd = React.useCallback((name: string) => {
    if (!firestore) return;
    const DEFAULT_COLORS = ['#a3e635', '#22c55e', '#14b8a6', '#0ea5e9', '#4f46e5', '#8b5cf6', '#be185d', '#f97316', '#facc15'];
    const color = DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length];
    const newCat = { name, color };
    addDoc(collection(firestore, 'categories'), newCat)
        .catch(err => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'categories',
                operation: 'create',
                requestResourceData: newCat
            }));
        });
  }, [firestore, categories]);

  const handleCategoryUpdate = React.useCallback((categoryId: string, name: string) => {
    if (!firestore) return;
    const newName = name.trim();
    if (!newName) return;
    const catRef = doc(firestore, 'categories', categoryId);
    updateDoc(catRef, { name: newName })
        .catch(err => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: catRef.path,
                operation: 'update',
                requestResourceData: { name: newName }
            }));
        });
  }, [firestore]);
  
  const handleCategoryDelete = React.useCallback((categoryId: string) => {
    if (!firestore) return;
    const catRef = doc(firestore, 'categories', categoryId);
    deleteDoc(catRef)
        .catch(err => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: catRef.path,
                operation: 'delete'
            }));
        });
  }, [firestore]);

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

  const handleSelectTrainingProject = () => {
    handleCardSelect({
        id: 'training-rsa999',
        name: 'Proyecto de Entrenamiento Maestro - RSA999',
        url: '',
        desc: 'Proyecto de ejemplo maestro con hitos de referencia para capacitación.'
    });
  };

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
          onSelectTrainingProject={handleSelectTrainingProject}
        />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {selectedCard && (
              <div className="px-4 md:px-6 py-3 border-b bg-background shrink-0">
                  <h2 className="text-xl font-headline font-medium text-foreground truncate" title={selectedCard.name}>
                      {selectedCard.name}
                  </h2>
              </div>
          )}
          
          {selectedCard && selectedCard.id !== 'training-rsa999' && (
            <div className="absolute top-16 right-6 z-30 no-print">
               <TooltipProvider>
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Button 
                          size="icon" 
                          className="h-10 w-10 shadow-lg rounded-md"
                          onClick={() => setIsUploadOpen(true)}
                        >
                          <Plus className="h-6 w-6" />
                        </Button>
                     </TooltipTrigger>
                     <TooltipContent side="left">
                        <p>Hito nuevo</p>
                     </TooltipContent>
                  </Tooltip>
               </TooltipProvider>
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
                ) : (displayedMilestones.length > 0 && dateRange) || selectedCard?.id === 'training-rsa999' ? (
                    <div className="h-full w-full">
                        <Timeline 
                            milestones={filteredMilestones} 
                            startDate={dateRange?.start || subMonths(new Date(), 6)}
                            endDate={dateRange?.end || addMonths(new Date(), 6)}
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
                              onMilestoneDelete={handleMilestoneDelete}
                              onClose={handleDetailClose}
                              projectName={selectedCard?.name || ''}
                              cardId={selectedCard?.id || null}
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
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadText={uploadText}
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
