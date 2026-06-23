import React from 'react';
import { Camera } from 'lucide-react';

const CameraMonitor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="relative flex flex-col h-full bg-black">
      <div className="flex-1 flex items-center justify-center border border-[#00ff41]/20 m-4 relative">
        <Camera size={48} className="text-[#00ff41]/30" />
      </div>
    </div>
  );
};

export const CameraPlugin = {
  id: 'camera',
  title: 'EYE_OF_MAD',
  icon: <Camera size={18} />,
  component: CameraMonitor,
};
