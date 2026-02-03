import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1',
    }),
  ],
});

/**
 * Modelo estable utilizado para las operaciones de IA.
 * Se utiliza 'googleai/gemini-1.5-flash' por ser el modelo más compatible con la API v1
 * y tener las cuotas más amplias en el nivel gratuito.
 */
export const geminiModel = 'googleai/gemini-1.5-flash';
