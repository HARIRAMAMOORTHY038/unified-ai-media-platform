import React, { useState, useEffect, useCallback } from 'react';
import { mediaApi } from '../services/api';
import { StatsCard } from '../components/StatsCard';
import { MediaCard } from '../components/MediaCard';
import {
  Video,
  Subtitles,
  Globe,
  HardDrive,
  Search,
  Filter,
  UploadCloud,
  Loader2,
  Sparkles,
  Layers,
  Languages,
  Clock,
  X,
  AlertCircle,
} from 'lucide-react';

// Safely convert API errors and validation objects into readable text.
const toDisplayMessage = (
  value,
  fallback = 'An unexpected error occurred.'
) => {
  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => {
        if (typeof item === 'string') return item;

        if (item && typeof item === 'object') {
          if (typeof item.msg === 'string') return item.msg;
          if (typeof item.message === 'string') return item.message;

          try {
            return JSON.stringify(item);
          } catch {
            return '';
          }
        }

        return '';
      })
      .filter(Boolean);

    return messages.length ? messages.join('; ') : fallback;
  }

  if (value && typeof value === 'object') {
    if (typeof value.detail === 'string') {
      return value.detail;
    }

    if (value.detail !== undefined) {
      return toDisplayMessage(value.detail, fallback);
    }

    if (typeof value.msg === 'string') return value.msg;
    if (typeof value.message === 'string') return value.message;

    try {
      const serialized = JSON.stringify(value);
      return serialized && serialized !== '{}' ? serialized : fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const getApiErrorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;

  if (detail !== undefined && detail !== null) {
    return toDisplayMessage(detail, fallback);
  }

  const data = err?.response?.data;

  if (data !== undefined && data !== null) {
    return toDisplayMessage(data, fallback);
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }

  return fallback;
};

export const DashboardPage = ({ onSelectVideo, onOpenUpload }) => {
  // Media library state
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [error, setError] = useState(null);

  // Semantic search state
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState('');
  const [semanticSearched, setSemanticSearched] = useState(false);

  // Fetch the user's media library.
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await mediaApi.listVideos({
        search,
        sort_by: sortBy,
      });

      const data = res.data;
      let videoList = [];

      if (Array.isArray(data)) {
        videoList = data;
      } else if (data && Array.isArray(data.items)) {
        videoList = data.items;
      } else if (data && Array.isArray(data.videos)) {
        videoList = data.videos;
      }

      setVideos(videoList);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Failed to fetch media library.')
      );
    } finally {
      setLoading(false);
    }
  }, [search, sortBy]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Perform multilingual semantic search.
  const handleSemanticSearch = async (event) => {
    if (event) {
      event.preventDefault();
    }

    const query = semanticQuery.trim();

    if (!query) {
      setSemanticError('Enter a word or sentence to search.');
      setSemanticResults([]);
      setSemanticSearched(false);
      return;
    }

    setSemanticLoading(true);
    setSemanticError('');
    setSemanticSearched(true);
    setSemanticResults([]);

    try {
      const response = await mediaApi.semanticSearch(query, 20);
      const data = response.data;

      const results = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];

      setSemanticResults(results);
    } catch (err) {
      setSemanticError(
        getApiErrorMessage(
          err,
          'Semantic search failed. Check that the backend is running.'
        )
      );
    } finally {
      setSemanticLoading(false);
    }
  };

  // Clear semantic search.
  const clearSemanticSearch = () => {
    setSemanticQuery('');
    setSemanticResults([]);
    setSemanticError('');
    setSemanticSearched(false);
  };

  // Delete a video.
  const handleDeleteVideo = async (id) => {
    try {
      await mediaApi.deleteVideo(id);

      setVideos((currentVideos) =>
        currentVideos.filter(
          (video) => String(video.id) !== String(id)
        )
      );

      setSemanticResults((currentResults) =>
        currentResults.filter(
          (result) =>
            String(result.video_id ?? result.video?.id) !== String(id)
        )
      );
    } catch (err) {
      window.alert(
        getApiErrorMessage(err, 'Failed to delete video.')
      );
    }
  };

  // Open the video associated with a semantic-search result.
  const handleOpenSearchResult = (result) => {
    const videoId = result.video_id ?? result.video?.id;

    if (videoId == null) {
      setSemanticError('This search result has no video ID.');
      return;
    }

    const video =
      result.video ||
      videos.find(
        (item) => String(item.id) === String(videoId)
      );

    if (!video) {
      setSemanticError(
        'The video details are unavailable. Refresh the media library and try again.'
      );
      return;
    }

    if (typeof onSelectVideo === 'function') {
      onSelectVideo(videoId);
    } else {
      setSemanticError('The video-opening action is unavailable.');
    }
  };

  // Format seconds as minutes:seconds.
  const formatTimestamp = (seconds) => {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const remainingSeconds = Math.floor(value % 60);

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  // Semantic scores are similarity values, not probabilities.
  const formatScore = (score) => {
    const value = Number(score);

    if (!Number.isFinite(value)) {
      return '—';
    }

    return value.toFixed(3);
  };

  // Dashboard metrics.
  const totalVideos = videos.length;

  const totalTracks = videos.reduce(
    (total, video) =>
      total + (Number(video.caption_tracks_count) || 0),
    0
  );

  const totalSizeBytes = videos.reduce(
    (total, video) =>
      total + (Number(video.file_size_bytes) || 0),
    0
  );

  const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              PROJECT DASHBOARD
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Digital Media &amp; AI Captioning Hub
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Upload videos, generate timestamped captions, translate subtitles,
            and discover video moments with multilingual AI semantic search.
          </p>
        </div>

        <div className="relative z-10 flex items-center space-x-3">
          <button
            type="button"
            onClick={onOpenUpload}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all glow-btn"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New Media</span>
          </button>
        </div>
      </div>

      {/* Dashboard metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Media"
          value={totalVideos}
          subtitle="Indexed in SQLite"
          icon={Video}
          colorClass="from-brand-500 to-indigo-600"
        />

        <StatsCard
          title="Caption Tracks"
          value={totalTracks}
          subtitle="Original & Translated"
          icon={Subtitles}
          colorClass="from-cyan-500 to-blue-600"
        />

        <StatsCard
          title="Languages"
          value="19+"
          subtitle="Multi-language Engine"
          icon={Globe}
          colorClass="from-emerald-500 to-teal-600"
        />

        <StatsCard
          title="Storage Used"
          value={`${totalSizeMb} MB`}
          subtitle="Local Video & Audio"
          icon={HardDrive}
          colorClass="from-purple-500 to-pink-600"
        />
      </div>

      {/* AI Semantic Search */}
      <section className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-5 sm:p-7 space-y-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              AI Semantic Search
            </h3>

            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Search by meaning across caption languages. Try English or Tamil.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSemanticSearch}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

            <input
              type="text"
              value={semanticQuery}
              onChange={(event) => setSemanticQuery(event.target.value)}
              placeholder="Try: vegetables, superhero, காய்கறிகள்..."
              aria-label="Search video captions by meaning"
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />

            {semanticQuery && (
              <button
                type="button"
                onClick={clearSemanticSearch}
                aria-label="Clear semantic search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={semanticLoading}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {semanticLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Search Captions
              </>
            )}
          </button>
        </form>

        {/* Example queries */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <Languages className="w-3.5 h-3.5" />
          <span>Example searches:</span>

          {['vegetables', 'superhero', 'காய்கறிகள்'].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setSemanticQuery(example);
                setSemanticError('');
              }}
              className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-950/60 hover:border-indigo-500/60 hover:text-indigo-300 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Semantic-search error */}
        {semanticError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{semanticError}</span>
          </div>
        )}

        {/* Semantic-search loading */}
        {semanticLoading && (
          <div className="py-8 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            <p className="text-sm">
              Finding matching video captions...
            </p>
          </div>
        )}

        {/* Semantic-search results */}
        {!semanticLoading && semanticSearched && !semanticError && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-white">
                Search Results
              </h4>

              <span className="text-xs text-slate-400">
                {semanticResults.length}{' '}
                {semanticResults.length === 1 ? 'match' : 'matches'}
              </span>
            </div>

            {semanticResults.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6 text-center">
                <Search className="w-7 h-7 mx-auto text-slate-600 mb-2" />

                <p className="text-sm font-medium text-slate-300">
                  No matching captions found
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  Try different words, a complete sentence, or another language.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {semanticResults.map((rawResult, index) => {
                  // Validate result objects before using their properties.
                  const result =
                    rawResult && typeof rawResult === 'object'
                      ? rawResult
                      : {};

                  const resultVideo =
                    result.video && typeof result.video === 'object'
                      ? result.video
                      : null;

                  const videoId = result.video_id ?? resultVideo?.id;

                  const videoTitle =
                    (typeof resultVideo?.title === 'string'
                      ? resultVideo.title
                      : '') ||
                    (typeof resultVideo?.original_filename === 'string'
                      ? resultVideo.original_filename
                      : '') ||
                    `Video ${videoId ?? ''}`;

                  const language =
                    (typeof result.language_name === 'string' &&
                      result.language_name) ||
                    (typeof result.language === 'string' &&
                      result.language) ||
                    'Unknown language';

                  // Support common backend timestamp field names.
                  const start =
                    Number(
                      result.timestamp_seconds ??
                      result.start_time ??
                      result.start_seconds ??
                      result.start
                    ) || 0;

                  const end = Number(
                    result.end_seconds ??
                    result.end_time ??
                    result.end
                  );

                  const snippet =
                    typeof result.snippet === 'string'
                      ? result.snippet
                      : typeof result.text === 'string'
                        ? result.text
                        : typeof result.caption_text === 'string'
                          ? result.caption_text
                          : 'No caption text available.';

                  return (
                    <button
                      key={`${videoId ?? 'video'}-${language}-${start}-${index}`}
                      type="button"
                      onClick={() => handleOpenSearchResult(result)}
                      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 hover:border-indigo-500/40 p-4 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="shrink-0 w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                            <Video className="w-4 h-4 text-indigo-400" />
                          </div>

                          <div className="min-w-0">
                            <h5 className="text-sm font-semibold text-white truncate">
                              {videoTitle}
                            </h5>

                            <p className="text-[11px] text-slate-500 mt-1 truncate">
                              {typeof resultVideo?.original_filename ===
                                'string'
                                ? resultVideo.original_filename
                                : ''}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {formatScore(result.score)} similarity
                        </span>
                      </div>

                      <p className="text-sm text-slate-200 leading-relaxed mt-4">
                        {snippet}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300">
                          <Languages className="w-3.5 h-3.5 text-cyan-400" />
                          {language}
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          {formatTimestamp(start)}
                          {Number.isFinite(end) && end > start
                            ? ` – ${formatTimestamp(end)}`
                            : ''}
                        </span>

                        <span className="ml-auto text-xs text-indigo-300">
                          Open video →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Media library filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-indigo-400" />

          <h3 className="text-base font-bold text-white">
            Media Library
          </h3>

          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            {videos.length}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />

            <input
              type="text"
              placeholder="Search by title..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Filter media library by title"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500" />

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort media library"
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-slate-900">
                Newest
              </option>
              <option value="oldest" className="bg-slate-900">
                Oldest
              </option>
              <option value="title" className="bg-slate-900">
                Title A-Z
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Media library content */}
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center"
        >
          <p className="text-sm text-red-300">{error}</p>

          <button
            type="button"
            onClick={fetchVideos}
            className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-white"
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />

          <p className="text-xs text-slate-400">
            Loading your media library...
          </p>
        </div>
      ) : videos.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-4 max-w-lg mx-auto my-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Video className="w-8 h-8" />
          </div>

          <div>
            <h4 className="font-bold text-white text-base">
              No media files found
            </h4>

            <p className="text-xs text-slate-400 mt-1">
              {search
                ? 'No videos matched your title search.'
                : 'Upload your first video to start transcription and subtitle translation.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenUpload}
            className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            Upload Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video) => (
            <MediaCard
              key={video.id}
              video={video}
              onSelect={onSelectVideo}
              onDelete={handleDeleteVideo}
            />
          ))}
        </div>
      )}
    </div>
  );
};
