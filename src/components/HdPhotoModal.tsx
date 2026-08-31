import React, { useState } from 'react';

interface HdPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  userName: string;
  userRole?: string;
  userDepartment?: string;
}

export const HdPhotoModal: React.FC<HdPhotoModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  userName,
  userRole,
  userDepartment
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    const cleanName = userName.toLowerCase().replace(/\s+/g, '_');
    link.download = `foto_hd_${cleanName || 'profile'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn select-none">
      {/* Container Modal */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-sm font-bold shadow-xs">
              <i className="fa-solid fa-gem"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">{userName}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  HD Ultra-Clear
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {userRole} {userDepartment ? `• ${userDepartment}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            aria-label="Tutup Preview HD"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Stage / Image Viewer */}
        <div className="relative flex-1 overflow-hidden p-6 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950 to-slate-950 min-h-[340px]">
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          {/* HD Image Canvas Container */}
          <div
            className="relative transition-transform duration-200 ease-out max-w-full max-h-[60vh] flex items-center justify-center"
            style={{
              transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
            }}
          >
            <img
              src={imageUrl}
              alt={userName}
              className="max-h-[50vh] max-w-full object-contain rounded-2xl shadow-2xl ring-4 ring-white/10"
            />
          </div>

          {/* Quick Watermark / Badge */}
          <div className="absolute bottom-3 left-4 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/60 text-[10.5px] font-mono text-slate-300 backdrop-blur-xs flex items-center gap-1.5 shadow-sm pointer-events-none">
            <i className="fa-solid fa-award text-amber-400 text-[10px]"></i>
            <span>PT Ajinomoto Indonesia • High-DPI Retina</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Perbesar (Zoom In)"
            >
              <i className="fa-solid fa-magnifying-glass-plus text-xs"></i>
              <span className="hidden sm:inline">Perbesar</span>
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Perkecil (Zoom Out)"
            >
              <i className="fa-solid fa-magnifying-glass-minus text-xs"></i>
              <span className="hidden sm:inline">Perkecil</span>
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
              title="Putar 90 Derajat"
            >
              <i className="fa-solid fa-rotate-right text-xs"></i>
              <span className="hidden sm:inline">Putar</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
              title="Reset Zoom & Rotasi"
            >
              <i className="fa-solid fa-arrows-rotate text-xs"></i>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 font-semibold px-2">
              Zoom: {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleDownload}
              className="h-8 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Unduh File Gambar HD Asli"
            >
              <i className="fa-solid fa-download text-xs"></i>
              <span>Unduh HD</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
