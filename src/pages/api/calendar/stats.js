/**
 * Calendar Stats API Endpoint
 *
 * GET /api/calendar/stats - Get all calendar statistics in a single call
 */

export const prerender = false;

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.SUPABASE_URL || '',
  import.meta.env.SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_ANON_KEY || ''
);

/**
 * GET /api/calendar/stats - Get calendar statistics
 * Returns counts for all statuses in a single optimized query
 */
export async function GET() {
  try {
    // Get all counts in parallel using aggregation
    const [suggestedResult, approvedResult, scheduledResult, publishedResult, todayResult] = await Promise.all([
      supabase
        .from('content_calendar')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'suggested'),
      supabase
        .from('content_calendar')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      supabase
        .from('content_calendar')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled'),
      supabase
        .from('content_calendar')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('content_calendar')
        .select('*')
        .eq('status', 'scheduled')
        .gte('planned_date', new Date().toISOString().split('T')[0])
        .lte('planned_date', new Date().toISOString().split('T')[0])
        .limit(1)
    ]);

    // Check for errors
    if (suggestedResult.error) throw suggestedResult.error;
    if (approvedResult.error) throw approvedResult.error;
    if (scheduledResult.error) throw scheduledResult.error;
    if (publishedResult.error) throw publishedResult.error;
    if (todayResult.error) throw todayResult.error;

    return new Response(JSON.stringify({
      success: true,
      stats: {
        suggested: suggestedResult.count || 0,
        approved: approvedResult.count || 0,
        scheduled: scheduledResult.count || 0,
        published: publishedResult.count || 0,
        todayScheduled: todayResult.data?.[0] || null
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to fetch calendar stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
