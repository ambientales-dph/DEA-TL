'use server';

/**
 * @fileOverview A Genkit flow for generating detailed task descriptions.
 *
 * - generateTaskDescription - A function that generates a task description.
 * - GenerateTaskDescriptionInput - The input type for the generateTaskDescription function.
 * - GenerateTaskDescriptionOutput - The return type for the generateTaskDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTaskDescriptionInputSchema = z.object({
  taskTitle: z.string().describe('The title of the task.'),
  boardContent: z.string().describe('Context about the Trello board the task belongs to.'),
  similarTasks: z.array(z.string()).optional().describe('A list of similar tasks that are already on the board.'),
});

export type GenerateTaskDescriptionInput = z.infer<typeof GenerateTaskDescriptionInputSchema>;

const GenerateTaskDescriptionOutputSchema = z.object({
  description: z.string().describe('A detailed description of the task.'),
});

export type GenerateTaskDescriptionOutput = z.infer<typeof GenerateTaskDescriptionOutputSchema>;

const generateTaskDescriptionPrompt = ai.definePrompt({
  name: 'generateTaskDescriptionPrompt',
  input: {schema: GenerateTaskDescriptionInputSchema},
  output: {schema: GenerateTaskDescriptionOutputSchema},
  prompt: `You are an AI assistant designed to generate detailed task descriptions for Trello boards.

  Given the task title, board content and similar tasks, generate a comprehensive description for the task.

  Task Title: {{{taskTitle}}}
  Board Content: {{{boardContent}}}
  {{#if similarTasks}}
  Similar Tasks:
  {{#each similarTasks}}
  - {{{this}}}
  {{/each}}
  {{/if}}

  Description:`, 
});

const generateTaskDescriptionFlow = ai.defineFlow(
  {
    name: 'generateTaskDescriptionFlow',
    inputSchema: GenerateTaskDescriptionInputSchema,
    outputSchema: GenerateTaskDescriptionOutputSchema,
  },
  async input => {
    const {output} = await generateTaskDescriptionPrompt(input);
    return output!;
  }
);

export async function generateTaskDescription(input: GenerateTaskDescriptionInput): Promise<GenerateTaskDescriptionOutput> {
  return generateTaskDescriptionFlow(input);
}
