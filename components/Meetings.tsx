import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Conversation } from '../types';

type Meeting = Pick<Conversation, 'id' | 'name' | 'recipient_number' | 'tour_date'>;

const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    // Add a time component to the date to ensure it's parsed in the local timezone correctly
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const Meetings: React.FC = () => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({ search: '', startDate: '', endDate: '' });
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(filters.search);
        }, 500);
        return () => clearTimeout(handler);
    }, [filters.search]);

    useEffect(() => {
        const fetchMeetings = async () => {
            setLoading(true);
            setError(null);
            let query = supabase
                .from('call_history')
                .select('id, name, recipient_number, tour_date')
                .not('tour_date', 'is', null)
                .order('tour_date', { ascending: true });

            if (debouncedSearch) {
                query = query.or(`name.ilike.%${debouncedSearch}%,recipient_number.ilike.%${debouncedSearch}%`);
            }
            if (filters.startDate) {
                query = query.gte('tour_date', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('tour_date', filters.endDate);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching meetings:', error);
                setError('Failed to load scheduled meetings.');
            } else {
                setMeetings(data as Meeting[]);
            }
            setLoading(false);
        };

        fetchMeetings();
    }, [debouncedSearch, filters.startDate, filters.endDate]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ search: '', startDate: '', endDate: '' });
    };

    const TableSkeleton = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-800">
                    <tr>
                        {['Tour Date', 'Name', 'Phone Number', 'Call ID'].map(header => (
                            <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">{header}</th>
                        ))}
                    </tr>
                </thead>
            </table>
            <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-700/50 rounded-md animate-pulse"></div>
                ))}
            </div>
        </div>
    );

    return (
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
            <header>
              <h2 className="text-3xl font-bold tracking-tight text-white">Scheduled Meetings</h2>
              <p className="mt-1 text-slate-400">Review all upcoming tours scheduled by the voice agent.</p>
            </header>

            <div className="bg-slate-800/50 p-4 rounded-xl flex flex-wrap items-center gap-4 border border-slate-700/50">
                <input
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Search by name or number..."
                    className="flex-grow bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <div className="flex items-center gap-2">
                    <label htmlFor="startDate" className="text-sm text-slate-400">From:</label>
                    <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={handleFilterChange} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
                 <div className="flex items-center gap-2">
                    <label htmlFor="endDate" className="text-sm text-slate-400">To:</label>
                    <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={handleFilterChange} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
                <button onClick={clearFilters} className="bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Clear</button>
            </div>

            <div className="bg-slate-800 p-4 sm:p-6 rounded-xl shadow-lg">
                {loading ? (
                    <TableSkeleton />
                ) : error ? (
                    <div className="text-center py-8 text-red-400 bg-red-900/20 p-4 rounded-lg">{error}</div>
                ) : meetings.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <p className="font-semibold">No Meetings Scheduled</p>
                        <p className="text-sm mt-1">No meetings match the current filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-700">
                            <thead className="bg-slate-800">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Tour Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Phone Number</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Reference Call ID</th>
                                </tr>
                            </thead>
                            <tbody className="bg-slate-800 divide-y divide-slate-700/50">
                                {meetings.map((meeting) => (
                                    <tr key={meeting.id} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{formatDate(meeting.tour_date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{meeting.name || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{meeting.recipient_number || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{meeting.id}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
};

export default Meetings;