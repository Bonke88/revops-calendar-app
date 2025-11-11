/**
 * API: Generate Strategy Summary
 *
 * Analyzes recent keyword suggestions and generates a comprehensive
 * explanation of the SEO strategy and reasoning behind the selections.
 */

export const prerender = false;

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  import.meta.env.SUPABASE_URL || '',
  import.meta.env.SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_ANON_KEY || ''
);

const anthropic = new Anthropic({
  apiKey: import.meta.env.ANTHROPIC_API_KEY || '',
});

export async function POST({ request }) {
  try {
    const { days = 7 } = await request.json();

    // Fetch recent keyword suggestions
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: recentKeywords, error: keywordsError } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('status', 'suggested')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false});

    if (keywordsError) {
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    if (!recentKeywords || recentKeywords.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No recent keyword suggestions found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch declined keywords for context
    const { data: declinedKeywords } = await supabase
      .from('content_calendar')
      .select('keyword, decline_reason, search_volume, difficulty')
      .eq('status', 'rejected')
      .not('decline_reason', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch existing/approved keywords for context
    const { data: existingKeywords } = await supabase
      .from('content_calendar')
      .select('keyword, article_type')
      .in('status', ['approved', 'scheduled', 'generating', 'in_progress', 'published'])
      .limit(50);

    // Generate strategy summary with Claude
    const summary = await generateStrategySummary(
      recentKeywords,
      declinedKeywords || [],
      existingKeywords || []
    );

    return new Response(JSON.stringify({
      success: true,
      summary,
      keywordCount: recentKeywords.length,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to generate strategy summary:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function generateStrategySummary(recentKeywords, declinedKeywords, existingKeywords) {
  const prompt = `You are an SEO strategist analyzing keyword research decisions for a RevOps automation consulting agency.

**RECENT KEYWORD SUGGESTIONS (${recentKeywords.length} keywords):**
${recentKeywords.map(k => {
  const dataSource = k.data_sources?.search_volume === 'dataforseo' ? '📊 Real Data' : '🤖 AI Estimate';
  return `- "${k.keyword}" (${k.article_type})
  Volume: ${k.search_volume?.toLocaleString() || 'N/A'}/mo | Difficulty: ${k.difficulty || 'N/A'} | Opportunity: ${k.opportunity_score || 'N/A'}/100
  Competitors: ${k.competitor_count || 'N/A'} | Source: ${dataSource}
  Reasoning: ${k.notes || 'N/A'}`;
}).join('\n\n')}

**PREVIOUSLY DECLINED KEYWORDS (for context):**
${declinedKeywords.length > 0 ? declinedKeywords.slice(0, 10).map(k =>
  `- "${k.keyword}" - Declined because: ${k.decline_reason}`
).join('\n') : 'None'}

**EXISTING/APPROVED KEYWORDS (for context):**
${existingKeywords.length > 0 ? existingKeywords.slice(0, 20).map(k =>
  `- "${k.keyword}" (${k.article_type})`
).join('\n') : 'None'}

**YOUR TASK:**
Write a comprehensive 1-2 page strategic analysis document explaining:

1. **Overall Strategy** - What is the overarching content strategy behind these keyword selections?

2. **Selection Criteria** - What patterns and criteria led to these specific keywords being chosen?
   - Balance of search volume vs. difficulty
   - Mix of tool-specific vs. general topics
   - Commercial vs. informational intent
   - Gap analysis vs. existing content

3. **Learning from Declined Keywords** - How did previous feedback influence these selections?

4. **Data Quality Assessment** - Comment on the mix of real DataForSEO data vs. AI estimates and what that means

5. **Opportunity Analysis** - Which keywords have the highest potential and why?

6. **Risk Assessment** - Are there any concerns or challenges with these selections?

7. **Recommendations** - What should be prioritized? Any adjustments needed?

**FORMAT:**
- Use clear headings and subheadings
- Include specific examples with keyword names
- Use markdown formatting
- Be concise but thorough (aim for 500-800 words)
- Include actionable insights

Write the strategic analysis document now:`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return message.content[0].text;
}
