import { useState, useEffect } from 'preact/hooks';
import { type CalendarEntry } from '../../lib/calendarApi';
import StrategySummarizer from './StrategySummarizer';

interface StatsProps {
  stats: {
    suggested: number;
    approved: number;
    scheduled: number;
    published: number;
    todayScheduled: CalendarEntry | null;
  };
  onRefresh: () => void;
}

export default function CalendarStats({ stats, onRefresh }: StatsProps) {
  const [scheduledArticles, setScheduledArticles] = useState<CalendarEntry[]>([]);
  const [runningJobs, setRunningJobs] = useState<CalendarEntry[]>([]);

  useEffect(() => {
    loadScheduledArticles();
    loadRunningJobs();

    // Poll for running jobs every 10 seconds
    const interval = setInterval(loadRunningJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadScheduledArticles() {
    try {
      const response = await fetch('/api/calendar?status=scheduled&limit=5');
      const result = await response.json();

      if (result.success) {
        setScheduledArticles(result.entries);
      }
    } catch (error) {
      console.error('Failed to load scheduled articles:', error);
    }
  }

  async function loadRunningJobs() {
    try {
      const response = await fetch('/api/calendar?status=in_progress');
      const result = await response.json();

      if (result.success) {
        setRunningJobs(result.entries || []);
      }
    } catch (error) {
      console.error('Failed to load running jobs:', error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Today's Article */}
      {stats.todayScheduled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Today's Scheduled Article
              </h3>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {stats.todayScheduled.keyword}
              </p>
              <p className="mt-2 text-sm text-blue-700">
                Type: {stats.todayScheduled.article_type} •
                Volume: {stats.todayScheduled.search_volume?.toLocaleString() || 'N/A'} •
                Difficulty: {stats.todayScheduled.difficulty || 'N/A'}
              </p>
            </div>
            <div className="text-blue-600">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Running Jobs Activity Log */}
      {runningJobs.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Active Workflows ({runningJobs.length})
          </h3>
          <div className="space-y-3">
            {runningJobs.map(job => (
              <div key={job.id} className="bg-white border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{job.keyword}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Status: ⚡ Generating Article
                    </p>
                  </div>
                  <div className="text-purple-600">
                    <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending Approval"
          value={stats.suggested}
          color="blue"
          icon="✋"
          description="AI-suggested keywords"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          color="green"
          icon="✓"
          description="Ready to schedule"
        />
        <StatCard
          title="Scheduled"
          value={stats.scheduled}
          color="purple"
          icon="📅"
          description="Articles queued"
        />
        <StatCard
          title="Published"
          value={stats.published}
          color="gray"
          icon="🚀"
          description="Live articles"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={onRefresh}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Refresh Data</span>
          </button>

          <a
            href="/calendar/scheduled"
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">View Schedule</span>
          </a>

          <a
            href="/calendar/analytics"
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">View Analytics</span>
          </a>
        </div>
      </div>

      {/* Strategy Summarizer */}
      <StrategySummarizer />

      {/* Scheduled Articles */}
      {scheduledArticles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Scheduled Articles ({scheduledArticles.length})
          </h3>
          <div className="space-y-3">
            {scheduledArticles.map(article => (
              <div key={article.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{article.keyword}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {article.article_type} • {article.search_volume?.toLocaleString() || 'N/A'} searches/mo •
                      Difficulty: {article.difficulty || 'N/A'}
                    </p>
                    {article.planned_date && (
                      <p className="text-xs text-gray-500 mt-2">
                        📅 Scheduled for: {new Date(article.planned_date).toLocaleDateString()}
                      </p>
                    )}
                    {article.created_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Added: {new Date(article.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automation Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Automation Schedule</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-700">SEO Keyword Research</span>
            </div>
            <span className="text-sm text-gray-500">Every Monday 1:00 AM UTC</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-700">Daily Article Publishing</span>
            </div>
            <span className="text-sm text-gray-500">Every day 3:00 AM UTC</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'gray';
  icon: string;
  description: string;
}

function StatCard({ title, value, color, icon, description }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
  };

  return (
    <div className={`border rounded-lg p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-75">{description}</p>
    </div>
  );
}