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

type SortField = 'keyword' | 'search_volume' | 'difficulty' | 'opportunity_score' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function ApprovalFlowTable({ onApprove }: ApprovalFlowProps) {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<CalendarEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [perDay, setPerDay] = useState(1);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [dataSourceFilter, setDataSourceFilter] = useState<string>('all');
  const [minVolume, setMinVolume] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('opportunity_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [entries, difficultyFilter, dataSourceFilter, minVolume, sortField, sortDirection]);

  async function loadPendingApprovals() {
    try {
      setLoading(true);
      const data = await fetchPendingApprovals(100);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFiltersAndSort() {
    let filtered = [...entries];

    // Difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(entry => {
        const diff = entry.difficulty || 0;
        if (difficultyFilter === 'easy') return diff < 30;
        if (difficultyFilter === 'medium') return diff >= 30 && diff < 50;
        if (difficultyFilter === 'hard') return diff >= 50 && diff < 70;
        if (difficultyFilter === 'very-hard') return diff >= 70;
        return true;
      });
    }

    // Data source filter
    if (dataSourceFilter !== 'all') {
      filtered = filtered.filter(entry => {
        const sources = entry.data_sources;
        if (!sources) return dataSourceFilter === 'claude-ai';

        // Check if any metric is from the selected source
        return Object.values(sources).some(source => source === dataSourceFilter);
      });
    }

    // Min volume filter
    if (minVolume && !isNaN(parseInt(minVolume))) {
      const min = parseInt(minVolume);
      filtered = filtered.filter(entry => (entry.search_volume || 0) >= min);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'keyword':
          aVal = a.keyword.toLowerCase();
          bVal = b.keyword.toLowerCase();
          break;
        case 'search_volume':
          aVal = a.search_volume || 0;
          bVal = b.search_volume || 0;
          break;
        case 'difficulty':
          aVal = a.difficulty || 0;
          bVal = b.difficulty || 0;
          break;
        case 'opportunity_score':
          aVal = a.opportunity_score || 0;
          bVal = b.opportunity_score || 0;
          break;
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    setFilteredEntries(filtered);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
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
    setSelected(new Set(filteredEntries.map(e => e.id)));
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

      await loadPendingApprovals();
      setSelected(new Set());
      onApprove();
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

      await loadPendingApprovals();
      setSelected(new Set());
      onApprove();
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

      setShowDeclineModal(false);
      setDeclineReason('');

      await loadPendingApprovals();
      setSelected(new Set());
      onApprove();
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

  function getDataSourceIcon(source?: 'dataforseo' | 'claude-ai') {
    if (source === 'dataforseo') return '📊';
    if (source === 'claude-ai') return '🤖';
    return '❓';
  }

  function getDataSourceLabel(source?: 'dataforseo' | 'claude-ai') {
    if (source === 'dataforseo') return 'DataForSEO';
    if (source === 'claude-ai') return 'Claude AI';
    return 'Unknown';
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Difficulty</label>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.currentTarget.value)}
              className="w-full text-sm rounded border-gray-300"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy (&lt;30)</option>
              <option value="medium">Medium (30-50)</option>
              <option value="hard">Hard (50-70)</option>
              <option value="very-hard">Very Hard (70+)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Data Source</label>
            <select
              value={dataSourceFilter}
              onChange={(e) => setDataSourceFilter(e.currentTarget.value)}
              className="w-full text-sm rounded border-gray-300"
            >
              <option value="all">All Sources</option>
              <option value="dataforseo">📊 DataForSEO Only</option>
              <option value="claude-ai">🤖 Claude AI Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Min Search Volume</label>
            <input
              type="number"
              value={minVolume}
              onChange={(e) => setMinVolume(e.currentTarget.value)}
              placeholder="e.g., 100"
              className="w-full text-sm rounded border-gray-300"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setDifficultyFilter('all');
                setDataSourceFilter('all');
                setMinVolume('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Approval Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All ({filteredEntries.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-600 hover:text-gray-700 font-medium"
            >
              Clear
            </button>
            <span className="text-sm text-gray-500">
              {selected.size} selected
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDecline}
              disabled={selected.size === 0 || approving || generating}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
            >
              {approving ? 'Processing...' : `Decline ${selected.size || ''}`}
            </button>
            <button
              onClick={handleGenerateNow}
              disabled={selected.size === 0 || selected.size > 1 || approving || generating}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
              title={selected.size > 1 ? 'Select only one keyword to generate' : 'Immediately trigger workflow'}
            >
              {generating ? 'Generating...' : '⚡ Generate Now'}
            </button>
            <button
              onClick={handleApprove}
              disabled={selected.size === 0 || approving || generating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
            >
              {approving ? 'Processing...' : `Approve ${selected.size || ''}`}
            </button>
          </div>
        </div>

        {/* Scheduling Options */}
        <div className="flex items-center space-x-6 pt-4 border-t border-gray-200">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.currentTarget.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Auto-schedule articles</span>
          </label>

          {autoSchedule && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Articles per day:</label>
              <select
                value={perDay}
                onChange={(e) => setPerDay(parseInt(e.currentTarget.value))}
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

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={filteredEntries.length > 0 && selected.size === filteredEntries.length}
                    onChange={(e) => e.currentTarget.checked ? selectAll() : clearSelection()}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('keyword')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Keyword</span>
                    <SortIcon field="keyword" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('search_volume')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Volume</span>
                    <SortIcon field="search_volume" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('difficulty')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Difficulty</span>
                    <SortIcon field="difficulty" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('opportunity_score')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Opportunity</span>
                    <SortIcon field="opportunity_score" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`hover:bg-gray-50 ${selected.has(entry.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleSelection(entry.id)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleSelection(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {entry.keyword}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <span>{entry.search_volume?.toLocaleString() || 'N/A'}</span>
                      <span
                        title={getDataSourceLabel(entry.data_sources?.search_volume)}
                        className="text-lg cursor-help"
                      >
                        {getDataSourceIcon(entry.data_sources?.search_volume)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center space-x-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full bg-${getDifficultyColor(entry.difficulty)}-100 text-${getDifficultyColor(entry.difficulty)}-700`}>
                        {entry.difficulty || 'N/A'}
                      </span>
                      <span
                        title={getDataSourceLabel(entry.data_sources?.difficulty)}
                        className="text-lg cursor-help"
                      >
                        {getDataSourceIcon(entry.data_sources?.difficulty)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center space-x-1">
                      <span className="font-medium text-green-600">{entry.opportunity_score || 'N/A'}</span>
                      <span
                        title={getDataSourceLabel(entry.data_sources?.opportunity_score)}
                        className="text-lg cursor-help"
                      >
                        {getDataSourceIcon(entry.data_sources?.opportunity_score)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {entry.article_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {entry.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEntries.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No keywords match your filters. Try adjusting the filter criteria.
          </div>
        )}
      </div>

      {/* Decline Reason Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={cancelDecline}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Decline {selected.size} Keyword{selected.size > 1 ? 's' : ''}
            </h3>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 mb-2">Selected keywords:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {Array.from(selected).map(id => {
                  const entry = entries.find(e => e.id === id);
                  return entry ? <li key={id}>• {entry.keyword}</li> : null;
                })}
              </ul>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Why are you declining? <span className="text-gray-500">(Optional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                This feedback helps the AI improve future keyword suggestions
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.currentTarget.value)}
                placeholder="e.g., Too competitive, not relevant to our niche, already covered..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
            </div>

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
