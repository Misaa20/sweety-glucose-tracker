export async function api(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      signal,
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "We could not reach the server. Check your connection and try again.",
    );
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(
      data?.message || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    error.fields = data?.errors || {};
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("sweety:session-expired"));
    throw error;
  }
  return data;
}
