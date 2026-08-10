/**
 * `fetch` rejects with a bare "Failed to fetch" for every network-layer problem
 * — DNS, TLS, CORS, an offline machine, a corporate proxy — which tells the user
 * nothing about which one they are looking at. This wraps that into a message
 * that at least names the suspects.
 */
export async function requestJson(url: URL | string, provider: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch (cause) {
    throw new Error(
      `Could not reach ${provider}. Check your connection — and if you are on a restricted or corporate network, it may be blocking the request.`,
      { cause },
    );
  }
}
