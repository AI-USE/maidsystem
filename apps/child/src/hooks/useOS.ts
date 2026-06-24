import { createContext, useContext } from 'react';

export interface OSContextType {
  log: (message: string) => void;
  playAudio: (id: string, options?: { loop?: boolean; volume?: number }) => void;
  stopAudio: (id: string) => void;
  closeApp: () => void;
  isConnected: boolean;
  activeAppId: string | null;
}

export const OSContext = createContext<OSContextType | null>(null);

export const useOS = () => {
  const context = useContext(OSContext);
  if (!context) {
    throw new Error('useOS must be used within an OSProvider');
  }
  return context;
};
