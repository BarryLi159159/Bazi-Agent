import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';

export interface AuthUser {
  id: string;
  email: string | null;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const supabaseUrl = config.SUPABASE_URL?.replace(/\/$/, '') ?? '';
const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : '';
const jwks = supabaseUrl ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : null;

function getBearerToken(req: Request): string | null {
  const header = req.header('Authorization');
  if (!header) {
    return null;
  }
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireSupabaseAuth(req: Request, res: Response, next: NextFunction) {
  if (!supabaseUrl || !jwks) {
    return res.status(500).json({ error: 'Supabase auth is not configured on the server' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
    });

    const subject = typeof payload.sub === 'string' ? payload.sub : '';
    if (!subject) {
      return res.status(401).json({ error: 'Invalid auth subject' });
    }

    req.authUser = {
      id: subject,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
    return next();
  } catch (error) {
    console.warn('[Auth] Supabase JWT verification failed', error);
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }
}

export function getRequiredAuthUser(req: Request): AuthUser {
  if (!req.authUser) {
    throw new Error('Authenticated user missing on request');
  }
  return req.authUser;
}
