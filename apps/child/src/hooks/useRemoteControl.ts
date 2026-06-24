import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { RemoteCommand } from '@shared/types';

export const useRemoteControl = (masterUrl: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lastCommand, setLastCommand] = useState<RemoteCommand | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!masterUrl) return;

    const newSocket = io(masterUrl, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Master OS');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from Master OS');
    });

    newSocket.on('ADMIN_REMOTE_CTRL', (command: RemoteCommand) => {
      setLastCommand(command);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [masterUrl]);

  const emit = (event: string, data: any) => {
      if (socket) {
          socket.emit(event, data);
      }
  };

  return { isConnected, lastCommand, socket, emit };
};
