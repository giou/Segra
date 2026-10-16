import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Content } from '../Models/types';

interface SelectedVideoContextProps {
  selectedVideo: Content | null;
  setSelectedVideo: (video: Content | null) => void;
  lastPlayedVideo: Content | null;
  clearLastPlayedVideo: () => void;
}

const SelectedVideoContext = createContext<SelectedVideoContextProps | undefined>(undefined);

export const SelectedVideoProvider = ({ children }: { children: ReactNode }) => {
  const [selectedVideo, setSelectedVideoState] = useState<Content | null>(null);
  const [lastPlayedVideo, setLastPlayedVideo] = useState<Content | null>(null);

  const setSelectedVideo = useCallback((video: Content | null) => {
    if (video) {
      setLastPlayedVideo(video);
    }
    setSelectedVideoState(video);
  }, []);

  const clearLastPlayedVideo = useCallback(() => {
    setLastPlayedVideo(null);
  }, []);

  return (
    <SelectedVideoContext.Provider
      value={{ selectedVideo, setSelectedVideo, lastPlayedVideo, clearLastPlayedVideo }}
    >
      {children}
    </SelectedVideoContext.Provider>
  );
};

export const useSelectedVideo = () => {
  const context = useContext(SelectedVideoContext);
  if (!context) {
    throw new Error('useSelectedVideo must be used within a SelectedVideoProvider');
  }
  return context;
};
