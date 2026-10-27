import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { mediaApi, dubbingApi } from '../services/api';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  RotateCw,
  Subtitles,
  Gauge,
  Headphones,
  Check,
  Download
} from 'lucide-react';

export const VideoPlayer = forwardRef((
  {
    video,
    tracks,
    activeTrackId,
    onTrackChange,
    dubbedTracks = [],
    activeDubbedTrackId = null,
    onDubbedTrackChange
  },
  ref
) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');

  // Active dubbed track details
  const activeDubbedTrack = dubbedTracks?.find((d) => d.id === activeDubbedTrackId);
  const dubbedAudioUrl = activeDubbedTrack ? dubbingApi.getAudioStreamUrl(activeDubbedTrack.id) : null;

  // Expose seekTo and getCurrentTime to parent
  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        if (audioRef.current && activeDubbedTrack) {
          audioRef.current.currentTime = seconds;
        }
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    },
    getCurrentTime: () => {
      return videoRef.current ? videoRef.current.currentTime : 0;
    }
  }));

  // Find active subtitle track
  const activeTrack = tracks?.find((t) => t.id === activeTrackId);

  // Synchronize subtitle display on time update
  useEffect(() => {
    if (!activeTrack || !activeTrack.cues || activeTrack.cues.length === 0) {
      setCurrentSubtitleText('');
      return;
    }

    const activeCue = activeTrack.cues.find(
      (cue) => currentTime >= cue.start_time && currentTime <= cue.end_time
    );

    setCurrentSubtitleText(activeCue ? activeCue.text : '');
  }, [currentTime, activeTrack]);

  // Handle dubbed audio mode changes (Mute video if dubbed audio is active)
  useEffect(() => {
    if (!videoRef.current) return;

    if (activeDubbedTrack) {
      // Mute original video audio so speech doesn't overlap
      videoRef.current.muted = true;
      if (audioRef.current) {
        audioRef.current.currentTime = videoRef.current.currentTime;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.playbackRate = playbackSpeed;
        if (isPlaying) {
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
    } else {
      // Restore video original audio state
      videoRef.current.muted = isMuted;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [activeDubbedTrackId, isPlaying]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const vTime = videoRef.current.currentTime;
      setCurrentTime(vTime);

      // Keep dubbed audio tightly synchronized with video timeline
      if (audioRef.current && activeDubbedTrack) {
        const drift = Math.abs(audioRef.current.currentTime - vTime);
        if (drift > 0.25) {
          audioRef.current.currentTime = vTime;
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || video.duration_seconds || 0);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      if (audioRef.current && activeDubbedTrack) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      if (audioRef.current && activeDubbedTrack) {
        audioRef.current.currentTime = videoRef.current.currentTime;
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
    if (audioRef.current && activeDubbedTrack) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const muted = val === 0;
    setIsMuted(muted);

    if (activeDubbedTrack && audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = muted;
    } else if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = muted;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (activeDubbedTrack && audioRef.current) {
      audioRef.current.muted = nextMuted;
    } else if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }

    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      if (activeDubbedTrack && audioRef.current) audioRef.current.volume = 0.5;
      if (videoRef.current) videoRef.current.volume = 0.5;
    }
  };

  const handleSpeedSelect = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    if (audioRef.current && activeDubbedTrack) {
      audioRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const skipTime = (amount) => {
    if (videoRef.current) {
      const nextTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));
      videoRef.current.currentTime = nextTime;
      if (audioRef.current && activeDubbedTrack) {
        audioRef.current.currentTime = nextTime;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const videoStreamUrl = mediaApi.getStreamUrl(video.id);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col justify-end group select-none"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={videoStreamUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.pause();
        }}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Hidden Dubbed Audio Element for Synchronized Timeline Playback */}
      {dubbedAudioUrl && (
        <audio
          ref={audioRef}
          src={dubbedAudioUrl}
          preload="auto"
          onEnded={() => {
            if (audioRef.current) audioRef.current.pause();
          }}
        />
      )}

      {/* Audio Mode Top Badge Indicator */}
      <div className="absolute top-3 left-3 flex items-center space-x-2 z-20 pointer-events-none">
        {activeDubbedTrack ? (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold backdrop-blur-md shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dubbed Audio: {activeDubbedTrack.language_name}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 text-[11px] font-medium backdrop-blur-md">
            <span>Audio: Original Video</span>
          </div>
        )}
      </div>

      {/* Synchronized Custom Subtitle Overlay */}
      {currentSubtitleText && (
        <div className="absolute bottom-16 inset-x-0 flex justify-center pointer-events-none px-6 z-20">
          <div className="bg-black/85 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center max-w-2xl shadow-2xl animate-in fade-in duration-100">
            <span className="text-white text-base md:text-lg font-semibold tracking-wide drop-shadow-md">
              {currentSubtitleText}
            </span>
          </div>
        </div>
      )}

      {/* Floating Center Play Button When Paused */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer z-10 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-brand-600/90 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 hover:scale-110 transition-transform">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Video Control Bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 md:p-4 z-30 transition-opacity opacity-90 group-hover:opacity-100">

        {/* Progress Seekbar */}
        <div className="flex items-center space-x-2 mb-2.5">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:h-2 transition-all"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white text-xs">

          {/* Left: Play/Pause, Rewind, Fast Forward, Time Display */}
          <div className="flex items-center space-x-3">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={() => skipTime(-5)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-300"
              title="Rewind 5s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => skipTime(5)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-300"
              title="Forward 5s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center space-x-1.5 group/vol">
              <button onClick={toggleMute} className="p-1 rounded-lg hover:bg-white/10 text-slate-300">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500 hidden sm:block"
              />
            </div>

            {/* Time Stamp */}
            <span className="font-mono text-[11px] text-slate-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right: Audio Selector, Subtitle Selector, Speed Menu, Fullscreen */}
          <div className="flex items-center space-x-2">

            {/* Audio Track Selector (Original vs Dubbed) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAudioMenu(!showAudioMenu);
                  setShowTrackMenu(false);
                  setShowSpeedMenu(false);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  activeDubbedTrack
                    ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Select Audio Track (Original / Dubbed)"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>
                  {activeDubbedTrack ? `Dubbed: ${activeDubbedTrack.language_name}` : 'Original Audio'}
                </span>
              </button>

              {showAudioMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex justify-between items-center">
                    <span>Audio Track</span>
                    <span className="text-[9px] text-slate-500">Timeline Synced</span>
                  </div>

                  {/* Original Audio Option */}
                  <button
                    onClick={() => {
                      if (onDubbedTrackChange) onDubbedTrackChange(null);
                      setShowAudioMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between ${
                      !activeDubbedTrackId ? 'text-brand-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span>Original Video Audio</span>
                    {!activeDubbedTrackId && <Check className="w-3.5 h-3.5 text-brand-400" />}
                  </button>

                  {/* Available Dubbed Audio Tracks */}
                  {dubbedTracks?.length > 0 && (
                    <div className="border-t border-slate-800 mt-1 pt-1">
                      <div className="px-3 py-1 text-[10px] font-medium text-emerald-400">
                        Synthesized Dubbed Tracks
                      </div>
                      {dubbedTracks.map((dub) => (
                        <div
                          key={dub.id}
                          className={`w-full px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center justify-between group ${
                            activeDubbedTrackId === dub.id ? 'text-emerald-400 font-semibold bg-emerald-500/10' : 'text-slate-300'
                          }`}
                        >
                          <button
                            onClick={() => {
                              if (onDubbedTrackChange) onDubbedTrackChange(dub.id);
                              setShowAudioMenu(false);
                            }}
                            className="flex-1 text-left truncate mr-2"
                          >
                            <span>Dubbed {dub.language_name}</span>
                          </button>

                          <div className="flex items-center space-x-1">
                            <a
                              href={dubbingApi.getAudioDownloadUrl(dub.id)}
                              download
                              title="Download Dubbed Audio"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 hover:text-white text-slate-500 rounded"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                            {activeDubbedTrackId === dub.id && (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {dubbedTracks?.length === 0 && (
                    <div className="px-3 py-2 text-[11px] text-slate-500 italic border-t border-slate-800">
                      No dubbed tracks generated yet. Click "Generate Dubbed Audio" in the studio.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subtitle Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowTrackMenu(!showTrackMenu);
                  setShowAudioMenu(false);
                  setShowSpeedMenu(false);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  activeTrackId
                    ? 'bg-brand-600/30 text-brand-300 border-brand-500/40'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Select Subtitle Track"
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>
                  {activeTrack ? `${activeTrack.language_name} ${activeTrack.is_original ? '(Orig)' : ''}` : 'CC Off'}
                </span>
              </button>

              {showTrackMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Subtitle Tracks
                  </div>
                  <button
                    onClick={() => {
                      onTrackChange(null);
                      setShowTrackMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center justify-between ${
                      !activeTrackId ? 'text-brand-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span>Subtitles Off</span>
                    {!activeTrackId && <span>✓</span>}
                  </button>
                  {tracks?.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onTrackChange(t.id);
                        setShowTrackMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center justify-between ${
                        activeTrackId === t.id ? 'text-brand-400 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate">
                        {t.language_name} {t.is_original ? '(Original)' : ''}
                      </span>
                      {activeTrackId === t.id && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Playback Speed */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowTrackMenu(false);
                  setShowAudioMenu(false);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 flex items-center space-x-1"
                title="Playback Speed"
              >
                <Gauge className="w-4 h-4" />
                <span className="text-[11px] font-mono">{playbackSpeed}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-24 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedSelect(spd)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 font-mono ${
                        playbackSpeed === spd ? 'text-brand-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>

          </div>

        </div>

      </div>
    </div>
  );
});
