/**
 * Generate Now API - Immediately trigger workflow for a specific keyword
 *
 * POST /api/calendar/[id]/generate - Trigger workflow immediately
 */

// Mark this route as server-rendered (not pre-rendered at build time)
export const prerender = false;

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Trigger the workflow in background
    const workflowPath = path.resolve(__dirname, '../../../../../content-workflow/orchestrator-full.js');
    const keyword = entry.keyword;
    const type = entry.article_type || 'guide';

    // Spawn the workflow process in detached mode
    const child = spawn('node', [workflowPath, '--keyword', keyword, '--type', type], {
      detached: true,
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '../../../../../content-workflow')
    });

    // Detach the child process so it runs independently
    child.unref();

    console.log(`✓ Workflow triggered for keyword: "${keyword}" (ID: ${id})`);

    return new Response(JSON.stringify({
      success: true,
      message: `Workflow started for "${keyword}"`,
      data: {
        id: entry.id,
        keyword: entry.keyword,
        status: 'generating',
        estimatedTime: '10-15 minutes'
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
