import React, { useState, useEffect, useRef } from 'react';
import { Camera, ZapOff } from 'lucide-react';
import { useOS } from '../hooks/useOS';

interface CameraProps {
  onClose: () => void;
  fps?: number;
  isActive?: boolean;
  onFrame?: (frame: string) => void;
}

const CameraMonitor: React.FC<CameraProps> = ({ onClose, fps = 10, isActive = false, onFrame }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isActive, fps]);

  useEffect(() => {
    let interval: any;
    if (isActive && stream && onFrame) {
        interval = setInterval(() => {
            if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                canvas.width = 320;
                canvas.height = 240;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const data = canvas.toDataURL('image/jpeg', 0.5);
                    onFrame(data);
                }
            }
        }, 1000 / fps);
    }
    return () => clearInterval(interval);
  }, [isActive, stream, fps, onFrame]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { frameRate: { ideal: fps } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-black/40">
      <canvas ref={canvasRef} className="hidden" />
      {!isActive ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/10 uppercase tracking-[0.2em]">
            <ZapOff size={48} />
            <span className="text-xs font-bold">信号暗号化済み / カメラオフ</span>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover opacity-60 grayscale brightness-75 contrast-125"
          />
          <div className="absolute inset-0 pointer-events-none border-[20px] border-black/20" />
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/80">Rec :: {fps} FPS</span>
          </div>
          <div className="absolute bottom-6 left-6 text-[10px] font-mono text-white/40 uppercase">
             Live_Feed_Alpha_Sector
          </div>
        </div>
      )}
    </div>
  );
};

export const CameraPlugin = {
  id: 'camera',
  title: 'SIGHT_FEED',
  icon: <Camera size={18} />,
  component: CameraMonitor,
};
