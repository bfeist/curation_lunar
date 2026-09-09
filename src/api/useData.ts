import { useEffect, useState } from "react";

export function useData<T>(url: string) {
  const [result, setResult] = useState<{
    url: string;
    data?: T;
    error?: string;
  }>({ url: "" });
  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? `Request failed (${response.status})`);
        }
        return response.json() as Promise<T>;
      })
      .then((data) => setResult({ url, data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            url,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load this page.",
          });
      });
    return () => controller.abort();
  }, [url]);
  return {
    data: result.url === url ? result.data : undefined,
    error: result.url === url ? result.error : undefined,
  };
}
