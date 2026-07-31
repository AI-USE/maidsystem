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
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const canvas = canvasRef.current;
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const data = canvas.toDataURL('image/jpeg', 0.5);
              onFrame(data);
            }
          }
        }
      }, 1000 / fps);
    }
    return () => clearInterval(interval);
  }, [active, fps, onFrame]);

  const startCamera = async () => {
    try {
      // First try capturing with ideal constraints and front-facing camera
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
        videoRef.current.play().catch(e => console.warn("Hidden video play error:", e));
      }
    } catch (err) {
      console.warn("HiddenCamera user facing camera attempt failed, trying fallback:", err);
      try {
        // Fallback to any available video camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn("Hidden video fallback play error:", e));
        }
      } catch (err2) {
        console.error("All camera capture attempts failed:", err2);
      }
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
