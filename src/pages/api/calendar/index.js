/**
 * Calendar CRUD API - Main endpoint
 *
 * GET /api/calendar - List calendar entries
 * POST /api/calendar - Create new entry
 */

export const prerender = false;

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.SUPABASE_URL || '',
  import.meta.env.SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_ANON_KEY || ''
);

/**
 * GET /api/calendar - List calendar entries with filtering
 * Query params:
 * - status: Filter by status (suggested, approved, scheduled, published, etc.)
 * - start_date: Start of date range (YYYY-MM-DD)
 * - end_date: End of date range (YYYY-MM-DD)
 * - limit: Number of results (default 50)
 * - offset: Pagination offset (default 0)
 * - sort: Sort field (default: planned_date)
 * - order: Sort order (asc/desc, default: asc)
 */
export async function GET({ url }) {
  try {
    const params = new URL(url).searchParams;
    const status = params.get('status');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const limit = parseInt(params.get('limit') || '50');
    const offset = parseInt(params.get('offset') || '0');
    const sort = params.get('sort') || 'planned_date';
    const order = params.get('order') || 'asc';

    // Build query
    let query = supabase
      .from('content_calendar')
      .select(`
        id,
        planned_date,
        keyword,
        article_type,
        search_volume,
        difficulty,
        status,
        priority_score,
        quality_score,
        competitor_count,
        created_at,
        updated_at,
        approved_at,
        approved_by,
        published_at,
        article_id,
        notes
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('planned_date', startDate);
    }
    if (endDate) {
      query = query.lte('planned_date', endDate);
    }

    // Apply sorting and pagination
    query = query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate opportunity score for each entry
    const enrichedData = data.map(entry => ({
      ...entry,
      opportunity_score: calculateOpportunityScore(
        entry.search_volume,
        entry.difficulty,
        entry.competitor_count
      )
    }));

    return new Response(JSON.stringify({
      success: true,
      data: enrichedData,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to fetch calendar entries:', error);
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
 * POST /api/calendar - Create new calendar entry
 * Body: {
 *   keyword: string (required)
 *   article_type: string (default: 'guide')
 *   planned_date: string (YYYY-MM-DD)
 *   search_volume: number
 *   difficulty: number
 *   notes: string
 * }
 */
export async function POST({ request }) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.keyword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Keyword is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for duplicate keyword
    const { data: existing } = await supabase
      .from('content_calendar')
      .select('id')
      .eq('keyword', body.keyword)
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        success: false,
        error: `Keyword "${body.keyword}" already exists in calendar`
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate priority score
    const priorityScore = calculateOpportunityScore(
      body.search_volume || 0,
      body.difficulty || 50,
      0
    );

    // Create new entry
    const { data, error } = await supabase
      .from('content_calendar')
      .insert({
        keyword: body.keyword,
        article_type: body.article_type || 'guide',
        planned_date: body.planned_date || null,
        search_volume: body.search_volume || null,
        difficulty: body.difficulty || null,
        status: body.status || 'suggested',
        priority_score: priorityScore,
        notes: body.notes || null,
        brief_content: body.brief_content || null,
        seo_insights: body.seo_insights || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Calendar entry created successfully',
      data
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to create calendar entry:', error);
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
 * Calculate opportunity score based on volume and difficulty
 */
function calculateOpportunityScore(volume, difficulty, competitorCount) {
  if (!volume || !difficulty) return 0;

  // Base score from volume/difficulty ratio
  let score = (volume / Math.max(difficulty, 1)) * 10;

  // Boost for low competition
  if (competitorCount <= 3) {
    score *= 1.5;
  } else if (competitorCount <= 5) {
    score *= 1.2;
  }

  // Boost for sweet spot difficulty (30-50)
  if (difficulty >= 30 && difficulty <= 50) {
    score *= 1.3;
  }

  // Penalty for very high difficulty
  if (difficulty > 70) {
    score *= 0.5;
  }

  return Math.round(Math.min(score, 100));
}