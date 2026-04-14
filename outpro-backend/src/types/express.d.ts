// src/types/express.d.ts
// Augments the Express Request type so req.user is available without casting
// after the authenticate middleware has run.

import { AdminRole } from './api.types';

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by the authenticate middleware after JWT verification.
       * Only present on protected routes — always check route guard order.
       */
      user?: {
        id: string;
        email: string;
        role: AdminRole;
        sessionId: string;
      };
    }
  }
}

// This file has no exports — it is a pure ambient declaration.
export {};
