// Calendar API client utilities
const API_BASE = import.meta.env.DEV ? 'http://localhost:4321' : '';

export interface CalendarEntry {
  id: string;
  keyword: string;
  article_type: string;
  search_volume: number | null;
  difficulty: number | null;
  status: 'suggested' | 'approved' | 'scheduled' | 'in_progress' | 'published' | 'failed' | 'rejected';
  planned_date: string | null;
  priority_score: number | null;
  quality_score: number | null;
  competitor_count: number | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  notes: string | null;
  opportunity_score?: number;
  estimated_traffic?: number;
  difficulty_label?: string;
  data_sources?: {
    search_volume?: 'dataforseo' | 'claude-ai';
    difficulty?: 'dataforseo' | 'claude-ai';
    opportunity_score?: 'dataforseo' | 'claude-ai';
    competitor_count?: 'dataforseo' | 'claude-ai';
  };
  seo_insights?: {
    priority_score?: number;
    data_source?: 'dataforseo' | 'estimated';
    icon_type?: 'metrics' | 'robot';
    geo_optimized?: boolean;
    strategic_reasoning?: string;
    cpc?: number;
    real_data?: boolean;
    [key: string]: any;
  };
}

export interface PaginatedResponse {
  success: boolean;
  data: CalendarEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ApprovalResponse {
  success: boolean;
  message: string;
  summary: {
    requested: number;
    approved: number;
    scheduled: number;
    failed: number;
  };
  data: {
    approved: CalendarEntry[];
    scheduled: CalendarEntry[];
  };
}

/**
 * Fetch calendar entries with filtering
 */
export async function fetchCalendarEntries(params: {
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PaginatedResponse> {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.set('status', params.status);
  if (params.start_date) queryParams.set('start_date', params.start_date);
  if (params.end_date) queryParams.set('end_date', params.end_date);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());

  const response = await fetch(`${API_BASE}/api/calendar?${queryParams}`);
  if (!response.ok) {
    throw new Error('Failed to fetch calendar entries');
  }
  return response.json();
}

/**
 * Fetch pending approvals
 */
export async function fetchPendingApprovals(limit = 50): Promise<CalendarEntry[]> {
  const response = await fetch(`${API_BASE}/api/calendar/approve?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch pending approvals');
  }
  const data = await response.json();
  return data.data || [];
}

/**
 * Approve multiple articles
 */
export async function approveArticles(params: {
  ids: string[];
  auto_schedule?: boolean;
  schedule_start_date?: string;
  per_day?: number;
}): Promise<ApprovalResponse> {
  const response = await fetch(`${API_BASE}/api/calendar/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Failed to approve articles');
  }
  return response.json();
}

/**
 * Update a calendar entry
 */
export async function updateCalendarEntry(
  id: string,
  updates: Partial<CalendarEntry> | { action: string; [key: string]: any }
): Promise<CalendarEntry> {
  const response = await fetch(`${API_BASE}/api/calendar/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update calendar entry');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Delete a calendar entry
 */
export async function deleteCalendarEntry(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/calendar/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete calendar entry');
  }
}

/**
 * Get a single calendar entry with full details
 */
export async function getCalendarEntry(id: string): Promise<CalendarEntry> {
  const response = await fetch(`${API_BASE}/api/calendar/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch calendar entry');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Fetch calendar stats (all counts in single call)
 */
export interface CalendarStats {
  suggested: number;
  approved: number;
  scheduled: number;
  published: number;
  todayScheduled: CalendarEntry | null;
}

export async function fetchCalendarStats(): Promise<CalendarStats> {
  const response = await fetch(`${API_BASE}/api/calendar/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch calendar stats');
  }
  const data = await response.json();
  return data.stats;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not scheduled';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get difficulty badge color
 */
export function getDifficultyColor(difficulty: number | null): string {
  if (!difficulty) return 'gray';
  if (difficulty < 30) return 'green';
  if (difficulty < 50) return 'yellow';
  if (difficulty < 70) return 'orange';
  return 'red';
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    suggested: 'blue',
    approved: 'green',
    scheduled: 'purple',
    in_progress: 'yellow',
    published: 'gray',
    failed: 'red',
    rejected: 'gray',
  };
  return colors[status] || 'gray';
}