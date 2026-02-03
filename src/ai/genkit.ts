import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI(), // Usamos la configuración por defecto (v1beta) para soporte total de esquemas JSON
  ],
});

/**
 * Modelo estable utilizado para las operaciones de IA.
 * Se utiliza 'googleai/gemini-1.5-flash' por ser el modelo más compatible
 * y con mejor soporte para salida estructurada (JSON).
 */
export const geminiModel = 'googleai/gemini-1.5-flash';
