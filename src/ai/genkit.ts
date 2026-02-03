import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});

// Exportamos referencias explícitas a los modelos para evitar errores de resolución por string.
// Usamos los nombres cortos que son compatibles con el plugin de Google AI.
export const gemini15Flash = 'gemini-1.5-flash';
export const gemini15Pro = 'gemini-1.5-pro';
