import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database, Json } from '../types';

type AnalysisRow = Database['public']['Tables']['semantic_analysis']['Row'];

// --- Helper Components ---

const ChevronIcon: React.FC<{ isExpanded: boolean }> = ({ isExpanded }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`h-5 w-5 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const StatusBadge: React.FC<{ text: string | null; type: 'sentiment' | 'alert' }> = ({ text, type }) => {
    const status = text?.toLowerCase() || 'unknown';
    let styles = 'bg-slate-600/20 text-slate-300'; // Default/unknown

    if (type === 'sentiment') {
        switch (status) {
            case 'positive': styles = 'bg-green-500/20 text-green-300'; break;
            case 'negative': styles = 'bg-red-500/20 text-red-300'; break;
            case 'neutral': styles = 'bg-sky-500/20 text-sky-300'; break;
        }
    } else if (type === 'alert') {
        switch (status) {
            case 'ok': styles = 'bg-green-500/20 text-green-300'; break;
            case 'warning': styles = 'bg-yellow-500/20 text-yellow-300'; break;
            case 'error': styles = 'bg-red-500/20 text-red-300'; break;
        }
    }

    return (
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${styles}`}>
            {status}
        </span>
    );
};

const DetailListView: React.FC<{ title: string, data: Json | null }> = ({ title, data }) => {
    let items: string[] = [];
    if (Array.isArray(data)) {
        items = data.map(String);
    } else if (data && typeof data === 'object') {
        items = Object.keys(data);
    } else if (typeof data === 'string' && data.length > 0) {
        items = [data];
    }
    
    return (
        <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">{title}</h4>
            {items.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                    {items.map((item, index) => (
                        <li key={index} className="text-xs font-mono bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md">
                            {item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-slate-500 italic">None detected</p>
            )}
        </div>
    );
};


// --- Formatting Helpers ---

const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatPercentage = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
};

const SemanticAnalysisTable: React.FC = () => {
    const [analysisData, setAnalysisData] = useState<AnalysisRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({ callId: '', sentiment: '', alertStatus: '', startDate: '', endDate: '' });
    const [debouncedCallId, setDebouncedCallId] = useState('');
    const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedCallId(filters.callId);
        }, 500);
        return () => clearTimeout(handler);
    }, [filters.callId]);

    useEffect(() => {
        const fetchAnalysisData = async () => {
            setLoading(true);
            setError(null);
            let query = supabase
                .from('semantic_analysis')
                .select('*')
                .order('created_at', { ascending: false });

            if (debouncedCallId) {
                // FIX: The `call_id` column is numeric, so we must parse the string from the filter input.
                query = query.eq('call_id', parseInt(debouncedCallId, 10));
            }
            if (filters.sentiment) {
                query = query.eq('sentiment', filters.sentiment);
            }
            if (filters.alertStatus) {
                query = query.eq('alert_status', filters.alertStatus);
            }
            if (filters.startDate) {
                query = query.gte('created_at', `${filters.startDate}T00:00:00.000Z`);
            }
            if (filters.endDate) {
                query = query.lte('created_at', `${filters.endDate}T23:59:59.999Z`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching semantic analysis:', error);
                setError('Failed to load analysis data.');
            } else {
                setAnalysisData(data);
            }
            setLoading(false);
        };
        fetchAnalysisData();
    }, [debouncedCallId, filters.sentiment, filters.alertStatus, filters.startDate, filters.endDate]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ callId: '', sentiment: '', alertStatus: '', startDate: '', endDate: '' });
    };
    
    const handleRowToggle = (rowId: number) => {
        setExpandedRowId(expandedRowId === rowId ? null : rowId);
    };

    const TableSkeleton = () => (
        <div className="p-4 space-y-3">
            {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-700/50 rounded-md animate-pulse"></div>
            ))}
        </div>
    );

    const headers = ['Call ID', 'Date', 'Sentiment', 'Alert Status', 'Confidence'];
    const inputStyles = "bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

    return (
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
            <header>
              <h2 className="text-3xl font-bold tracking-tight text-white">Semantic Analysis Details</h2>
              <p className="mt-1 text-slate-400">A detailed, record-by-record breakdown of every analyzed call.</p>
            </header>

            <div className="bg-slate-800/50 p-4 rounded-xl flex flex-wrap items-center gap-4 border border-slate-700/50">
                <input type="text" name="callId" value={filters.callId} onChange={handleFilterChange} placeholder="Search by Call ID..." className={`${inputStyles} w-full sm:w-auto sm:flex-grow`} />
                <select name="sentiment" value={filters.sentiment} onChange={handleFilterChange} className={inputStyles}>
                    <option value="">All Sentiments</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                    <option value="neutral">Neutral</option>
                </select>
                <select name="alertStatus" value={filters.alertStatus} onChange={handleFilterChange} className={inputStyles}>
                    <option value="">All Alerts</option>
                    <option value="ok">Ok</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                </select>
                <div className="flex items-center gap-2"><label className="text-sm text-slate-400">From:</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={inputStyles} /></div>
                <div className="flex items-center gap-2"><label className="text-sm text-slate-400">To:</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={inputStyles} /></div>
                <button onClick={clearFilters} className="bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Clear</button>
            </div>

            <div className="bg-slate-800 p-0 sm:p-0 rounded-xl shadow-lg">
                {loading ? (
                    <TableSkeleton />
                ) : error ? (
                    <div className="text-center py-8 text-red-400 bg-red-900/20 p-4 rounded-lg">{error}</div>
                ) : analysisData.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <p className="font-semibold">No Analysis Data Found</p>
                        <p className="text-sm mt-1">No results match the current filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-700/50">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    <th className="w-12 px-4"></th>
                                    {headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {analysisData.map((row) => (
                                    <React.Fragment key={row.id}>
                                        <tr onClick={() => handleRowToggle(row.id)} className="hover:bg-slate-700/50 transition-colors cursor-pointer text-sm">
                                            <td className="px-4 py-3"><ChevronIcon isExpanded={expandedRowId === row.id} /></td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-300 font-medium">{row.call_id}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-400">{formatDate(row.created_at)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap"><StatusBadge text={row.sentiment} type="sentiment" /></td>
                                            <td className="px-4 py-3 whitespace-nowrap"><StatusBadge text={row.alert_status} type="alert" /></td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-300">{formatPercentage(row.agent_confidence)}</td>
                                        </tr>
                                        {expandedRowId === row.id && (
                                            <tr className="bg-slate-900/30">
                                                <td colSpan={headers.length + 1} className="p-0">
                                                  <div className="bg-slate-800/40 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                                                    <div className="md:col-span-2 lg:col-span-3">
                                                      <h4 className="text-sm font-semibold text-slate-300 mb-2">Summary</h4>
                                                      <p className="text-sm text-slate-400 leading-relaxed">{row.summary || 'No summary available.'}</p>
                                                    </div>
                                                    
                                                    <div>
                                                      <h4 className="text-sm font-semibold text-slate-300 mb-2">Details</h4>
                                                      <ul className="text-sm text-slate-400 space-y-1.5">
                                                        <li><strong>Analysis ID:</strong> <span className="text-slate-300">{row.id}</span></li>
                                                        <li><strong>Sentiment Score:</strong> <span className="text-slate-300">{formatPercentage(row.sentiment_score)}</span></li>
                                                      </ul>
                                                    </div>
                                                    
                                                    <DetailListView title="Positive Indicators" data={row.positive_indicators} />
                                                    <DetailListView title="Negative Indicators" data={row.negative_indicators} />
                                                    <DetailListView title="Buying Signals" data={row.buying_signals} />
                                                  </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
};

export default SemanticAnalysisTable;
