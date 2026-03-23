import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';

function getKeyMaterial(): Buffer {
  const raw = config.APP_SECRETS_KEY;
  if (!raw) {
    throw new Error('APP_SECRETS_KEY is required for encrypted user secrets');
  }
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const key = getKeyMaterial();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid encrypted secret payload');
  }

  const key = getKeyMaterial();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]);
  return plaintext.toString('utf8');
}
