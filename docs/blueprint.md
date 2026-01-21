# **App Name**: Trello AI Assistant

## Core Features:

- Board Connection: Allow users to connect their Trello boards using the Trello API.
- AI Task Suggestion: Use Genkit to analyze Trello board content and suggest new tasks or subtasks relevant to the board's theme. Use a tool when needed to add the most accurate context.
- AI Task Description: Use Genkit to automatically generate a detailed description for new tasks created. Use a tool when needed to get more information about similar existing tasks.
- Task Management UI: A simple user interface to view and manage the existing tasks using components from shadcn/ui.
- User Authentication: Implement Firebase Authentication to allow users to securely sign up and log in.

## Style Guidelines:

- Primary color: Deep Indigo (#3F51B5) for a professional and focused feel.
- Background color: Light Gray (#F5F5F5), creating a clean backdrop that highlights the content.
- Accent color: Teal (#009688) to highlight interactive elements and calls to action, complementing the indigo.
- Body: 'Inter', sans-serif, with a clean, readable style, for all text and UI elements.
- Headings: 'Space Grotesk', sans-serif, which provides a touch of modernity.
- Use simple, consistent icons from a library like 'phosphor-react' to represent different task types and actions.
- Maintain a clean, organized layout using Tailwind CSS grid and flexbox. Prioritize readability and ease of navigation.
- Incorporate subtle transitions and animations (e.g., fade-ins, slide-ins) to enhance user experience and provide feedback on interactions.