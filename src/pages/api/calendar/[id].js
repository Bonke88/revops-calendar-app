/**
 * Calendar CRUD API - Individual entry operations
 *
 * GET /api/calendar/[id] - Get single entry
 * PATCH /api/calendar/[id] - Update entry
 * DELETE /api/calendar/[id] - Delete entry
 */

export const prerender = false;

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.SUPABASE_URL || '',
  import.meta.env.SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_ANON_KEY || ''
);

/**
 * GET /api/calendar/[id] - Get single calendar entry with full details
 */
export async function GET({ params }) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('content_calendar')
      .select(`
        *,
        articles (
          id,
          slug,
          title,
          published_at,
          quality_score,
          actual_word_count,
          generation_cost
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Calendar entry not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to fetch calendar entry:', error);
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
 * PATCH /api/calendar/[id] - Update calendar entry
 * Body: Any fields to update (status, planned_date, notes, etc.)
 * Special actions:
 * - { action: 'approve' } - Approve the entry
 * - { action: 'reject' } - Reject the entry
 * - { action: 'reschedule', planned_date: 'YYYY-MM-DD' } - Reschedule
 */
export async function PATCH({ params, request }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Handle special actions
    if (body.action) {
      switch (body.action) {
        case 'approve':
          return await approveEntry(id, body.approver);
        case 'reject':
          return await rejectEntry(id, body.decline_reason);
        case 'reschedule':
          return await rescheduleEntry(id, body.planned_date);
        default:
          return new Response(JSON.stringify({
            success: false,
            error: `Unknown action: ${body.action}`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }
    }

    // Regular update
    const updateData = { ...body };
    delete updateData.id; // Remove ID if present
    delete updateData.created_at; // Remove readonly fields
    delete updateData.updated_at;

    const { data, error } = await supabase
      .from('content_calendar')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Calendar entry not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Calendar entry updated successfully',
      data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to update calendar entry:', error);
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
 * DELETE /api/calendar/[id] - Delete calendar entry
 */
export async function DELETE({ params }) {
  try {
    const { id } = params;

    // Check if entry has published article
    const { data: entry } = await supabase
      .from('content_calendar')
      .select('status, article_id')
      .eq('id', id)
      .single();

    if (entry?.status === 'published') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot delete published articles. Archive instead.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabase
      .from('content_calendar')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Calendar entry not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Calendar entry deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to delete calendar entry:', error);
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
 * Approve a calendar entry
 */
async function approveEntry(id, approver = 'api') {
  const { data, error } = await supabase
    .from('content_calendar')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approver
    })
    .eq('id', id)
    .in('status', ['suggested', 'rejected'])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Entry not found or not in approvable state'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Entry approved successfully',
    data
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Reject a calendar entry with optional decline reason
 */
async function rejectEntry(id, declineReason = null) {
  const updateData = {
    status: 'rejected',
    approved_at: null,
    approved_by: null
  };

  // Store decline reason for AI learning
  if (declineReason) {
    updateData.decline_reason = declineReason;
  }

  const { data, error } = await supabase
    .from('content_calendar')
    .update(updateData)
    .eq('id', id)
    .in('status', ['suggested', 'approved'])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Entry not found or not in rejectable state'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: declineReason ? 'Entry rejected with feedback' : 'Entry rejected',
    data
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Reschedule a calendar entry
 */
async function rescheduleEntry(id, plannedDate) {
  if (!plannedDate) {
    return new Response(JSON.stringify({
      success: false,
      error: 'planned_date is required for rescheduling'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { data, error } = await supabase
    .from('content_calendar')
    .update({
      planned_date: plannedDate,
      status: 'scheduled'
    })
    .eq('id', id)
    .in('status', ['approved', 'scheduled'])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Entry not found or not in schedulable state'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: `Entry rescheduled to ${plannedDate}`,
    data
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}