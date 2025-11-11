import { useState, useEffect } from 'preact/hooks';
import { fetchCalendarStats, type CalendarEntry } from '../../lib/calendarApi';
import ApprovalFlowTable from './ApprovalFlowTable';
import CalendarStats from './CalendarStats';

export default function CalendarDashboard() {
  const [stats, setStats] = useState({
    suggested: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
    todayScheduled: null as CalendarEntry | null,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals'>('overview');

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);

      // Fetch all stats in a single optimized call
      const statsData = await fetchCalendarStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`${
              activeTab === 'approvals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
          >
            Pending Approvals
            {stats.suggested > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs font-medium">
                {stats.suggested}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' ? (
        <CalendarStats stats={stats} onRefresh={loadStats} />
      ) : (
        <ApprovalFlowTable onApprove={loadStats} />
      )}
    </div>
  );
}