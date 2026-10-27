import React, { useState, useEffect } from 'react';
import { translationApi } from '../services/api';
import { X, Globe, Check, Loader2, AlertCircle } from 'lucide-react';

export const LanguageSelector = ({ isOpen, onClose, videoId, sourceTrackId, onTranslationComplete }) => {
  const [languages, setLanguages] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState(['es']);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchLanguages();
    }
  }, [isOpen]);

  const fetchLanguages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await translationApi.getLanguages();
      setLanguages(res.data);
    } catch {
      // Fallback languages list if backend unreachable
      setLanguages([
        { code: 'es', name: 'Spanish', native: 'Español' },
        { code: 'fr', name: 'French', native: 'Français' },
        { code: 'de', name: 'German', native: 'Deutsch' },
        { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
        { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
        { code: 'te', name: 'Telugu', native: 'తెలుగు' },
        { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
        { code: 'zh-CN', name: 'Chinese', native: '中文' },
        { code: 'ja', name: 'Japanese', native: '日本語' },
        { code: 'ar', name: 'Arabic', native: 'العربية' },
        { code: 'ru', name: 'Russian', native: 'Русский' },
        { code: 'pt', name: 'Portuguese', native: 'Português' },
        { code: 'it', name: 'Italian', native: 'Italiano' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = (code) => {
    if (selectedCodes.includes(code)) {
      setSelectedCodes(selectedCodes.filter((c) => c !== code));
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  const handleTranslate = async () => {
    if (selectedCodes.length === 0) {
      setError('Please select at least one target language');
      return;
    }

    setTranslating(true);
    setError(null);
    try {
      const res = await translationApi.translate(videoId, sourceTrackId, selectedCodes);
      if (onTranslationComplete) {
        onTranslationComplete(res.data);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Translate Subtitles</h3>
              <p className="text-xs text-slate-400">Preserves exact timestamps and cue sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={translating}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              <span>Loading supported languages...</span>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-300">Choose Target Languages</span>
                <span className="text-[11px] text-slate-500">{selectedCodes.length} selected</span>
              </div>

              {/* Language Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {languages.map((lang) => {
                  const isSelected = selectedCodes.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleLanguage(lang.code)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-brand-600/20 border-brand-500 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium">{lang.name}</p>
                        <p className="text-[10px] text-slate-500">{lang.native}</p>
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={translating}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTranslate}
              disabled={translating || selectedCodes.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
            >
              {translating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Translating Cues...</span>
                </>
              ) : (
                <span>Translate ({selectedCodes.length})</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
