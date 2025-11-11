import { useState } from 'preact/hooks';

interface StrategySummarizerProps {
  days?: number;
}

export default function StrategySummarizer({ days = 7 }: StrategySummarizerProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keywordCount, setKeywordCount] = useState<number>(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function generateSummary() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/calendar/strategy-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSummary(result.summary);
      setKeywordCount(result.keywordCount);
      setGeneratedAt(result.generatedAt);

    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError('Failed to generate summary. Check console for details.');
    } finally {
      setLoading(false);
    }
  }

  function closeSummary() {
    setSummary(null);
    setError(null);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">SEO Strategy Summarizer</h3>
          <p className="text-sm text-gray-600 mt-1">
            Generate a comprehensive analysis of keyword selection strategy
          </p>
        </div>

        <button
          onClick={generateSummary}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          {loading ? 'Generating...' : '📊 Generate Strategy Report'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {summary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeSummary}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">SEO Strategy Analysis</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Analysis of {keywordCount} keywords suggested in the last {days} days
                </p>
              </div>
              <button
                onClick={closeSummary}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Generated {generatedAt ? new Date(generatedAt).toLocaleString() : 'just now'}
              </div>
              <button
                onClick={closeSummary}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple markdown to HTML converter
 * Handles headings, bold, lists, and paragraphs
 */
function renderMarkdown(markdown: string): string {
  let html = markdown
    // Headings
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-10 mb-5">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Lists
    .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
    // Wrap lists
    .replace(/(<li class="ml-4">.*<\/li>\n)+/g, '<ul class="list-disc pl-5 mb-4">$&</ul>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4">')
    // Code blocks (inline)
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm">$1</code>');

  return `<div class="text-gray-700 leading-relaxed"><p class="mb-4">${html}</p></div>`;
}
