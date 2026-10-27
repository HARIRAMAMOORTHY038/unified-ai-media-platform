import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { VideoDetailPage } from './pages/VideoDetailPage';
import { Navbar } from './components/Navbar';
import { UploadModal } from './components/UploadModal';
import { Loader2 } from 'lucide-react';

const MainLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col justify-between">
      <div>
        <Navbar
          onOpenUpload={() => setIsUploadOpen(true)}
          onNavigateHome={() => setSelectedVideoId(null)}
          currentView={selectedVideoId ? 'studio' : 'dashboard'}
        />

        <main className="pb-16">
          {selectedVideoId ? (
            <VideoDetailPage
              videoId={selectedVideoId}
              onBack={() => setSelectedVideoId(null)}
            />
          ) : (
            <DashboardPage
              onSelectVideo={(id) => setSelectedVideoId(id)}
              onOpenUpload={() => setIsUploadOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={(uploadedVideo) => {
          setIsUploadOpen(false);
          setSelectedVideoId(uploadedVideo.id);
        }}
      />

      {/* College Project Footer */}
      <footer className="border-t border-slate-900 bg-[#070b11] py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Unified AI Platform for Captioning, Translation and Digital Media Management</p>
          <p className="text-[11px] text-slate-600">S5 Mini Project • React + FastAPI + Whisper + FFmpeg</p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
