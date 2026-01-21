import type { Auth } from "firebase/auth";

// Authentication has been removed from the application.
// This file is kept to prevent breaking imports where auth was used,
// but the functionality is disabled.
const auth: Auth | null = null;

export { auth };
