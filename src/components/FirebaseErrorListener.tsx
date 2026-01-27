"use client";

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from "@/hooks/use-toast";

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error("Firestore Permission Error caught by listener:", error.toJSON());

      // Instead of throwing, which is for dev overlay, we show a user-friendly toast.
      toast({
        variant: "destructive",
        title: "Error de Permisos",
        description: `No tienes permiso para realizar la acción: ${error.context.operation} en ${error.context.path}. Revisa las reglas de seguridad de Firestore.`,
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  // This component does not render anything
  return null;
}
