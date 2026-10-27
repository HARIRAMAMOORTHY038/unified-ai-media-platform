import React, { useState } from 'react';
import { Play, Subtitles, Clock, HardDrive, Trash2, Calendar, FileVideo } from 'lucide-react';

export const MediaCard = ({ video, onSelect, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${video.title}" and its captions?`)) {
      setIsDeleting(true);
      await onDelete(video.id);
      setIsDeleting(false);
    }
  };

  return (
    <div
      onClick={() => onSelect(video.id)}
      className="glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col justify-between hover:scale-[1.01] transition-all duration-200 border border-slate-800/80 hover:border-brand-500/50"
    >
      <div>
        {/* Video Thumbnail Placeholder / Preview Box */}
        <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 flex items-center justify-center overflow-hidden border-b border-slate-800/60">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-brand-600 group-hover:text-white transition-all shadow-lg">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>

          {/* Duration Badge */}
          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono font-medium text-slate-200 flex items-center space-x-1 border border-white/10">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatDuration(video.duration_seconds)}</span>
          </div>

          {/* Tracks count badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
            <span className="px-2 py-0.5 rounded-md bg-brand-600/80 backdrop-blur-md text-[10px] font-semibold text-white flex items-center space-x-1 border border-brand-400/30">
              <Subtitles className="w-3 h-3" />
              <span>{video.caption_tracks_count || 0} Subtitle {video.caption_tracks_count === 1 ? 'Track' : 'Tracks'}</span>
            </span>
            {video.dubbed_tracks_count > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-600/80 backdrop-blur-md text-[10px] font-semibold text-white flex items-center space-x-1 border border-emerald-400/30">
                <span>{video.dubbed_tracks_count} Dubbed</span>
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <h4 className="font-semibold text-white text-sm line-clamp-1 group-hover:text-brand-400 transition-colors">
            {video.title}
          </h4>
          <p className="text-xs text-slate-400 line-clamp-1 font-mono">
            {video.original_filename}
          </p>

          <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500 border-t border-slate-800/60">
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3 h-3 text-slate-400" />
              <span>{formatSize(video.file_size_bytes)}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{formatDate(video.created_at)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-4 pb-4 pt-1 flex items-center justify-between">
        <button
          onClick={() => onSelect(video.id)}
          className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center space-x-1"
        >
          <span>Open Studio</span>
          <span>&rarr;</span>
        </button>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete Video"
          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
