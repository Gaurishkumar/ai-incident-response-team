import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  OrganizationJoinRequestResponse,
  OrganizationRequestResponse,
  OrganizationResponse,
  UserResponse,
  IncidentCreateRequest,
  IncidentDetailResponse,
  IncidentStatusResponse,
  PagedIncidents,
  DashboardStats,
  ApiErrorResponse,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

class ApiClientError extends Error {
  status: number
  code: string
  fields?: { field: string; message: string }[]

  constructor(status: number, code: string, message: string, fields?: { field: string; message: string }[]) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export { ApiClientError }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: controller.signal,
      ...options,
    })

    clearTimeout(timeout)

    let body: { success: boolean; data?: T; error?: { code: string; message: string; fields?: { field: string; message: string }[] } }
    try {
      body = await res.json()
    } catch {
      throw new ApiClientError(res.status, 'PARSE_ERROR', 'Invalid response from server')
    }

    if (!res.ok) {
      const err = (body as ApiErrorResponse).error
      throw new ApiClientError(
        res.status,
        err?.code ?? 'UNKNOWN_ERROR',
        err?.message ?? 'An unexpected error occurred',
        err?.fields,
      )
    }

    return body.data as T
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof ApiClientError) throw err
    if ((err as Error).name === 'AbortError') {
      throw new ApiClientError(0, 'TIMEOUT', 'Connection lost — request timed out after 15 seconds')
    }
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network error — please check your connection')
  }
}

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      request<AuthResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    register: (body: RegisterRequest) =>
      request<UserResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    logout: () =>
      request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' }),
  },

  incidents: {
    create: (body: IncidentCreateRequest) =>
      request<{ id: string; title: string; status: string; createdAt: string }>('/api/v1/incidents', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    list: (params?: { page?: number; size?: number; status?: string; severity?: string }) => {
      const qs = new URLSearchParams()
      if (params?.page != null) qs.set('page', String(params.page))
      if (params?.size != null) qs.set('size', String(params.size))
      if (params?.status) qs.set('status', params.status)
      if (params?.severity) qs.set('severity', params.severity)
      const query = qs.toString()
      return request<PagedIncidents>(`/api/v1/incidents${query ? `?${query}` : ''}`)
    },

    get: (id: string) => request<IncidentDetailResponse>(`/api/v1/incidents/${id}`),

    getStatus: (id: string) => request<IncidentStatusResponse>(`/api/v1/incidents/${id}/status`),
  },

  dashboard: {
    stats: () => request<DashboardStats>('/api/v1/dashboard/stats'),
  },

  orgAdmin: {
    joinRequests: () =>
      request<OrganizationJoinRequestResponse[]>('/api/v1/org-admin/join-requests'),
    approveJoinRequest: (joinRequestId: string) =>
      request<OrganizationJoinRequestResponse>(`/api/v1/org-admin/join-requests/${joinRequestId}/approve`, {
        method: 'POST',
      }),
    rejectJoinRequest: (joinRequestId: string, reason: string) =>
      request<OrganizationJoinRequestResponse>(`/api/v1/org-admin/join-requests/${joinRequestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  admin: {
    organizationRequests: () =>
      request<OrganizationRequestResponse[]>('/api/v1/admin/organization-requests'),
    organizations: () =>
      request<OrganizationResponse[]>('/api/v1/admin/organizations'),
    approveOrganizationRequest: (requestId: string) =>
      request<OrganizationResponse>(`/api/v1/admin/organization-requests/${requestId}/approve`, {
        method: 'POST',
      }),
    rejectOrganizationRequest: (requestId: string, reason: string) =>
      request<OrganizationRequestResponse>(`/api/v1/admin/organization-requests/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },
}
