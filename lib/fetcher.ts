export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  
  const contentType = response.headers.get("content-type");
  let data: any = null;

  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || (await response.text().catch(() => "")) || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return (data !== null ? data : ((await response.text().catch(() => "")) as unknown as T));
}

