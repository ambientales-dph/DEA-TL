import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});

// Exportamos referencias explícitas a los modelos para evitar errores de resolución por string
export const gemini15Flash = 'googleai/gemini-1.5-flash';
export const gemini15Pro = 'googleai/gemini-1.5-pro';
