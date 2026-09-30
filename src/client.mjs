const joinUrl = (baseUrl, path) => `${String(baseUrl).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;

export function createOlympusClient({ baseUrl, appId, fetchImpl = fetch } = {}) {
  if (!baseUrl) throw new Error("baseUrl is required");
  if (!appId) throw new Error("appId is required");
  const request = async (path, options = {}) => {
    const response = await fetchImpl(joinUrl(baseUrl, path), {
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `OLYMPUS_REQUEST_FAILED:${response.status}`);
    return body;
  };
  return Object.freeze({
    getManifest: () => request(`/apps/${encodeURIComponent(appId)}/manifest`),
    getStatus: () => request(`/apps/${encodeURIComponent(appId)}`),
    getCurrent: () => request(`/apps/${encodeURIComponent(appId)}/current`),
    getVersions: () => request(`/apps/${encodeURIComponent(appId)}/versions`),
    getUpdates: () => request(`/apps/${encodeURIComponent(appId)}/updates`),
    createUpdate: input => request("/updates", { method: "POST", body: JSON.stringify({ ...input, appId }) }),
    preflight: workId => request(`/updates/${encodeURIComponent(workId)}/preflight`, { method: "POST", body: "{}" }),
    release: workId => request(`/updates/${encodeURIComponent(workId)}/release`, { method: "POST", body: "{}" }),
    readback: (workId, input) => request(`/updates/${encodeURIComponent(workId)}/readback`, { method: "POST", body: JSON.stringify(input) }),
  });
}