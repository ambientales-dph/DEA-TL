import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});

/**
 * Modelo solicitado por el usuario para todas las operaciones de IA.
 * Se utiliza 'gemini-1.5-flash' ya que es la versión estable disponible que cumple con los requisitos de velocidad y precisión.
 */
export const geminiModel = 'gemini-1.5-flash';
