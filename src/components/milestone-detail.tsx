
'use client';

import * as React from 'react';
import type { Milestone, Category, AssociatedFile } from '@/types';
import { FileIcon } from './file-icon';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Paperclip, Tag, X, Star, Pencil, History, UploadCloud, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToDrive } from '@/services/google-drive';
import { uploadAttachmentToCard, attachUrlToCard, getCardAttachments } from '@/services/trello';
import { Buffer } from 'buffer';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface MilestoneDetailProps {
  milestone: Milestone;
  categories: Category[];
  onMilestoneUpdate: (updatedMilestone: Milestone) => void;
  onMilestoneDelete: (milestoneId: string) => void;
  onClose: () => void;
  projectName: string;
  cardId: string | null;
}

export function MilestoneDetail({ milestone, categories, onMilestoneUpdate, onMilestoneDelete, onClose, projectName, cardId }: MilestoneDetailProps) {
  const [newTag, setNewTag] = React.useState('');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editableTitle, setEditableTitle] = React.useState('');
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [editableDescription, setEditableDescription] = React.useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (milestone) {
      setEditableTitle(milestone.name);
      setEditableDescription(milestone.description);
      setNewTag('');
      setIsEditingTitle(false);
      setIsEditingDescription(false);
      setIsDeleteDialogOpen(false);
      setDeleteConfirmation('');
    }
  }, [milestone]);

  const createLogEntry = (action: string): string => {
    return `${format(new Date(), "PPpp", { locale: es })} - ${action}`;
  };

  const handleTitleSave = () => {
    if (milestone && editableTitle.trim() && editableTitle.trim() !== milestone.name) {
      const updatedMilestone = {
        ...milestone,
        name: editableTitle.trim(),
        history: [...milestone.history, createLogEntry(`Título cambiado a "${editableTitle.trim()}"`)],
      };
      onMilestoneUpdate(updatedMilestone);
    }
    setIsEditingTitle(false);
  };
  
  const handleDescriptionSave = () => {
    if (milestone && editableDescription.trim() !== milestone.description) {
        onMilestoneUpdate({
            ...milestone,
            description: editableDescription.trim(),
            history: [...milestone.history, createLogEntry('Descripción actualizada.')],
        });
    }
    setIsEditingDescription(false);
  };

  const handleCategoryChange = (categoryId: string) => {
    const newCategory = categories.find(c => c.id === categoryId);
    if (newCategory && milestone && newCategory.id !== milestone.category.id) {
      onMilestoneUpdate({
        ...milestone,
        category: newCategory,
        history: [...milestone.history, createLogEntry(`Categoría cambiada a "${newCategory.name}"`)],
      });
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate && milestone) {
      const now = new Date();
      let finalDate = new Date(newDate);

      if (isSameDay(finalDate, now)) {
        finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      } else {
        finalDate.setHours(7, 0, 0, 0);
      }

      if (finalDate.toISOString() !== milestone.occurredAt) {
        onMilestoneUpdate({
          ...milestone,
          occurredAt: finalDate.toISOString(),
          history: [...milestone.history, createLogEntry(`Fecha cambiada a ${format(finalDate, 'PPP', { locale: es })}`)],
        });
      }
    }
  };

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim() !== '' && milestone) {
      e.preventDefault();
      if (milestone.tags && milestone.tags.includes(newTag.trim())) {
        setNewTag('');
        return;
      }
      const newTagName = newTag.trim();
      const updatedTags = [...(milestone.tags || []), newTagName];
      onMilestoneUpdate({
        ...milestone,
        tags: updatedTags,
        history: [...milestone.history, createLogEntry(`Etiqueta añadida: "${newTagName}"`)],
      });
      setNewTag('');
    }
  };
  
  const handleTagRemove = (tagToRemove: string) => {
    if (milestone) {
        const updatedTags = (milestone.tags || []).filter(tag => tag !== tagToRemove);
        onMilestoneUpdate({
          ...milestone,
          tags: updatedTags,
          history: [...milestone.history, createLogEntry(`Etiqueta eliminada: "${tagToRemove}"`)],
        });
    }
  };

  const handleToggleImportant = () => {
    if (milestone) {
      const action = !milestone.isImportant ? 'marcado como importante' : 'desmarcado como importante';
      onMilestoneUpdate({
        ...milestone,
        isImportant: !milestone.isImportant,
        history: [...milestone.history, createLogEntry(`Hito ${action}`)],
      });
    }
  };

  const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !milestone) return;

    const filesToUpload = Array.from(e.target.files);
    if (e.target) e.target.value = '';

    const { id: toastId, update, dismiss } = toast({
      title: "Verificando Trello...",
      description: `Comprobando ${filesToUpload.length} archivo(s) para evitar duplicados.`,
      duration: Infinity,
    });

    try {
      // Refresh current Trello attachments to avoid duplicating existing files
      let currentAttachments: any[] = [];
      if (cardId) {
        currentAttachments = await getCardAttachments(cardId);
      }
      const existingNamesMap = new Map(currentAttachments.map(a => [a.fileName, a]));

      const codeMatch = projectName.match(/\b([A-Z]{3}\d{3})\b/i);
      const projectCode = codeMatch ? codeMatch[0].toUpperCase() : null;

      const newAssociatedFiles: AssociatedFile[] = [];
      for (const file of filesToUpload) {
        // Check if file is already associated with this milestone locally
        if (milestone.associatedFiles.some(af => af.name === file.name)) {
          update({ id: toastId, title: "Archivo ya vinculado", description: `"${file.name}" ya forma parte de este hito.` });
          continue;
        }

        update({ id: toastId, description: `Procesando "${file.name}"...` });

        let fileId: string;
        let fileUrl: string;
        let trelloId: string | null = null;
        let driveId: string | null = null;

        // Check for existing attachment on the card to reuse instead of re-uploading
        const existingAtt = existingNamesMap.get(file.name);

        if (existingAtt) {
            update({ id: toastId, title: "Archivo reutilizado", description: `"${file.name}" ya existe en Trello.` });
            fileId = existingAtt.id;
            fileUrl = existingAtt.url;
            trelloId = existingAtt.id;
        } else {
            const arrayBuffer = await file.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');

            if (file.size < 10 * 1024 * 1024 && cardId) {
                update({ id: toastId, title: "Subiendo a Trello...", description: file.name });
                const trelloAtt = await uploadAttachmentToCard(cardId, file.name, base64Data);
                if (!trelloAtt) throw new Error("Error en Trello");
                fileId = trelloAtt.id;
                fileUrl = trelloAtt.url;
                trelloId = trelloAtt.id;
            } else {
                update({ id: toastId, title: "Archivo grande: Subiendo a Drive...", description: file.name });
                const driveResult = await uploadFileToDrive(file.name, file.type, base64Data, projectCode);
                fileId = driveResult.id;
                fileUrl = driveResult.webViewLink;
                driveId = driveResult.id;
                
                if (cardId) {
                    update({ id: toastId, title: "Vinculando Drive con Trello...", description: file.name });
                    const trelloAtt = await attachUrlToCard(cardId, file.name, driveResult.webViewLink);
                    if (trelloAtt) trelloId = trelloAtt.id;
                }
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

        newAssociatedFiles.push(fileObj);
      }

      if (newAssociatedFiles.length > 0) {
        onMilestoneUpdate({
          ...milestone,
          associatedFiles: [...milestone.associatedFiles, ...newAssociatedFiles],
          history: [...milestone.history, createLogEntry(`Se añadieron ${newAssociatedFiles.length} archivo(s)`)],
        });
      }

      dismiss(toastId);
      toast({ title: "Sincronización finalizada", description: "Archivos vinculados correctamente." });
    } catch (error: any) {
      console.error("Error adding files:", error);
      dismiss(toastId);
      toast({ variant: "destructive", title: "Error al añadir archivos", description: error.message });
    }
  };

  const handleDeleteConfirmed = () => {
    if (deleteConfirmation === 'borralo') {
      onMilestoneDelete(milestone.id);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-3 overflow-hidden text-black">
        <div className="flex items-start justify-between gap-2 shrink-0">
            <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                <Input
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    className="text-lg font-headline font-medium h-auto p-0 border-0 border-b-2 border-primary rounded-none focus-visible:ring-0 bg-transparent"
                    autoFocus
                />
                ) : (
                <h2 className="font-headline text-lg font-medium flex items-center gap-2 truncate">
                    <span className="truncate" title={milestone.name}>{milestone.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setIsEditingTitle(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                </h2>
                )}
                <div className="flex items-center pt-1.5">
                    <Select value={milestone.category.id} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="w-auto border-none shadow-none focus:ring-0 gap-2 h-auto p-0 text-xs font-medium text-zinc-700 hover:text-black focus:text-black disabled:opacity-100 bg-transparent">
                            <SelectValue asChild>
                                <div className="flex items-center cursor-pointer">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full mr-2 shrink-0"
                                        style={{ backgroundColor: milestone.category.color }}
                                    />
                                    <span>{milestone.category.name}</span>
                                </div>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                    <div className="flex items-center">
                                        <div
                                            className="w-2 h-2 rounded-full mr-2"
                                            style={{ backgroundColor: category.color }}
                                        />
                                        {category.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-center text-xs text-zinc-700 mt-1.5">
                    <Clock className="h-3 w-3 mr-1.5" />
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="hover:text-black transition-colors focus:outline-none underline decoration-dotted underline-offset-2">
                                {format(parseISO(milestone.occurredAt), "PPP 'a las' p", { locale: es })}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={parseISO(milestone.occurredAt)}
                                onSelect={handleDateChange}
                                disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                                captionLayout="dropdown"
                                fromYear={1900}
                                toYear={new Date().getFullYear()}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button 
                    onClick={handleToggleImportant} 
                    className="p-1 rounded-full text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:hover:text-zinc-500 disabled:hover:bg-transparent"
                    aria-label={milestone.isImportant ? 'Quitar de importantes' : 'Marcar como importante'}
                >
                    <Star className={cn("h-5 w-5", milestone.isImportant && "fill-yellow-400 text-yellow-400")} />
                </button>
                <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)} className="h-8 w-8 text-zinc-700 hover:text-destructive transition-colors" title="Eliminar hito">
                    <Trash2 className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-700 hover:text-black">
                    <X className="h-5 w-5" />
                </Button>
            </div>
        </div>
        
        <Separator className="my-2 shrink-0 bg-zinc-400/50" />
        
        <ScrollArea className="flex-1 -mr-3 pr-3">
            <div className="space-y-3">
                {isEditingDescription ? (
                <Textarea
                    value={editableDescription}
                    onChange={(e) => setEditableDescription(e.target.value)}
                    onBlur={handleDescriptionSave}
                    onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        setIsEditingDescription(false);
                        setEditableDescription(milestone.description);
                    }
                    }}
                    className="text-sm leading-normal w-full bg-zinc-100 border-zinc-400 text-black"
                    autoFocus
                    rows={3}
                />
                ) : (
                <div
                    className={cn(
                        "text-sm text-zinc-700 leading-normal relative",
                        "cursor-pointer hover:bg-zinc-400/30 p-2 -m-2 rounded-md transition-colors group"
                    )}
                    onClick={() => setIsEditingDescription(true)}
                >
                    <p className="whitespace-pre-wrap">{milestone.description || 'Añade una descripción...'}</p>
                    <Pencil className="h-3 w-3 absolute top-1 right-1 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                )}
                
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Tag className="h-4 w-4 text-zinc-600" />
                        {(milestone.tags || []).map(tag => (
                            <Badge key={tag} className="group/badge relative pl-2.5 pr-1 py-0.5 text-xs bg-zinc-200 text-black hover:bg-zinc-200/80 border-transparent">
                                {tag}
                                <button 
                                    onClick={() => handleTagRemove(tag)} 
                                    className="ml-1 rounded-full opacity-50 group-hover/badge:opacity-100 hover:bg-destructive/10 p-0.5 transition-opacity disabled:hover:bg-transparent text-destructive"
                                    aria-label={`Quitar etiqueta ${tag}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <Input 
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleTagAdd}
                        placeholder={"Añadir etiqueta y presionar Enter..."}
                        className="h-8 bg-zinc-100 text-xs border border-zinc-400 text-black placeholder:text-zinc-500"
                    />
                </div>
            
                <Separator className="bg-zinc-400/50" />

                <div className="space-y-2">
                    <h3 className="font-semibold flex items-center justify-between gap-2 text-sm text-black">
                        <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" /> Archivos Adjuntos
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-black border-zinc-400 hover:bg-zinc-200" onClick={() => fileInputRef.current?.click()}>
                            <UploadCloud className="mr-2 h-3 w-3"/>
                            Añadir
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            onChange={handleFileAdd}
                        />
                    </h3>
                    {milestone.associatedFiles.length > 0 ? (
                        <ul className="space-y-1.5 border border-zinc-400 rounded-md p-2 bg-zinc-200">
                           {milestone.associatedFiles.map(file => (
                                <li key={file.id}>
                                    {file.url ? (
                                        <a 
                                            href={file.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="flex items-center justify-between p-1.5 bg-zinc-100 rounded-md hover:bg-zinc-50 transition-colors group/link"
                                            title={`Abrir "${file.name}" en una nueva pestaña`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileIcon type={file.type} />
                                                <span className="text-xs font-medium truncate text-black">{file.name}</span>
                                            </div>
                                            <div className="flex items-center shrink-0 ml-2">
                                                <span className="text-xs text-zinc-700 mr-2">{file.size}</span>
                                                <ExternalLink className="h-3 w-3 text-zinc-500 group-hover/link:text-primary transition-colors" />
                                            </div>
                                        </a>
                                    ) : (
                                        <div className="flex items-center justify-between p-1.5 bg-zinc-100 rounded-md">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileIcon type={file.type} />
                                                <span className="text-xs font-medium truncate text-black">{file.name}</span>
                                            </div>
                                            <span className="text-xs text-zinc-700 shrink-0 ml-2">{file.size}</span>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-zinc-700 italic">No hay archivos adjuntos para este hito.</p>
                    )}
                </div>
                
                <Separator className="bg-zinc-400/50" />

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="history" className="border-b-0">
                        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-1 text-black">
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4" /> Historial de Cambios
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <ul className="space-y-1.5 text-xs text-zinc-700 pr-4 max-h-24 overflow-y-auto">
                            {milestone.history.slice().reverse().map((entry, index) => (
                                <li key={index}>{entry}</li>
                            ))}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </ScrollArea>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[400px] bg-zinc-100 text-black border-zinc-400">
                <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                        <Trash2 className="h-5 w-5" /> Confirmar Eliminación
                    </DialogTitle>
                    <DialogDescription className="text-zinc-700 pt-2">
                        Esta acción es irreversible y eliminará el hito permanentemente. 
                        Para confirmar, escribí <span className="font-bold text-black select-none">borralo</span> a continuación:
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Escribí aquí..."
                        className="bg-white border-zinc-400 text-black focus:ring-destructive focus:border-destructive"
                        autoFocus
                    />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-zinc-400 text-black hover:bg-zinc-200">
                        Cancelar
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleDeleteConfirmed} 
                        disabled={deleteConfirmation !== 'borralo'}
                        className="disabled:opacity-50"
                    >
                        Eliminar definitivamente
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
