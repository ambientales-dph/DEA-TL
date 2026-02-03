import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});

/**
 * Modelo solicitado por el usuario para todas las operaciones de IA.
 * Nota: El plugin googleAI gestiona internamente la versión de la API (v1/v1beta).
 */
export const geminiModel = 'gemini-2.5-flash';
