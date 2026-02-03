
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Category } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Textarea } from './ui/textarea';
import { UploadCloud, X, File as FileIconLucide, CalendarIcon, Loader2 } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Progress } from './ui/progress';

const uploadSchema = z.object({
  name: z.string().min(5, { message: 'El título del hito debe tener al menos 5 caracteres.' }),
  description: z.string().min(10, { message: 'La descripción debe tener al menos 10 caracteres.' }),
  occurredAt: z.date({
    required_error: "Se requiere una fecha para el hito.",
  }),
  files: z.array(z.instanceof(File)).optional(),
  categoryId: z.string().min(1, 'Por favor, seleccioná una categoría.'),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface FileUploadProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  categories: Category[];
  onUpload: (data: { files?: File[], categoryId: string, name: string, description: string, occurredAt: Date }) => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadText: string;
}

export function FileUpload({
  isOpen,
  onOpenChange,
  categories,
  onUpload,
  isUploading,
  uploadProgress,
  uploadText,
}: FileUploadProps) {
  const [showCalendar, setShowCalendar] = React.useState(false);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: '',
      description: '',
      files: [],
      categoryId: '',
      occurredAt: new Date(),
    },
  });

  React.useEffect(() => {
    if (!isOpen) {
      form.reset();
      form.setValue('occurredAt', new Date());
      setShowCalendar(false);
    }
  }, [form, isOpen]);

  const onSubmit = (data: UploadFormValues) => {
    onUpload(data);
  };
  
  const selectedFiles = form.watch('files') || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    if (newFiles.length === 0) return;
    
    const currentFiles = form.getValues('files') || [];
    form.setValue('files', [...currentFiles, ...newFiles], { shouldValidate: true });
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    const currentFiles = form.getValues('files') || [];
    const updatedFiles = currentFiles.filter((_, index) => index !== indexToRemove);
    form.setValue('files', updatedFiles, { shouldValidate: true });
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "bg-zinc-300 text-black p-0 transition-all duration-300 overflow-hidden",
        showCalendar ? "sm:max-w-[800px]" : "sm:max-w-[440px]"
      )}>
        <div className="flex flex-row h-full">
            {/* Panel Principal */}
            <div className="flex-1 p-6 border-r border-zinc-400/30">
                <DialogHeader className="space-y-1 mb-4">
                <DialogTitle className="font-headline text-lg">Cargar un nuevo hito</DialogTitle>
                <DialogDescription className="text-zinc-700 text-xs">
                    Agregá un hito a la línea de tiempo. Describí el evento y adjuntá archivos si es necesario.
                </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                    {isUploading ? (
                    <div className="space-y-2 py-4 text-center">
                        <p className="text-xs font-medium text-zinc-800">{uploadText}</p>
                        <Progress value={uploadProgress} className="w-full h-2" />
                        <p className="text-[10px] text-zinc-600">Podés cerrar esta ventana. La subida continuará en segundo plano.</p>
                    </div>
                    ) : (
                    <fieldset disabled={isUploading} className="space-y-3">
                        <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs font-semibold">Título del hito</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Presentación de Avance" {...field} className="h-8 text-sm bg-zinc-100 text-black border-zinc-400 placeholder:text-zinc-500" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs font-semibold">Descripción</FormLabel>
                            <FormControl>
                                <Textarea
                                placeholder="Contexto del hito..."
                                className="min-h-[60px] text-sm resize-none bg-zinc-100 text-black border-zinc-400 placeholder:text-zinc-500"
                                rows={2}
                                {...field}
                                />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                            control={form.control}
                            name="occurredAt"
                            render={({ field }) => (
                                <FormItem className="flex flex-col space-y-1">
                                <FormLabel className="text-xs font-semibold">Fecha</FormLabel>
                                <Button
                                    type="button"
                                    variant={"outline"}
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className={cn(
                                        "w-full h-8 pl-3 text-left text-sm font-normal bg-zinc-100 text-black border-zinc-400 hover:bg-zinc-200",
                                        showCalendar && "border-primary ring-1 ring-primary",
                                        !field.value && "text-zinc-500"
                                    )}
                                >
                                    {field.value ? (
                                        format(field.value, "dd/MM/yyyy", { locale: es })
                                    ) : (
                                        <span>Fecha</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                                </Button>
                                <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="categoryId"
                            render={({ field }) => (
                                <FormItem className="space-y-1">
                                <FormLabel className="text-xs font-semibold">Categoría</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger className="h-8 text-sm bg-zinc-100 text-black border-zinc-400">
                                        <SelectValue placeholder="Categoría" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {categories.map(category => (
                                        <SelectItem key={category.id} value={category.id} className="text-xs">
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
                                <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}
                            />
                        </div>
                        
                        <FormField
                        control={form.control}
                        name="files"
                        render={() => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs font-semibold">Archivos adjuntos (opcional)</FormLabel>
                            <FormControl>
                                <div className="space-y-2">
                                <div 
                                    className="border-2 border-dashed border-zinc-500/50 rounded-lg p-3 text-center cursor-pointer hover:bg-zinc-400/50 hover:border-primary transition-colors"
                                    onClick={() => document.getElementById('file-input')?.click()}
                                >
                                    <UploadCloud className="mx-auto h-6 w-6 text-zinc-600" />
                                    <p className="mt-1 text-[10px] text-zinc-600 leading-tight">
                                        Arrastrá o hacé clic para subir
                                    </p>
                                    <input id="file-input" type="file" className="hidden" multiple onChange={handleFileChange} />
                                </div>
                                {selectedFiles.length > 0 && (
                                    <ul className="max-h-24 overflow-y-auto space-y-1 rounded-md border border-zinc-400 p-1.5 bg-zinc-200">
                                        {selectedFiles.map((file, index) => (
                                            <li key={index} className="flex items-center justify-between text-[10px] p-1 bg-zinc-100 rounded">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <FileIconLucide className="h-3 w-3 shrink-0" />
                                                <span className="truncate" title={file.name}>{file.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(index)}
                                                className="p-0.5 rounded-full hover:bg-destructive/10 text-destructive shrink-0"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                        />
                    </fieldset>
                    )}
                    <DialogFooter className="pt-2 gap-2 flex flex-row justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-black border-zinc-400 hover:bg-zinc-200 h-8">
                        Cerrar
                    </Button>
                    <Button type="submit" size="sm" disabled={isUploading} className="h-8">
                        {isUploading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        {isUploading ? 'Guardando...' : 'Crear Hito'}
                    </Button>
                    </DialogFooter>
                </form>
                </Form>
            </div>

            {/* Panel de Calendario (Extensión) */}
            {showCalendar && (
                <div className="w-[360px] bg-zinc-200 p-6 flex flex-col items-center animate-in slide-in-from-left-4 duration-300">
                    <div className="w-full flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold font-headline">Seleccionar Fecha</h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCalendar(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <Calendar
                        mode="single"
                        selected={form.watch('occurredAt')}
                        onSelect={(date) => {
                            if (date) {
                                form.setValue('occurredAt', date);
                                setShowCalendar(false);
                            }
                        }}
                        disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        captionLayout="dropdown"
                        fromYear={1900}
                        toYear={new Date().getFullYear()}
                        locale={es}
                        className="bg-white rounded-lg shadow-xl border border-zinc-300"
                    />
                    <p className="mt-4 text-[10px] text-zinc-600 text-center">
                        Hacé clic en un día para seleccionarlo y cerrar el calendario.
                    </p>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
