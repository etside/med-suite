/**
 * Medsuite-eT — REST API client (MySQL & PostgreSQL support)
 * Supports both MySQL and PostgreSQL backends
 */

/** Resolve API base: Electron injected URL, then explicit env, then dev PHP proxy, then Netlify functions. */
function resolveApiBase(): string {
  // Electron offline mode: main process injects this before page loads
  if (typeof window !== 'undefined' && (window as any).__MEDSUITE_API_BASE__) return (window as any).__MEDSUITE_API_BASE__;
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return "/api/index.php";
  return "/.netlify/functions/api";
}

// Resolved lazily per-request so the Electron main process can inject
// window.__MEDSUITE_API_BASE__ before the first API call is made.
function getApiBase(): string {
  return resolveApiBase();
}

/** Map PostgreSQL column names to frontend field names (quantity → stock). */
function normalizeProduct(row: Record<string, unknown>): Record<string, unknown> {
  const p = { ...row };
  if (p.quantity !== undefined && p.stock === undefined) {
    p.stock = p.quantity;
  }
  if (p.min_quantity !== undefined && p.min_stock === undefined) {
    p.min_stock = p.min_quantity;
  }
  if (p.stock !== undefined) p.stock = Number(p.stock) || 0;
  if (p.min_stock !== undefined) p.min_stock = Number(p.min_stock) || 0;
  if (p.price !== undefined) p.price = Number(p.price) || 0;
  return p;
}

function normalizeProducts(rows: Record<string, unknown>[]) {
  return rows.map(normalizeProduct);
}

// Alternative PostgreSQL endpoint (optional)
export const POSTGRES_API_URL = import.meta.env.VITE_POSTGRES_API || null;

const TOKEN_KEY = "medsuite_et_token";
const AUTH_METHOD_KEY = "medsuite_et_auth_method";

export type AppRole = "admin" | "staff" | "customer" | "super_admin";

export interface AppUser {
  id: string;
  email: string;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  action: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
    auth?: boolean;
    formData?: FormData;
  } = {}
): Promise<T> {
  const url = new URL(getApiBase(), window.location.origin);
  url.searchParams.set("action", action);
  if (options.query) {
    Object.entries(options.query).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), {
    method: options.method || "GET",
    headers,
    body,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new ApiError(json.error || res.statusText || "Request failed", res.status);
  }
  return json as T;
}

