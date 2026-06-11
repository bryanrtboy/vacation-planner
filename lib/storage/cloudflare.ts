import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getD1Database(): Promise<D1Database | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB;
  } catch {
    return undefined;
  }
}

export function nowIso() {
  return new Date().toISOString();
}
