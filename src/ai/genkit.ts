import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1', // Forzamos el uso de la API v1 estable
    }),
  ],
});

/**
 * Modelo estable utilizado para las operaciones de IA.
 * Se utiliza 'googleai/gemini-1.5-flash' por ser el modelo con mejor soporte
 * en la versión v1 de la API para tareas de extracción y estructuración.
 */
export const geminiModel = 'googleai/gemini-1.5-flash';
