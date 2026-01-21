import { config } from 'dotenv';
config();

import '@/ai/flows/generate-task-descriptions.ts';
import '@/ai/flows/suggest-relevant-tasks.ts';