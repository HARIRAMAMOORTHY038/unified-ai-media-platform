import React, { useState, useEffect } from 'react';
import { captionApi } from '../services/api';
import {
  Download,
  Save,
  Plus,
  Trash2,
  Play,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Loader2
} from 'lucide-react';

export const CaptionEditor = ({ track, onCuesUpdated, onSeek, getCurrentVideoTime }) => {
  const [cues, setCues] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (track && track.cues) {
      setCues(JSON.parse(JSON.stringify(track.cues)));
      setHasUnsavedChanges(false);
      setSaveSuccess(false);
      setError(null);
    }
  }, [track]);

  const handleCueTextChange = (index, newText) => {
    const updated = [...cues];
    updated[index].text = newText;
    setCues(updated);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleTimeChange = (index, field, value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const updated = [...cues];
    updated[index][field] = Math.max(0, num);
    setCues(updated);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleDeleteCue = (index) => {
    const updated = cues.filter((_, i) => i !== index);
    setCues(updated);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleAddCue = () => {
    const currentTime = getCurrentVideoTime ? getCurrentVideoTime() : 0;
    const newCue = {
      cue_index: cues.length + 1,
      start_time: Math.round(currentTime * 10) / 10,
      end_time: Math.round((currentTime + 3) * 10) / 10,
      text: 'New subtitle cue',
    };
    const updated = [...cues, newCue].sort((a, b) => a.start_time - b.start_time);
    setCues(updated);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = cues.map((c, i) => ({
        cue_index: i + 1,
        start_time: c.start_time,
        end_time: c.end_time,
        text: c.text,
      }));
      const res = await captionApi.updateTrack(track.id, payload);
      setCues(res.data.cues);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      if (onCuesUpdated) {
        onCuesUpdated(res.data);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save captions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadSrt = () => {
    const token = localStorage.getItem('token');
    const url = `/api/captions/tracks/${track.id}/export/srt?token=${encodeURIComponent(token || '')}`;
    window.open(url, '_blank');
  };

  const handleDownloadVtt = () => {
    const token = localStorage.getItem('token');
    const url = `/api/captions/tracks/${track.id}/export/vtt?download=true&token=${encodeURIComponent(token || '')}`;
    window.open(url, '_blank');
  };

  const filteredCues = cues.filter((c) =>
    c.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!track) {
    return (
      <div className="glass-panel p-8 rounded-2xl text-center text-slate-500">
        Select a subtitle track above to inspect or edit captions.
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-white text-base">
              Caption Editor: {track.language_name}
            </h3>
            {track.is_original ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Original AI Speech-to-Text
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AI Translation
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Unsaved Edits
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {cues.length} total subtitle cues. Edit text or timing and save back to SQLite.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2 flex-wrap">
          <button
            onClick={handleAddCue}
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center space-x-1.5"
            title="Add a new cue at current playback time"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Cue</span>
          </button>

          <button
            onClick={handleDownloadSrt}
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center space-x-1.5"
            title="Download SRT subtitle file"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>SRT</span>
          </button>

          <button
            onClick={handleDownloadVtt}
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center space-x-1.5"
            title="Download WebVTT subtitle file"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>VTT</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Edits</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Captions saved successfully! SRT and VTT files updated on server.</span>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter cues by text..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Cues List */}
      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
        {filteredCues.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {cues.length === 0 ? 'No cues found in this track.' : 'No cues match your search.'}
          </div>
        ) : (
          filteredCues.map((cue, idx) => {
            const originalIndex = cues.findIndex((c) => c === cue);
            return (
              <div
                key={idx}
                className="p-3 bg-slate-900/70 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors space-y-2 group"
              >
                {/* Header row: Index, Time range, Play seek, Delete */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-400">
                      #{cue.cue_index || idx + 1}
                    </span>

                    {/* Start Time */}
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={cue.start_time}
                        onChange={(e) => handleTimeChange(originalIndex, 'start_time', e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-brand-500 text-center"
                        title="Start time (seconds)"
                      />
                      <span className="text-slate-500">&rarr;</span>
                      {/* End Time */}
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={cue.end_time}
                        onChange={(e) => handleTimeChange(originalIndex, 'end_time', e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-brand-500 text-center"
                        title="End time (seconds)"
                      />
                      <span className="text-slate-500 text-[10px]">s</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSeek && onSeek(cue.start_time)}
                      className="px-2 py-0.5 rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white text-[11px] font-medium transition-colors flex items-center space-x-1"
                      title="Seek player to cue"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Play</span>
                    </button>

                    <button
                      onClick={() => handleDeleteCue(originalIndex)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Delete cue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtitle Text Textarea */}
                <textarea
                  rows={2}
                  value={cue.text}
                  onChange={(e) => handleCueTextChange(originalIndex, e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-brand-500 transition-colors resize-none leading-relaxed"
                  placeholder="Enter subtitle text..."
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
