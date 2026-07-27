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
  component: React.ComponentType<any>;
}

export type CommandType =
  | 'SHAKE_SCREEN'
  | 'LAUNCH_APP'
  | 'CLOSE_APP'
  | 'SET_CAMERA'
  | 'SET_FREEZE'
  | 'SHOW_ERROR'
  | 'INJECT_LOG'
  | 'PUZZLE_START'
  | 'PUZZLE_STOP'
  | 'PUZZLE_RESTART'
  | 'PUZZLE_BROADCAST_VIDEO'
  | 'PUZZLE_RETIRE'
  | 'PUZZLE_CANCEL_RETIRE'
  | 'PUZZLE_PAUSE'
  | 'PUZZLE_RESUME';

export interface RemoteCommand {
  type: CommandType;
  payload?: any;
}

export const EXIT_PASSWORD = 'MADREST104';
export const DEFAULT_PORT = 3030;
export const UDP_PORT = 3031;
