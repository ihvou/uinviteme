export type Fetcher = typeof fetch;

export interface SupabaseServiceEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export async function supabaseRest<T = unknown>(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetcher(
    `${env.supabaseUrl.replace(/\/+$/, "")}${path}`,
    {
      ...init,
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase REST failed: ${response.status} ${await response.text()}`,
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) as T : null as T;
}
