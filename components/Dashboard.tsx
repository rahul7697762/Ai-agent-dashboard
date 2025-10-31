import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';
import RecentCallItem from './RecentCallItem';
import { CalendarIcon, ChartBarIcon, ClockIcon, CheckCircleIcon } from '../constants';
import { supabase } from '../lib/supabase';
import { RecentCall, CallStatus } from '../types';
import StartCallModal from './StartCallModal';

// Helper functions
const formatDuration = (seconds: number | null): string => {
  if (seconds === null || typeof seconds === 'undefined') return '0m 0s';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const timeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
};

const getCallStatus = (reason: string | null): CallStatus => {
  if (!reason) return CallStatus.Completed;
  const lowerReason = reason.toLowerCase();
  if (lowerReason.includes('missed') || lowerReason.includes('no-answer') || lowerReason.includes('failed')) {
    return CallStatus.Missed;
  }
  return CallStatus.Completed;
};

const RecentCallsSkeleton = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center justify-between p-4 rounded-lg animate-pulse">
        <div className="flex items-center flex-1">
          <div className="w-10 h-10 rounded-full bg-slate-700 mr-4"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-700 rounded w-24"></div>
            <div className="h-3 bg-slate-700 rounded w-48"></div>
          </div>
        </div>
        <div className="flex items-center text-right flex-col sm:flex-row sm:gap-4">
          <div className="h-6 w-20 bg-slate-700 rounded-full mb-1 sm:mb-0"></div>
          <div className="h-3 w-28 bg-slate-700 rounded"></div>
        </div>
      </div>
    ))}
  </div>
);

type DateRange = 'today' | '7d' | '30d';

