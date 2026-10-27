import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Video, LogOut, User, UploadCloud, Layers } from 'lucide-react';

export const Navbar = ({ onOpenUpload, onNavigateHome, currentView }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#0b0f17]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Brand */}
        <div
          onClick={onNavigateHome}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-accent-cyan p-[2px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0b0f17] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-brand-500 group-hover:text-accent-cyan transition-colors" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">Unified AI</span>

            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Media Captioning & Translation Studio</p>
          </div>
        </div>

        {/* Center Navigation */}
        <div className="hidden md:flex items-center space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={onNavigateHome}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-2 ${currentView === 'dashboard'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Media Library</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenUpload}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 glow-btn transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Upload Video</span>
            <span className="sm:hidden">Upload</span>
          </button>

          {/* User profile dropdown / logout */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
            <div className="flex items-center space-x-2 px-2.5 py-1.5 bg-slate-900/80 rounded-xl border border-slate-800 text-slate-300">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white uppercase">
                {user?.username ? user.username[0] : 'U'}
              </div>
              <span className="text-xs font-medium max-w-[100px] truncate hidden sm:inline">
                {user?.full_name || user?.username}
              </span>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
