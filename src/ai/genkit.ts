import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

/**
 * Modelo solicitado por el usuario para todas las operaciones de IA.
 * Se utiliza 'googleai/gemini-2.0-flash' por su alta velocidad y capacidades avanzadas.
 */
export const geminiModel = 'googleai/gemini-2.0-flash';
