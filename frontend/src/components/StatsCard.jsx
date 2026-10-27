import React from 'react';

export const StatsCard = ({ title, value, icon: Icon, colorClass, subtitle }) => {
  return (
    <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${colorClass} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-extrabold text-white mt-1 tracking-tight">{value}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-white shadow-inner`}>
          <Icon className="w-5 h-5 text-indigo-400" />
        </div>
      </div>
    </div>
  );
};
