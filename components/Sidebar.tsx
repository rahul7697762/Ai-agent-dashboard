import React from 'react';
import { ICONS } from '../constants';

type View = 'overview' | 'conversations' | 'meetings' | 'analytics' | 'analysis_details';

interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeView: View;
  navigate: (view: View) => void;
}

const NavLink: React.FC<{ icon: React.ReactElement, text: string, active?: boolean, onClick?: () => void, disabled?: boolean }> = ({ icon, text, active = false, onClick, disabled = false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-colors duration-200 text-left ${active ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {icon}
        <span className="ml-4 font-medium">{text}</span>
    </button>
);

const NavSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-6">
    <h3 className="px-4 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h3>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, toggleSidebar, activeView, navigate }) => {
  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black/60 z-30 lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      ></div>
      
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-800/95 backdrop-blur-sm border-r border-slate-700/50 z-40 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700">
            <h1 className="text-xl font-bold text-white tracking-wider">
              <span className="text-blue-400">Voice</span>Agent
            </h1>
            <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <NavSection title="Dashboard">
              <NavLink icon={ICONS.dashboard} text="Overview" active={activeView === 'overview'} onClick={() => navigate('overview')} />
              <NavLink icon={ICONS.conversations} text="Conversations" active={activeView === 'conversations'} onClick={() => navigate('conversations')} />
              <NavLink icon={ICONS.meetings} text="Meetings" active={activeView === 'meetings'} onClick={() => navigate('meetings')} />
              <NavLink icon={ICONS.analytics} text="Analytics" active={activeView === 'analytics'} onClick={() => navigate('analytics')} />
              <NavLink icon={ICONS.analysis_details} text="Analysis Details" active={activeView === 'analysis_details'} onClick={() => navigate('analysis_details')} />
            </NavSection>
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;