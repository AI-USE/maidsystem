import React, { useEffect, useRef } from 'react';

interface HiddenCameraProps {
  active: boolean;
  fps: number;
  onFrame: (frame: string) => void;
}

export const HiddenCamera: React.FC<HiddenCameraProps> = ({ active, fps, onFrame }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (active) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [active]);

  useEffect(() => {
    let interval: any;
    if (active) {
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
  }, [active, fps, onFrame]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 320,
          height: 240,
          frameRate: { ideal: fps },
          facingMode: "user"
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("HiddenCamera error:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  return (
    <div className="hidden">
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={canvasRef} />
    </div>
  );
};
