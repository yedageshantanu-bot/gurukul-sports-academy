import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthenticatedUser } from '../types/auth.types.js';

export interface RequestContextStore {
  user?: AuthenticatedUser;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();
