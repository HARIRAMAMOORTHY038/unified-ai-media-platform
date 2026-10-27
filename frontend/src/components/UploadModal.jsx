import React, { useState, useRef } from 'react';
import { mediaApi } from '../services/api';
import { X, UploadCloud, FileVideo, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [successVideo, setSuccessVideo] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setUploading(false);
    setProgress(0);
    setError(null);
    setSuccessVideo(null);
  };

  const handleClose = () => {
    if (uploading) return;
    resetState();
    onClose();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    const validExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.mp3', '.wav', '.m4a'];
    const fileName = selectedFile.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidExt) {
      setError(`Unsupported format. Please select a valid video/audio file (${validExtensions.join(', ')})`);
      return;
    }

    if (selectedFile.size > 250 * 1024 * 1024) {
      setError('File size exceeds the 250MB limit.');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await mediaApi.uploadVideo(formData, (percent) => {
        setProgress(percent);
      });
      setSuccessVideo(response.data);
      onUploadSuccess(response.data);
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Upload failed';
      setError(errMsg);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Upload Media for AI Processing</h3>
            <p className="text-xs text-slate-400">MP4, MKV, WebM, MOV or Audio (Up to 250MB)</p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successVideo ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-white">Media Uploaded Successfully!</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Audio has been extracted using FFmpeg. Your media is ready for Faster-Whisper captioning.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-colors"
                >
                  View in Studio
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40'
                } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="p-3 bg-brand-500/10 rounded-2xl text-brand-400 border border-brand-500/20">
                      <FileVideo className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-white max-w-xs truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <span className="text-[11px] text-brand-400 hover:underline">Click or drop another file to change</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3.5 bg-slate-900 rounded-2xl text-slate-400 border border-slate-800">
                      <UploadCloud className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Drag and drop your video here, or <span className="text-brand-400 font-semibold">browse</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Supports MP4, MKV, WebM, MOV, WAV, MP3</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {uploading && (
                <div className="space-y-2 py-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                      <span>{progress < 100 ? 'Uploading media...' : 'Extracting audio with FFmpeg...'}</span>
                    </span>
                    <span className="font-semibold text-brand-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-brand-600 to-accent-cyan h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Upload & Process</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
