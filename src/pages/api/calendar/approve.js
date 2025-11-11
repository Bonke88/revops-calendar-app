/**
 * Batch Approval API Endpoint
 *
 * POST /api/calendar/approve - Batch approve multiple calendar entries
 */

export const prerender = false;

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.SUPABASE_URL || '',
  import.meta.env.SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_ANON_KEY || ''
);

/**
 * POST /api/calendar/approve - Batch approve calendar entries
 * Body: {
 *   ids: string[] (required) - Array of calendar entry IDs
 *   approver: string (optional) - Name/ID of approver
 *   auto_schedule: boolean (optional) - Auto-schedule approved items
 *   schedule_start_date: string (optional) - Start date for auto-scheduling
 *   per_day: number (optional) - Articles per day for auto-scheduling
 * }
 */
export async function POST({ request }) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'IDs array is required and must not be empty'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const approver = body.approver || 'batch_api';
    const approvedAt = new Date().toISOString();

    // Batch approve entries
    const { data: approved, error: approveError } = await supabase
      .from('content_calendar')
      .update({
        status: 'approved',
        approved_at: approvedAt,
        approved_by: approver
      })
      .in('id', body.ids)
      .in('status', ['suggested', 'rejected'])
      .select();

    if (approveError) {
      throw approveError;
    }

    let scheduled = [];

    // Auto-schedule if requested
    if (body.auto_schedule && approved.length > 0) {
      const startDate = body.schedule_start_date
        ? new Date(body.schedule_start_date)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

      const perDay = body.per_day || 1;

      // Sort approved entries by priority score (highest first)
      const sortedApproved = [...approved].sort((a, b) =>
        (b.priority_score || 0) - (a.priority_score || 0)
      );

      // Assign dates
      const scheduledUpdates = [];
      let currentDate = new Date(startDate);
      let dailyCount = 0;

      for (const entry of sortedApproved) {
        scheduledUpdates.push({
          id: entry.id,
          planned_date: currentDate.toISOString().split('T')[0],
          status: 'scheduled'
        });

        dailyCount++;
        if (dailyCount >= perDay) {
          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
          dailyCount = 0;
        }
      }

      // Update scheduled dates
      for (const update of scheduledUpdates) {
        const { data, error } = await supabase
          .from('content_calendar')
          .update({
            planned_date: update.planned_date,
            status: update.status
          })
          .eq('id', update.id)
          .select()
          .single();

        if (!error && data) {
          scheduled.push(data);
        }
      }
    }

    // Get summary statistics
    const totalProcessed = approved.length;
    const totalScheduled = scheduled.length;
    const failedCount = body.ids.length - totalProcessed;

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully approved ${totalProcessed} entries`,
      summary: {
        requested: body.ids.length,
        approved: totalProcessed,
        scheduled: totalScheduled,
        failed: failedCount
      },
      data: {
        approved,
        scheduled
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to batch approve entries:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/calendar/approve - Get entries pending approval
 */
export async function GET({ url }) {
  try {
    const params = new URL(url).searchParams;
    const limit = parseInt(params.get('limit') || '50');

    // Get suggested entries sorted by opportunity score
    const { data, error} = await supabase
      .from('content_calendar')
      .select(`
        id,
        keyword,
        article_type,
        search_volume,
        difficulty,
        priority_score,
        competitor_count,
        opportunity_score,
        data_sources,
        created_at,
        notes
      `)
      .eq('status', 'suggested')
      .order('priority_score', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Calculate additional metrics
    const enrichedData = data.map(entry => ({
      ...entry,
      estimated_traffic: calculateEstimatedTraffic(
        entry.search_volume,
        entry.difficulty
      ),
      difficulty_label: getDifficultyLabel(entry.difficulty)
    }));

    return new Response(JSON.stringify({
      success: true,
      pendingCount: enrichedData.length,
      data: enrichedData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to fetch pending approvals:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Calculate estimated monthly traffic
 */
function calculateEstimatedTraffic(searchVolume, difficulty) {
  if (!searchVolume) return 0;

  // Estimate CTR based on difficulty (position estimate)
  let estimatedCTR;
  if (difficulty < 30) {
    estimatedCTR = 0.10; // Top 3 position likely
  } else if (difficulty < 50) {
    estimatedCTR = 0.05; // Top 5 position likely
  } else if (difficulty < 70) {
    estimatedCTR = 0.02; // Top 10 position likely
  } else {
    estimatedCTR = 0.005; // Page 2+
  }

  return Math.round(searchVolume * estimatedCTR);
}

/**
 * Get difficulty label
 */
function getDifficultyLabel(difficulty) {
  if (!difficulty) return 'Unknown';
  if (difficulty < 30) return 'Easy';
  if (difficulty < 50) return 'Medium';
  if (difficulty < 70) return 'Hard';
  return 'Very Hard';
}