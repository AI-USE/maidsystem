import React from 'react';

export interface AppWindow {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
}

export interface OSPlugin {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ComponentType<{ onClose: () => void }>;
}

export interface RemoteCommand {
  type: 'SHAKE_SCREEN' | 'LAUNCH_APP' | 'INJECT_TEXT' | 'CLOSE_APP' | 'START_CAMERA' | 'STOP_CAMERA' | 'NOTIFICATION';
  payload?: any;
}

export const EXIT_PASSWORD = 'MADREST104';
export const DEFAULT_PORT = 3030;
export const UDP_PORT = 3031;
