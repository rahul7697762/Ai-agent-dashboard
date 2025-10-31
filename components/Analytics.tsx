import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Database, Json } from '../types';

type Analysis = Database['public']['Tables']['semantic_analysis']['Row'];
type DateRange = 'all' | '7d' | '30d' | '90d';

const countOccurrences = (items: (Json | null)[]) => {
    const counter: { [key: string]: number } = {};
    items.forEach(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            const keys = Object.keys(item);
            keys.forEach(k => {
                counter[k] = (counter[k] || 0) + 1;
            });
        } else if (item && Array.isArray(item)) {
             item.forEach(i => {
                if (typeof i === 'string') {
                    counter[i] = (counter[i] || 0) + 1;
                }
             });
        }
    });
    return Object.entries(counter)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5); // Return top 5
};

const AnalyticsCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-slate-800 p-6 rounded-xl shadow-lg ${className}`}>
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {children}
    </div>
);

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


const Analytics: React.FC = () => {
    const [analysisData, setAnalysisData] = useState<Analysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>('all');

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            
            let query = supabase
                .from('semantic_analysis')
                .select('*');

            if (dateRange !== 'all') {
                const days = parseInt(dateRange.replace('d', ''));
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                query = query.gte('created_at', startDate.toISOString());
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching analytics:', error);
                setError('Failed to load analytics data.');
            } else {
                setAnalysisData(data);
            }
            setLoading(false);
        };
        fetchAnalytics();
    }, [dateRange]);

    const processedData = useMemo(() => {
        if (analysisData.length === 0) {
            return null;
        }

        const sentimentCounts = analysisData.reduce((acc, curr) => {
            const sentiment = curr.sentiment?.toLowerCase() || 'unknown';
            acc[sentiment] = (acc[sentiment] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        
        const totalSentiments = analysisData.filter(d => d.sentiment).length;

        const avgConfidence = analysisData
            .filter(d => d.agent_confidence !== null)
            .reduce((sum, curr) => sum + (curr.agent_confidence || 0), 0) / analysisData.filter(d => d.agent_confidence !== null).length;
            
        const topPositive = countOccurrences(analysisData.map(d => d.positive_indicators));
        const topNegative = countOccurrences(analysisData.map(d => d.negative_indicators));
        const topBuyingSignals = countOccurrences(analysisData.map(d => d.buying_signals));

        return {
            sentimentCounts,
            totalSentiments,
            avgConfidence,
            topPositive,
            topNegative,
            topBuyingSignals,
        };
    }, [analysisData]);

    if (loading) {
        return (
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="text-center py-16">
                    <svg className="animate-spin h-8 w-8 text-blue-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-slate-400">Loading Analytics...</p>
                </div>
            </main>
        );
    }
    
    if (error) {
        return <main className="flex-1 p-4 sm:p-6 lg:p-8"><div className="text-center py-8 text-red-400 bg-red-900/20 p-4 rounded-lg">{error}</div></main>;
    }

    if (!processedData) {
        return (
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <header>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Analytics</h2>
                    <p className="mt-1 text-slate-400">Key insights from semantic analysis.</p>
                </header>
                <div className="text-center py-16 text-slate-400">
                    <p className="font-semibold">No Analytics Data Found</p>
                    <p className="text-sm mt-1">Semantic analysis data will appear here once calls are processed.</p>
                </div>
            </main>
        );
    }

    const sentimentColors: { [key: string]: string } = {
        positive: 'bg-green-500',
        negative: 'bg-red-500',
        neutral: 'bg-sky-500',
        unknown: 'bg-slate-600'
    };
    
    const IndicatorList: React.FC<{ title: string; data: [string, number][] }> = ({ title, data }) => (
        <div className="space-y-2">
            <h4 className="font-semibold text-slate-300">{title}</h4>
            {data.length > 0 ? (
                <ul className="text-sm text-slate-400 list-inside space-y-1">
                    {data.map(([indicator, count]) => (
                        <li key={indicator} className="flex justify-between items-center">
                            <span>{indicator.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            <span className="font-mono bg-slate-700/50 px-2 rounded-md text-xs">{count}</span>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-sm text-slate-500 italic">None detected.</p>}
        </div>
    );

    return (
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Analytics</h2>
                    <p className="mt-1 text-slate-400">Key insights from semantic analysis.</p>
                </div>
                 <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
                    <DateRangeButton range="7d" current={dateRange} setRange={setDateRange}>7 Days</DateRangeButton>
                    <DateRangeButton range="30d" current={dateRange} setRange={setDateRange}>30 Days</DateRangeButton>
                    <DateRangeButton range="90d" current={dateRange} setRange={setDateRange}>90 Days</DateRangeButton>
                    <DateRangeButton range="all" current={dateRange} setRange={setDateRange}>All Time</DateRangeButton>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnalyticsCard title="Sentiment Distribution" className="md:col-span-2">
                    <div className="space-y-3">
                        <p className="text-sm text-slate-400">Breakdown of call sentiments based on {processedData.totalSentiments} analyzed calls.</p>
                        <div className="w-full bg-slate-700 rounded-full h-4 flex overflow-hidden my-2">
                            {Object.entries(processedData.sentimentCounts).map(([sentiment, count]) => (
                                <div
                                    key={sentiment}
                                    className={`${sentimentColors[sentiment] || 'bg-slate-600'}`}
                                    style={{ width: `${(count / processedData.totalSentiments) * 100}%` }}
                                    title={`${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}: ${count} (${((count / processedData.totalSentiments) * 100).toFixed(1)}%)`}
                                ></div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {Object.entries(processedData.sentimentCounts).map(([sentiment, count]) => (
                                <div key={sentiment} className="flex items-center">
                                    <span className={`w-2 h-2 rounded-full mr-1.5 ${sentimentColors[sentiment]}`}></span>
                                    <span className="text-slate-300 capitalize">{sentiment}</span>
                                    <span className="text-slate-400 ml-1">({count})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </AnalyticsCard>
                
                <AnalyticsCard title="Average Agent Confidence">
                    <p className="text-4xl font-bold text-blue-400">
                        {isNaN(processedData.avgConfidence) ? 'N/A' : (processedData.avgConfidence * 100).toFixed(1) + '%'}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">Average confidence score across all analyzed calls.</p>
                </AnalyticsCard>

                <AnalyticsCard title="Buying Signals">
                    <IndicatorList title="Top 5 Detected Signals" data={processedData.topBuyingSignals} />
                </AnalyticsCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnalyticsCard title="Top Positive Indicators">
                    <IndicatorList title="" data={processedData.topPositive} />
                </AnalyticsCard>

                <AnalyticsCard title="Top Negative Indicators">
                   <IndicatorList title="" data={processedData.topNegative} />
                </AnalyticsCard>
            </div>
        </main>
    );
};

export default Analytics;