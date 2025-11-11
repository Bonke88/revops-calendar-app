import { useState, useEffect } from 'preact/hooks';
import {
  fetchPendingApprovals,
  approveArticles,
  type CalendarEntry,
  getDifficultyColor,
} from '../../lib/calendarApi';

interface ApprovalFlowProps {
  onApprove: () => void;
}

export default function ApprovalFlow({ onApprove }: ApprovalFlowProps) {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [perDay, setPerDay] = useState(1);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  async function loadPendingApprovals() {
    try {
      setLoading(true);
      const data = await fetchPendingApprovals(50);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  }

  function selectAll() {
    setSelected(new Set(entries.map(e => e.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleApprove() {
    if (selected.size === 0) return;

    try {
      setApproving(true);
      await approveArticles({
        ids: Array.from(selected),
        auto_schedule: autoSchedule,
        schedule_start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        per_day: perDay,
      });

      // Reload data
      await loadPendingApprovals();
      setSelected(new Set());
      onApprove(); // Refresh parent dashboard
    } catch (error) {
      console.error('Failed to approve articles:', error);
      alert('Failed to approve articles. Check console for details.');
    } finally {
      setApproving(false);
    }
  }

  function handleDecline() {
    if (selected.size === 0) return;
    setShowDeclineModal(true);
  }

  async function handleGenerateNow() {
    if (selected.size === 0) return;

    // Only allow single selection for Generate Now
    if (selected.size > 1) {
      alert('Please select only one keyword to generate at a time.');
      return;
    }

    const confirmed = confirm(
      'This will immediately trigger the 10-step workflow for the selected keyword, bypassing the scheduled queue. Continue?'
    );

    if (!confirmed) return;

    try {
      setGenerating(true);
      const id = Array.from(selected)[0];

      const response = await fetch(`/api/calendar/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (!result.success) {
        alert(`Failed to start generation: ${result.error}`);
        return;
      }

      alert(`✓ Workflow started for "${result.data.keyword}"!\n\nEstimated time: ${result.data.estimatedTime}\n\nThe article will be automatically published when complete.`);

      // Reload data
      await loadPendingApprovals();
      setSelected(new Set());
      onApprove(); // Refresh parent dashboard
    } catch (error) {
      console.error('Failed to generate article:', error);
      alert('Failed to start generation. Check console for details.');
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDecline(skipReason = false) {
    if (selected.size === 0) return;

    const reason = skipReason ? '' : declineReason.trim();

    try {
      setApproving(true);

      // Decline each selected article with optional reason
      const promises = Array.from(selected).map(id =>
        fetch(`/api/calendar/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reject',
            decline_reason: reason || undefined
          })
        })
      );

      await Promise.all(promises);

      // Close modal and reset
      setShowDeclineModal(false);
      setDeclineReason('');

      // Reload data
      await loadPendingApprovals();
      setSelected(new Set());
      onApprove(); // Refresh parent dashboard
    } catch (error) {
      console.error('Failed to decline articles:', error);
      alert('Failed to decline articles. Check console for details.');
    } finally {
      setApproving(false);
    }
  }

  function cancelDecline() {
    setShowDeclineModal(false);
    setDeclineReason('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No pending approvals</h3>
        <p className="mt-1 text-sm text-gray-500">
          All AI-suggested keywords have been reviewed. Check back after the next weekly run.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Approval Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-600 hover:text-gray-700 font-medium"
            >
              Clear
            </button>
            <span className="text-sm text-gray-500">
              {selected.size} of {entries.length} selected
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDecline}
              disabled={selected.size === 0 || approving || generating}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {approving ? 'Processing...' : `Decline ${selected.size}`}
            </button>
            <button
              onClick={handleGenerateNow}
              disabled={selected.size === 0 || selected.size > 1 || approving || generating}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
              title={selected.size > 1 ? 'Select only one keyword to generate' : 'Immediately trigger workflow'}
            >
              {generating ? 'Generating...' : '⚡ Generate Now'}
            </button>
            <button
              onClick={handleApprove}
              disabled={selected.size === 0 || approving || generating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {approving ? 'Processing...' : `Approve ${selected.size}`}
            </button>
          </div>
        </div>

        {/* Scheduling Options */}
        <div className="flex items-center space-x-6 pt-4 border-t border-gray-200">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Auto-schedule articles</span>
          </label>

          {autoSchedule && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Articles per day:</label>
              <select
                value={perDay}
                onChange={(e) => setPerDay(parseInt(e.target.value))}
                className="rounded border-gray-300 text-sm"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {entries.map((entry) => (
          <ArticleCard
            key={entry.id}
            entry={entry}
            selected={selected.has(entry.id)}
            onToggle={() => toggleSelection(entry.id)}
          />
        ))}
      </div>

      {/* Decline Reason Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={cancelDecline}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Decline {selected.size} Keyword{selected.size > 1 ? 's' : ''}
            </h3>

            {/* Selected Keywords List */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 mb-2">Selected keywords:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {Array.from(selected).map(id => {
                  const entry = entries.find(e => e.id === id);
                  return entry ? <li key={id}>• {entry.keyword}</li> : null;
                })}
              </ul>
            </div>

            {/* Optional Reason */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Why are you declining? <span className="text-gray-500">(Optional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                This feedback helps the AI improve future keyword suggestions
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., Too competitive, not relevant to our niche, already covered..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={cancelDecline}
                disabled={approving}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDecline(true)}
                disabled={approving}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition font-medium"
              >
                {approving ? 'Processing...' : 'Skip & Decline'}
              </button>
              <button
                onClick={() => confirmDecline(false)}
                disabled={approving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium"
              >
                {approving ? 'Processing...' : 'Decline with Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ArticleCardProps {
  entry: CalendarEntry;
  selected: boolean;
  onToggle: () => void;
}

function ArticleCard({ entry, selected, onToggle }: ArticleCardProps) {
  const difficultyColor = getDifficultyColor(entry.difficulty);
  const opportunityScore = entry.opportunity_score || 0;

  return (
    <div
      onClick={onToggle}
      className={`border rounded-lg p-6 cursor-pointer transition ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <h3 className="text-lg font-semibold text-gray-900">{entry.keyword}</h3>
          </div>

          {/* Metrics */}
          <div className="flex items-center space-x-6 text-sm text-gray-600 ml-8">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>{entry.search_volume?.toLocaleString() || 'N/A'} searches/mo</span>
            </div>

            <div className="flex items-center">
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full bg-${difficultyColor}-100 text-${difficultyColor}-700`}>
                Difficulty: {entry.difficulty || 'N/A'}
              </span>
            </div>

            {entry.competitor_count !== null && (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{entry.competitor_count} competitors</span>
              </div>
            )}

            <div className="flex items-center text-green-600 font-medium">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Score: {opportunityScore}</span>
            </div>
          </div>

          {entry.notes && (
            <p className="mt-3 text-sm text-gray-600 ml-8">{entry.notes}</p>
          )}
        </div>

        {/* Type Badge */}
        <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
          {entry.article_type}
        </span>
      </div>
    </div>
  );
}