/**
 * Generate Now API - Immediately trigger workflow for a specific keyword
 *
 * POST /api/calendar/[id]/generate - Trigger workflow immediately
 */

// Mark this route as server-rendered (not pre-rendered at build time)
export const prerender = false;

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.SUPABASE_URL || '',
  import.meta.env.SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_ANON_KEY || ''
);

/**
 * POST /api/calendar/[id]/generate - Immediately trigger workflow for keyword
 */
export async function POST({ params }) {
  try {
    const { id } = params;

    // Get the calendar entry
    const { data: entry, error: fetchError } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Calendar entry not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw fetchError;
    }

    // Validate entry can be generated (allow suggested, approved, or scheduled)
    if (!['suggested', 'approved', 'scheduled'].includes(entry.status)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot generate article with status "${entry.status}". Must be suggested, approved, or scheduled.`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if already generating
    if (entry.status === 'generating') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Article is already being generated'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update status to 'generating'
    const { error: updateError } = await supabase
      .from('content_calendar')
      .update({
        status: 'generating',
        generation_started_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Trigger GitHub Actions workflow via repository_dispatch
    const keyword = entry.keyword;
    const type = entry.article_type || 'guide';

    const githubToken = import.meta.env.GITHUB_TOKEN;
    const githubRepo = 'Bonke88/revops-partner-site';

    if (githubToken) {
      try {
        const dispatchResponse = await fetch(
          `https://api.github.com/repos/${githubRepo}/dispatches`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${githubToken}`,
              'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify({
              event_type: 'generate-article',
              client_payload: {
                keyword,
                article_type: type,
                calendar_id: id
              }
            })
          }
        );

        if (!dispatchResponse.ok) {
          console.error('Failed to trigger GitHub Actions:', await dispatchResponse.text());
          throw new Error('Failed to trigger GitHub Actions workflow');
        }

        console.log(`✓ GitHub Actions workflow triggered for keyword: "${keyword}" (ID: ${id})`);
      } catch (githubError) {
        console.error('GitHub Actions trigger error:', githubError);
        // Don't fail the request - the status is already set to generating
        // User can manually trigger from GitHub if needed
      }
    } else {
      console.warn('GITHUB_TOKEN not configured - workflow must be triggered manually');
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Workflow started for "${keyword}"`,
      data: {
        id: entry.id,
        keyword: entry.keyword,
        status: 'generating',
        estimatedTime: '15-20 minutes'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to trigger workflow:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
