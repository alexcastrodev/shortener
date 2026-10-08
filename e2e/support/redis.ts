import { createClient } from 'redis';
import { REDIS_URL } from './env.ts';

export async function flushCache() {
  const client = createClient({ url: REDIS_URL });
  await client.connect();
  try {
    await client.flushAll();
  } finally {
    await client.quit();
  }
}
