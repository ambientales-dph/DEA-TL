'use server';

/**
 * @fileOverview Suggests relevant tasks for a Trello board based on its content.
 *
 * - suggestRelevantTasks - A function that takes Trello board content and suggests new tasks.
 * - SuggestRelevantTasksInput - The input type for the suggestRelevantTasks function.
 * - SuggestRelevantTasksOutput - The return type for the suggestRelevantTasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRelevantTasksInputSchema = z.object({
  boardName: z.string().describe('The name of the Trello board.'),
  boardDescription: z.string().describe('The description of the Trello board.'),
  existingTasks: z.array(z.string()).describe('A list of existing tasks on the board.'),
});
export type SuggestRelevantTasksInput = z.infer<typeof SuggestRelevantTasksInputSchema>;

const SuggestRelevantTasksOutputSchema = z.object({
  suggestedTasks: z.array(z.string()).describe('A list of tasks suggested by the AI.'),
});
export type SuggestRelevantTasksOutput = z.infer<typeof SuggestRelevantTasksOutputSchema>;

export async function suggestRelevantTasks(input: SuggestRelevantTasksInput): Promise<SuggestRelevantTasksOutput> {
  return suggestRelevantTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRelevantTasksPrompt',
  input: {schema: SuggestRelevantTasksInputSchema},
  output: {schema: SuggestRelevantTasksOutputSchema},
  prompt: `You are a project management assistant specializing in Trello boards.

  You will analyze the Trello board's content and suggest new tasks that might be relevant to the board's theme.
  Consider the existing tasks when suggesting new ones to avoid redundancy.

  Board Name: {{{boardName}}}
  Board Description: {{{boardDescription}}}
  Existing Tasks: {{#each existingTasks}}{{{this}}}\n{{/each}}

  Suggest new tasks that would be relevant to this Trello board. Return the tasks as a list.
  The tasks must be specific and actionable.
  Do not duplicate the existing tasks.
  Keep the task suggestions to a maximum of 5.
  `,
});

const suggestRelevantTasksFlow = ai.defineFlow(
  {
    name: 'suggestRelevantTasksFlow',
    inputSchema: SuggestRelevantTasksInputSchema,
    outputSchema: SuggestRelevantTasksOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
