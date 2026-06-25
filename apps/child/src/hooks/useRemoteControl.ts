import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { RemoteCommand } from '@shared/types';

export const useRemoteControl = (masterUrl: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lastCommand, setLastCommand] = useState<RemoteCommand | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaired, setIsPaired] = useState(localStorage.getItem('isPaired') === 'true');

  useEffect(() => {
    if (!masterUrl) {
        setIsConnected(false);
        return;
    };

    const newSocket = io(masterUrl, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Master OS');
      // If we are not paired, we should request pairing immediately
      if (!isPaired) {
          const deviceName = localStorage.getItem('deviceName') || `DEVICE_${newSocket.id.substring(0, 4)}`;
          newSocket.emit('REQUEST_PAIRING', { name: deviceName });
      }
    });

    newSocket.on('PAIRING_RESULT', (data: { success: boolean }) => {
        if (data.success) {
            setIsPaired(true);
            localStorage.setItem('isPaired', 'true');
        } else {
            setIsPaired(false);
            localStorage.removeItem('isPaired');
        }
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
      if (socket && isPaired) {
          socket.emit(event, data);
      }
  };

  return { isConnected, isPaired, lastCommand, socket, emit };
};