const DateRangeButton: React.FC<{ range: DateRange; current: DateRange; setRange: (range: DateRange) => void; children: React.ReactNode; }> = ({ range, current, setRange, children }) => (
    <button
        onClick={() => setRange(range)}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            current === range
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
        }`}
    >
        {children}
    </button>
);

const Dashboard: React.FC = () => {
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingsInPeriod, setMeetingsInPeriod] = useState<number | null>(null);
  const [stats, setStats] = useState({ totalCalls: null, avgDuration: null, successRate: null });
  const [statsLoading, setStatsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  
  useEffect(() => {
    const getDatesFromRange = (range: DateRange) => {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        switch (range) {
            case 'today':
                end.setHours(23, 59, 59, 999);
                break;
            case '7d':
                start.setDate(start.getDate() - 6);
                break;
            case '30d':
                start.setDate(start.getDate() - 29);
                break;
        }
        return { startDate: start, endDate: end };
    };
    
    const { startDate, endDate } = getDatesFromRange(dateRange);

    const fetchDashboardData = async () => {
      setLoading(true);
      setStatsLoading(true);
      setError(null);

      // Fetch calls with related analysis for stats calculation
      const { data: calls, error: callsError } = await supabase
        .from('call_history')
        .select(`
          id, created_at, recipient_number, call_duration, disconnection_reason, name,
          semantic_analysis ( alert_status, sentiment )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (callsError) {
        console.error('Error fetching dashboard data:', callsError);
        setError('Failed to load dashboard data. Please try again later.');
        setLoading(false);
        setStatsLoading(false);
        return;
      }

      // --- Calculate Stats ---
      const totalCalls = calls.length;
      const totalDuration = calls.reduce((sum, call) => sum + (call.call_duration || 0), 0);
      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
      
      const successfulCallsCount = calls.filter(call => {
        const analysis = Array.isArray(call.semantic_analysis) ? call.semantic_analysis[0] : call.semantic_analysis;
        return analysis && analysis.alert_status !== 'error' && analysis.alert_status !== 'warning';
      }).length;
      
      const successRate = totalCalls > 0 ? (successfulCallsCount / totalCalls) * 100 : 0;
      
      setStats({
          totalCalls: totalCalls,
          avgDuration: avgDuration,
          successRate: successRate,
      });
      setStatsLoading(false);

      // --- Map Recent Calls (limit to 5) ---
      if (calls) {
        const mappedData: RecentCall[] = calls.slice(0, 5).map((call) => {
          const analysis = Array.isArray(call.semantic_analysis)
            ? call.semantic_analysis[0]
            : call.semantic_analysis;

          return {
            id: call.id,
            name: call.name || 'Unknown Caller',
            recipient_number: call.recipient_number || 'Unknown Number',
            duration: formatDuration(call.call_duration),
            status: getCallStatus(call.disconnection_reason),
            timeAgo: timeAgo(call.created_at),
            sentiment: analysis?.sentiment || null,
          };
        });
        setRecentCalls(mappedData);
      }
      setLoading(false);
    };

    const fetchMeetings = async () => {
        const { count, error } = await supabase
          .from('call_history')
          .select('*', { count: 'exact', head: true })
          .gte('tour_date', startDate.toISOString().split('T')[0])
          .lte('tour_date', endDate.toISOString().split('T')[0]);
  
        if (error) {
          console.error('Error fetching meetings for period:', error);
          setMeetingsInPeriod(0);
        } else {
          setMeetingsInPeriod(count);
        }
    };

    fetchDashboardData();
    fetchMeetings();
  }, [dateRange]);
  
  const dateRangeLabels: Record<DateRange, string> = {
    today: 'Today',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days'
  };
  const dateRangeLabel = dateRangeLabels[dateRange];

  return (
    <>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h2>
            <p className="mt-1 text-slate-400">Manage your calls and conversations.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
            <DateRangeButton range="today" current={dateRange} setRange={setDateRange}>Today</DateRangeButton>
            <DateRangeButton range="7d" current={dateRange} setRange={setDateRange}>Last 7 Days</DateRangeButton>
            <DateRangeButton range="30d" current={dateRange} setRange={setDateRange}>Last 30 Days</DateRangeButton>
          </div>
        </header>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="sm:col-span-2 lg:col-span-4 flex items-center bg-slate-800 p-4 rounded-xl">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3"></div>
            <p className="text-sm font-medium text-green-300">System Online</p>
          </div>
          
          <StatCard data={{
            id: 'calls', title: `Total Calls (${dateRangeLabel})`, 
            value: statsLoading ? '--' : String(stats.totalCalls),
            change: '', isPositive: true, icon: <ChartBarIcon className="w-8 h-8" /> 
          }} />
          <StatCard data={{
            id: 'duration', title: 'Average Call Duration', 
            value: statsLoading ? '--' : formatDuration(stats.avgDuration),
            change: '', isPositive: true, icon: <ClockIcon className="w-8 h-8" />
          }} />
          <StatCard data={{
            id: 'success', title: 'Success Rate', 
            value: statsLoading ? '--' : `${stats.successRate?.toFixed(1)}%`,
            change: '', isPositive: true, icon: <CheckCircleIcon className="w-8 h-8" />
          }} />
          <StatCard data={{
              id: 'meetings-today',
              title: `Meetings Scheduled (${dateRangeLabel})`,
              value: meetingsInPeriod === null ? '--' : String(meetingsInPeriod),
              change: '',
              isPositive: true,
              icon: <CalendarIcon className="w-8 h-8" />
          }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold text-white">Recent Calls</h3>
            <p className="text-sm text-slate-400 mb-4">Latest voice agent interactions from the selected period</p>
            {loading ? (
              <RecentCallsSkeleton />
            ) : error ? (
              <div className="text-center py-8 text-red-400 bg-red-500/10 rounded-lg" role="alert">
                <p className="font-semibold">An Error Occurred</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            ) : recentCalls.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <p className="font-semibold">No Recent Calls</p>
                    <p className="text-sm mt-1">No calls were found for the selected period.</p>
                     <p className="text-xs mt-4 bg-slate-700/50 p-3 rounded-md max-w-md mx-auto">
                        <b>Tip:</b> If you have data in your Supabase tables but it's not appearing here, ensure that Row Level Security (RLS) is disabled or properly configured for read access.
                    </p>
                </div>
            ) : (
              <div className="space-y-2">
                {recentCalls.map(call => (
                  <RecentCallItem key={call.id} call={call} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-yellow-500/10 border-l-4 border-yellow-400 text-yellow-300 p-4 rounded-r-lg" role="alert">
              <p className="font-bold">Reminder</p>
              <p className="text-sm">3 pending acknowledgments require review.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Dashboard;