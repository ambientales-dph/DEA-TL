import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});

/**
 * Modelo estable utilizado para las operaciones de IA.
 * Se utiliza 'googleai/gemini-1.5-flash' por su amplia cuota en el nivel gratuito y estabilidad.
 */
export const geminiModel = 'googleai/gemini-1.5-flash';