export const api = {
  health: async () => {
    const res = await request<{ status?: string; data?: { status?: string } }>("health");
    return { status: res.status ?? res.data?.status ?? "unknown" };
  },

  auth: {
    login: async (email: string, password: string) => {
      const res = await request<{
        data: {
          token: string;
          user: AppUser;
          roles: AppRole[];
          approval_status: string;
        };
      }>("auth_login", { method: "POST", body: { email, password } });
      setToken(res.data.token);
      localStorage.setItem(AUTH_METHOD_KEY, "password");
      return res.data;
    },
    
    loginWithPIN: async (email: string, pin: string) => {
      const res = await request<{
        data: {
          token: string;
          user: AppUser;
          roles: AppRole[];
        };
      }>("auth_pin", { method: "POST", body: { email, pin } });
      setToken(res.data.token);
      localStorage.setItem(AUTH_METHOD_KEY, "pin");
      return res.data;
    },
    
    loginWithBiometric: async (email: string, credential: unknown) => {
      const res = await request<{
        data: {
          token: string;
          user: AppUser;
          roles: AppRole[];
          approval_status?: string;
        };
      }>("auth_biometric", { method: "POST", body: { email, credential } });
      setToken(res.data.token);
      localStorage.setItem(AUTH_METHOD_KEY, "biometric");
      return res.data;
    },

    biometricStatus: (email: string) =>
      request<{ data: { enrolled: boolean; supported: boolean } }>("auth_biometric_status", {
        query: { email: email.trim().toLowerCase() },
      }).then((r) => r.data),

    webauthnRegisterOptions: () =>
      request<{ data: import("@/lib/webauthn").RegisterOptionsPayload }>(
        "auth_webauthn_register_options",
        { method: "POST", auth: true }
      ).then((r) => r.data),

    webauthnLoginOptions: (email: string) =>
      request<{ data: import("@/lib/webauthn").LoginOptionsPayload }>(
        "auth_webauthn_login_options",
        { method: "POST", body: { email: email.trim().toLowerCase() } }
      ).then((r) => r.data),

    enrollBiometric: (credential: unknown) =>
      request<{ data: { success: boolean; message: string } }>("auth_enroll_biometric", {
        method: "POST",
        body: { credential },
        auth: true,
      }),

    removeBiometric: () =>
      request<{ data: { success: boolean } }>("auth_biometric_remove", {
        method: "POST",
        auth: true,
      }),
    
    setPIN: (currentPassword: string, newPin: string) =>
      request("auth_set_pin", { 
        method: "POST", 
        body: { current_password: currentPassword, new_pin: newPin },
        auth: true 
      }),
    
    getAuthLogs: (limit: number = 50) =>
      request<{ data: any[] }>("auth_logs", { 
        query: { limit: limit.toString() },
        auth: true 
      }).then(r => r.data),
    
    signup: (full_name: string, email: string, password: string) =>
      request<{ data: { message: string } }>("auth_signup", {
        method: "POST",
        body: { full_name, email, password },
      }),
    me: () =>
      request<{
        data: {
          user: AppUser;
          roles: AppRole[];
          profile: Record<string, unknown>;
          approval_status: string;
        };
      }>("auth_me", { auth: true }),
    updatePassword: (password: string) =>
      request("auth_password", { method: "POST", body: { password } }),
    logout: () => {
      setToken(null);
      localStorage.removeItem(AUTH_METHOD_KEY);
      return Promise.resolve();
    },
  },

  products: {
    list: (query?: { category?: string; search?: string; limit?: number }) =>
      request<{ data: Record<string, unknown>[] }>("products", {
        query: {
          ...(query?.category ? { category: query.category } : {}),
          ...(query?.search ? { search: query.search } : {}),
          limit: String(query?.limit ?? 10000),
        },
      }).then((r) => normalizeProducts(r.data as Record<string, unknown>[])),
    get: (id: string) =>
      request<{ data: Record<string, unknown> }>("product", { query: { id } }).then((r) =>
        normalizeProduct(r.data)
      ),
    create: (payload: Record<string, unknown>) =>
      request("products", { method: "POST", body: payload }),
    update: (id: string, payload: Record<string, unknown>) =>
      request("product", { method: "PUT", query: { id }, body: payload }),
    delete: (id: string) => request("product", { method: "DELETE", query: { id } }),
  },

  orders: {
    list: (query?: { status?: string; user_id?: string }) =>
      request<{ data: Record<string, unknown>[] }>("orders", { query: query as Record<string, string> }).then(
        (r) => r.data
      ),
    create: (payload: Record<string, unknown>) =>
      request<{ data: Record<string, unknown> }>("orders", { method: "POST", body: payload }).then((r) => r.data),
    update: (payload: { id: string; status?: string; payment_status?: string }) =>
      request("orders", { method: "PUT", body: payload }),
    items: (orderId: string) =>
      request<{ data: Record<string, unknown>[] }>("order_items", { query: { order_id: orderId } }).then((r) => r.data),
    track: (orderNumber: string) =>
      request<{ data: Record<string, unknown> }>("track", { query: { order_number: orderNumber } }).then((r) => r.data),
  },

  sales: {
    list: (since?: string) =>
      request<{ data: { total: number; created_at: string }[] }>("sales", {
        query: since ? { since } : undefined,
      }).then((r) => r.data),
    create: (payload: Record<string, unknown>) => request("sales", { method: "POST", body: payload }),
  },

  settings: {
    get: () => request<{ data: Record<string, unknown> | null }>("settings").then((r) => r.data),
    update: (payload: Record<string, unknown>) => request("settings", { method: "PUT", body: payload }),
    create: (payload: Record<string, unknown>) =>
      request<{ data: { id: string } }>("settings", { method: "POST", body: payload }).then((r) => r.data),
  },

  profiles: {
    list: () => request<{ data: Record<string, unknown>[] }>("profiles").then((r) => r.data),
    self: () => request<{ data: Record<string, unknown> }>("profiles", { query: { self: "1" } }).then((r) => r.data),
    update: (payload: Record<string, unknown>) => request("profiles", { method: "PUT", body: payload }),
  },

  userRoles: {
    list: () => request<{ data: { user_id: string; role: string }[] }>("user_roles").then((r) => r.data),
    set: (user_id: string, role: string) => request("user_roles", { method: "PUT", body: { user_id, role } }),
    removeUser: (user_id: string) => request("user_roles", { method: "DELETE", query: { user_id } }),
  },

  suppliers: {
    list: () => request<{ data: Record<string, unknown>[] }>("suppliers").then((r) => r.data),
    create: (payload: Record<string, unknown>) => request("suppliers", { method: "POST", body: payload }),
  },

  purchaseOrders: {
    list: () => request<{ data: Record<string, unknown>[] }>("purchase_orders").then((r) => r.data),
    create: (payload: Record<string, unknown>) => request("purchase_orders", { method: "POST", body: payload }),
    updateStatus: (id: string, status: string) =>
      request("purchase_orders", { method: "PUT", body: { id, status } }),
  },

  notifications: {
    list: () =>
      request<{ data: Record<string, unknown>[] }>("notifications").then((r) => r.data as NotificationRow[]),
    markAllRead: () => request("notifications", { method: "PUT" }),
  },

  dashboard: () => request<{ data: DashboardStats }>("dashboard").then((r) => r.data),

  manufacturers: () =>
    request<{ data: ManufacturerRow[] }>("manufacturers").then((r) => r.data),

  cms: {
    list: (query?: { category?: string; status?: string; page?: string; limit?: string }) =>
      request<{ data: Record<string, unknown>[] }>("cms_content", { 
        query: query as Record<string, string> 
      }).then((r) => r.data),
    
    get: (id: string) =>
      request<{ data: Record<string, unknown> }>("cms_content", { 
        query: { id } 
      }).then((r) => r.data),
    
    create: (payload: Record<string, unknown>) =>
      request<{ data: { id: string } }>("cms_content", { 
        method: "POST", 
        body: payload,
        auth: true 
      }).then((r) => r.data),
    
    update: (id: string, payload: Record<string, unknown>) =>
      request("cms_content", { 
        method: "PUT", 
        query: { id }, 
        body: payload,
        auth: true 
      }),
    
    delete: (id: string) =>
      request("cms_content", { 
        method: "DELETE", 
        query: { id },
        auth: true 
      }),
  },

  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ data: { url: string } }>("upload", { method: "POST", formData: fd }).then((r) => r.data.url);
  },
};

export interface NotificationRow {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

export interface DashboardStats {
  product_count: number;
  low_stock: number;
  pending_orders: number;
  expiring_soon: number;
  user_count: number;
  supplier_count: number;
  pending_approvals: number;
  today_sales: number;
  monthly_revenue: number;
  top_stock: { name: string; stock: number }[];
  top_selling?: { name: string; qty: number }[];
  week_sales: { total: number; created_at: string }[];
}

export interface ManufacturerRow {
  name: string;
  medicines: number;
  prescriptions: number;
  divisions: number;
}

export { ApiError };
