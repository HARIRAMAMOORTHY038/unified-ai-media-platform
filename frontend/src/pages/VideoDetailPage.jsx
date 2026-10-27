import React, { useState, useEffect, useRef } from 'react';
import { mediaApi, captionApi, translationApi, dubbingApi } from '../services/api';
import { VideoPlayer } from '../components/VideoPlayer';
import { CaptionEditor } from '../components/CaptionEditor';
import { LanguageSelector } from '../components/LanguageSelector';
import {
  ArrowLeft,
  Sparkles,
  Globe,
  Subtitles,
  Trash2,
  Clock,
  HardDrive,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Headphones,
  Download,
  Film,
  Play,
  Volume2
} from 'lucide-react';

export const VideoDetailPage = ({ videoId, onBack }) => {
  const [video, setVideo] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [activeTrackData, setActiveTrackData] = useState(null);

  // Dubbed tracks state
  const [dubbedTracks, setDubbedTracks] = useState([]);
  const [activeDubbedTrackId, setActiveDubbedTrackId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDubbing, setIsDubbing] = useState(false);
  const [exportingDubId, setExportingDubId] = useState(null);
  const [isTranslateModalOpen, setIsTranslateModalOpen] = useState(false);

  // Clearly separated Source and Target languages
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('ta'); // Default to Tamil as requested

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const playerRef = useRef(null);

  // Fetch video details, caption tracks, and dubbed tracks
  const fetchVideoData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mediaApi.getVideo(videoId);
      setVideo(res.data);

      const tracksRes = await captionApi.getTracks(videoId);
      setTracks(tracksRes.data);

      // Select first track by default if available
      if (tracksRes.data.length > 0 && !activeTrackId) {
        setActiveTrackId(tracksRes.data[0].id);
      }

      // Fetch dubbed tracks
      const dubbedRes = await dubbingApi.getTracks(videoId);
      setDubbedTracks(dubbedRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load video studio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideoData();
  }, [videoId]);

  // When activeTrackId changes, fetch full cues for CaptionEditor
  useEffect(() => {
    const fetchTrackDetails = async () => {
      if (!activeTrackId) {
        setActiveTrackData(null);
        return;
      }
      try {
        const res = await captionApi.getTrack(activeTrackId);
        setActiveTrackData(res.data);
      } catch (err) {
        console.error('Failed to load track cues:', err);
      }
    };

    fetchTrackDetails();
  }, [activeTrackId]);

  // 1. Run Faster-Whisper Speech Recognition on Original Spoken Audio
  const handleTranscribe = async () => {
    setTranscribing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await captionApi.transcribe(
        videoId,
        sourceLanguage === 'auto' ? null : sourceLanguage
      );
      setSuccessMsg(`Speech recognition complete! Spoken language: ${res.data.language_name}`);

      // Refresh tracks list
      const updatedTracks = await captionApi.getTracks(videoId);
      setTracks(updatedTracks.data);
      setActiveTrackId(res.data.id);
      setActiveTrackData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Speech recognition failed. Please try again.');
    } finally {
      setTranscribing(false);
    }
  };

  // 2. Direct Translation to Selected Target Language
  const handleTranslateDirect = async () => {
    setIsTranslating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const origTrack = tracks.find((t) => t.is_original) || tracks[0];
      if (!origTrack) {
        throw new Error('Please transcribe the original video speech before translating.');
      }

      const res = await translationApi.translate(videoId, origTrack.id, [targetLanguage]);
      setSuccessMsg(`Subtitles translated to ${targetLanguage.toUpperCase()} successfully!`);

      const updatedTracks = await captionApi.getTracks(videoId);
      setTracks(updatedTracks.data);
      if (res.data && res.data.length > 0) {
        setActiveTrackId(res.data[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  // 3. Generate Real Dubbed Audio in Selected Target Language
  const handleGenerateDub = async () => {
    setIsDubbing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const origTrack = tracks.find((t) => t.is_original) || tracks[0];
      const res = await dubbingApi.generateDub(
        videoId,
        targetLanguage,
        origTrack ? origTrack.id : null
      );
      setSuccessMsg(`Dubbed speech in ${res.data.language_name} generated and synchronized successfully!`);

      // Refresh dubbed tracks and caption tracks
      const dubbedRes = await dubbingApi.getTracks(videoId);
      setDubbedTracks(dubbedRes.data);
      setActiveDubbedTrackId(res.data.id);

      const updatedTracks = await captionApi.getTracks(videoId);
      setTracks(updatedTracks.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Dubbed audio generation failed.');
    } finally {
      setIsDubbing(false);
    }
  };

  // 4. Export Video with Dubbed Audio replacing original audio
  const handleExportDubbedVideo = async (trackId) => {
    setExportingDubId(trackId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await dubbingApi.exportVideo(trackId);
      setSuccessMsg(`Dubbed video exported successfully! Download is ready.`);
      const dubbedRes = await dubbingApi.getTracks(videoId);
      setDubbedTracks(dubbedRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Dubbed video export failed.');
    } finally {
      setExportingDubId(null);
    }
  };

  // Delete Dubbed Track
  const handleDeleteDubbedTrack = async (trackId) => {
    if (!window.confirm('Are you sure you want to delete this dubbed audio track?')) return;
    try {
      await dubbingApi.deleteTrack(trackId);
      setDubbedTracks(dubbedTracks.filter((d) => d.id !== trackId));
      if (activeDubbedTrackId === trackId) {
        setActiveDubbedTrackId(null);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete dubbed track');
    }
  };

  // Delete Caption Track
  const handleDeleteTrack = async (trackId) => {
    if (!window.confirm('Are you sure you want to delete this caption track?')) return;
    try {
      await captionApi.deleteTrack(trackId);
      const updatedTracks = tracks.filter((t) => t.id !== trackId);
      setTracks(updatedTracks);
      if (activeTrackId === trackId) {
        setActiveTrackId(updatedTracks.length > 0 ? updatedTracks[0].id : null);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete track');
    }
  };

  const handleSeekPlayer = (timeInSeconds) => {
    if (playerRef.current) {
      playerRef.current.seekTo(timeInSeconds);
    }
  };

  const getCurrentVideoTime = () => {
    return playerRef.current ? playerRef.current.getCurrentTime() : 0;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <p className="text-xs text-slate-400">Loading video workspace...</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Video Not Found</h3>
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Top Header & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Back to Media Library"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight truncate max-w-md">
                {video.title}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300">
                {video.mime_type}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono flex items-center space-x-3 mt-0.5">
              <span>{video.original_filename}</span>
              <span>•</span>
              <span>{formatSize(video.file_size_bytes)}</span>
              <span>•</span>
              <span>{formatDuration(video.duration_seconds)}</span>
            </p>
          </div>
        </div>

        {/* Quick Badges */}
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center space-x-1.5">
            <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{tracks.length} Subtitles</span>
          </span>
          <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center space-x-1.5">
            <Headphones className="w-3.5 h-3.5 text-emerald-400" />
            <span>{dubbedTracks.length} Dubbed Tracks</span>
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Player, Processing Pipeline, Dubbed Tracks (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">

          {/* Synchronized Video Player with Dubbed Audio Switcher */}
          <VideoPlayer
            ref={playerRef}
            video={video}
            tracks={tracks.map((t) => (t.id === activeTrackId && activeTrackData ? activeTrackData : t))}
            activeTrackId={activeTrackId}
            onTrackChange={(trackId) => setActiveTrackId(trackId)}
            dubbedTracks={dubbedTracks}
            activeDubbedTrackId={activeDubbedTrackId}
            onDubbedTrackChange={(dId) => setActiveDubbedTrackId(dId)}
          />

          {/* AI Workflow Hub: Clearly Separating Source vs Target Languages */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Cpu className="w-4 h-4 text-brand-400" />
                <span>AI Speech & Dubbing Pipeline</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">Whisper STT + Neural TTS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

              {/* Step 1: Speech-to-Text (Source Spoken Language) */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>1. Original Speech (Source)</span>
                    </h5>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Whisper
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Select language spoken in the video or use Auto Detect.
                  </p>
                </div>

                <div className="space-y-2">
                  <select
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    disabled={transcribing}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="auto">Auto Detect Spoken Language (Recommended)</option>
                    <option value="en">English (Video Audio)</option>
                    <option value="hi">Hindi (Video Audio)</option>
                    <option value="ta">Tamil (Video Audio)</option>
                    <option value="te">Telugu (Video Audio)</option>
                    <option value="ml">Malayalam (Video Audio)</option>
                    <option value="es">Spanish (Video Audio)</option>
                    <option value="fr">French (Video Audio)</option>
                    <option value="de">German (Video Audio)</option>
                    <option value="ur">Urdu (Video Audio)</option>
                    <option value="ar">Arabic (Video Audio)</option>
                  </select>

                  <button
                    onClick={handleTranscribe}
                    disabled={transcribing}
                    className="w-full py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg shadow-md transition-all flex items-center justify-center space-x-1.5"
                  >
                    {transcribing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Transcribing Speech...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Transcribe Original Audio</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Target Language for Translation & Voice Dubbing */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5 text-accent-cyan" />
                      <span>2. Target Language (Sub & Dub)</span>
                    </h5>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Neural TTS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Select language for translated captions & dubbed speech.
                  </p>
                </div>

                <div className="space-y-2">
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    disabled={isTranslating || isDubbing}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="ta">Tamil (தமிழ்)</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="es">Spanish (Español)</option>
                    <option value="fr">French (Français)</option>
                    <option value="de">German (Deutsch)</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="ml">Malayalam (മലയാളം)</option>
                    <option value="kn">Kannada (ಕನ್ನಡ)</option>
                    <option value="mr">Marathi (मराठी)</option>
                    <option value="bn">Bengali (বাংলা)</option>
                    <option value="ur">Urdu (اردو)</option>
                    <option value="zh-CN">Chinese (中文)</option>
                    <option value="ja">Japanese (日本語)</option>
                    <option value="ar">Arabic (العربية)</option>
                    <option value="ru">Russian (Русский)</option>
                    <option value="en">English (English)</option>
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleTranslateDirect}
                      disabled={isTranslating || tracks.length === 0}
                      className="py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center space-x-1"
                      title="Translate original subtitles to target language"
                    >
                      {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5 text-cyan-400" />}
                      <span>Translate</span>
                    </button>

                    <button
                      onClick={handleGenerateDub}
                      disabled={isDubbing || tracks.length === 0}
                      className="py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg shadow-md transition-all flex items-center justify-center space-x-1"
                      title="Generate real spoken dubbed audio aligned to timeline"
                    >
                      {isDubbing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Dubbing...</span>
                        </>
                      ) : (
                        <>
                          <Headphones className="w-3.5 h-3.5" />
                          <span>Generate Dub</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section: Available Dubbed Audio Tracks */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                <span>Synthesized Dubbed Audio Tracks ({dubbedTracks.length})</span>
              </h4>
              <span className="text-[10px] text-slate-500">Mutes original speech when active</span>
            </div>

            {dubbedTracks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No dubbed audio generated yet. Choose a target language above (e.g. Tamil or Hindi) and click "Generate Dub".
              </p>
            ) : (
              <div className="space-y-2">
                {dubbedTracks.map((dub) => {
                  const isActive = activeDubbedTrackId === dub.id;
                  const isExporting = exportingDubId === dub.id;

                  return (
                    <div
                      key={dub.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${isActive
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md'
                          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white">
                              Dubbed {dub.language_name}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                              {dub.duration_seconds}s
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                Playing in Video
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Neural speech timeline-aligned to video cues.
                          </p>
                        </div>
                      </div>

                      {/* Dub Action Buttons */}
                      <div className="flex items-center space-x-1.5 self-end sm:self-auto flex-wrap">
                        {/* Toggle in Player */}
                        <button
                          onClick={() => setActiveDubbedTrackId(isActive ? null : dub.id)}
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors flex items-center space-x-1 ${isActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isActive ? 'Active' : 'Preview'}</span>
                        </button>

                        {/* Download Audio File */}
                        <a
                          href={dubbingApi.getAudioDownloadUrl(dub.id)}
                          download
                          className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center space-x-1"
                          title="Download synthesized audio file (.mp3)"
                        >
                          <Download className="w-3 h-3 text-emerald-400" />
                          <span>Audio</span>
                        </a>

                        {/* Export Dubbed Video */}
                        <button
                          onClick={() => handleExportDubbedVideo(dub.id)}
                          disabled={isExporting}
                          className="px-2.5 py-1 text-xs rounded-lg font-medium bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center space-x-1 transition-colors"
                          title="Export a new MP4 video with dubbed audio replacing original audio"
                        >
                          {isExporting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Film className="w-3 h-3" />
                          )}
                          <span>Export Video</span>
                        </button>

                        {/* Download Exported Video if ready */}
                        {dub.has_exported_video && (
                          <a
                            href={dubbingApi.getVideoDownloadUrl(dub.id)}
                            download
                            className="px-2.5 py-1 text-xs rounded-lg font-medium bg-cyan-600/90 hover:bg-cyan-500 text-white flex items-center space-x-1"
                            title="Download the exported dubbed MP4 video"
                          >
                            <Download className="w-3 h-3" />
                            <span>Video</span>
                          </a>
                        )}

                        {/* Delete Track */}
                        <button
                          onClick={() => handleDeleteDubbedTrack(dub.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete dubbed track"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Subtitle Track Tabs */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Available Subtitle Tracks ({tracks.length})
            </h4>

            {tracks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No captions generated yet. Click "Transcribe Original Audio" above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tracks.map((t) => {
                  const isActive = activeTrackId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center space-x-2 pl-3 pr-2 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${isActive
                          ? 'bg-brand-600/30 border-brand-500 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      onClick={() => setActiveTrackId(t.id)}
                    >
                      <span className="flex items-center space-x-1.5">
                        <Subtitles className={`w-3.5 h-3.5 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                        <span>{t.language_name}</span>
                        {t.is_original && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-brand-500/20 text-brand-300 rounded font-semibold">
                            Orig
                          </span>
                        )}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTrack(t.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        title="Delete this track"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Interactive Caption Editor (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          <CaptionEditor
            track={activeTrackData}
            onCuesUpdated={(updatedTrack) => {
              setActiveTrackData(updatedTrack);
            }}
            onSeek={handleSeekPlayer}
            getCurrentVideoTime={getCurrentVideoTime}
          />
        </div>

      </div>

      {/* Language Selector Modal for Multi-Translate */}
      <LanguageSelector
        isOpen={isTranslateModalOpen}
        onClose={() => setIsTranslateModalOpen(false)}
        videoId={video.id}
        sourceTrackId={activeTrackId || (tracks[0]?.id)}
        onTranslationComplete={(newTracks) => {
          setSuccessMsg('Multi-language translation complete!');
          captionApi.getTracks(videoId).then((res) => setTracks(res.data));
        }}
      />

    </div>
  );
};
