const apiUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "/api");

function normalizeApiBaseUrl(value: string) {
  if (value === "/") {
    return "";
  }

  return value.replace(/\/$/, "");
}

type ApiErrorBody = {
  message?: string;
};

export type AppUser = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServiceApiKey = {
  id: string;
  name: string;
  key: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayLog = {
  id: string;
  source: string;
  eventType: string;
  serviceApiKeyId: string | null;
  serviceApiKeyName: string | null;
  symbols: string[];
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};

    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }

    throw new ApiError(body.message ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export async function getApiHealth() {
  return request<{
    status: string;
    timestamp: string;
  }>("/health");
}

export async function getBootstrapStatus() {
  return request<{
    registrationOpen: boolean;
  }>("/auth/bootstrap");
}

export async function getCurrentUser() {
  return request<{
    user: AppUser;
  }>("/auth/me");
}

export async function login(payload: { email: string; password: string }) {
  return request<{
    user: AppUser;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: { name: string; email: string; password: string }) {
  return request<{
    user: AppUser;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return request<{ ok: true }>("/auth/logout", {
    method: "POST",
  });
}

export async function listUsers() {
  return request<{
    users: AppUser[];
  }>("/users");
}

export async function createUser(payload: { name: string; email: string; password: string }) {
  return request<{
    user: AppUser;
  }>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: string, payload: { active: boolean }) {
  return request<{
    user: AppUser;
  }>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function listApiKeys() {
  return request<{
    apiKeys: ServiceApiKey[];
  }>("/api-keys");
}

export async function createApiKey(payload: { name: string }) {
  return request<{
    apiKey: ServiceApiKey;
  }>("/api-keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteApiKey(id: string) {
  return request<{ ok: true }>(`/api-keys/${id}`, {
    method: "DELETE",
  });
}

export async function listGatewayLogs(limit = 100) {
  return request<{
    logs: GatewayLog[];
  }>(`/logs?limit=${limit}`);
}
