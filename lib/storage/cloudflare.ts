import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getD1Database(): Promise<D1Database | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB;
  } catch {
    return undefined;
  }
}

export async function getEnvValue(name: keyof CloudflareEnv | string): Promise<string | undefined> {
  const processValue = process.env[String(name)];
  if (processValue) return processValue;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const value = env[name as keyof CloudflareEnv];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function nowIso() {
  return new Date().toISOString();
}
