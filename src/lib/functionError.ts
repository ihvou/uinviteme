export async function getFunctionErrorMessage(error: unknown) {
  const response = (error as { context?: Response } | null)?.context;

  if (response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // Fall back to the SDK error below.
    }
  }

  return error instanceof Error ? error.message : 'Request failed';
}
