import React from 'react';

export type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'success' | 'logout';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  singleAction?: boolean;
  variant?: ConfirmationVariant;
  icon?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDarkMode?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  singleAction = false,
  variant = 'warning',
  icon,
  isLoading = false,
  onConfirm,
  onCancel,
  isDarkMode = false
}) => {
  if (!isOpen) return null;

  // Variant styling helpers
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
          defaultIcon: 'fa-solid fa-triangle-exclamation',
          confirmBtn: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-500/20',
          badgeText: 'Tindakan Penting',
          badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
        };
      case 'logout':
        return {
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
          defaultIcon: 'fa-solid fa-arrow-right-from-bracket',
          confirmBtn: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-amber-500/20',
          badgeText: 'Konfirmasi Keluar',
          badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        };
      case 'success':
        return {
          iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
          defaultIcon: 'fa-solid fa-circle-check',
          confirmBtn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20',
          badgeText: 'Pembaruan Berhasil',
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        };
      case 'info':
        return {
          iconBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30',
          defaultIcon: 'fa-solid fa-circle-info',
          confirmBtn: 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-indigo-500/20',
          badgeText: 'Informasi',
          badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
        };
      case 'warning':
      default:
        return {
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
          defaultIcon: 'fa-solid fa-shield-halved',
          confirmBtn: 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-slate-950 font-bold shadow-amber-500/20',
          badgeText: 'Perhatian & Konfirmasi',
          badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
        };
    }
  };

  const style = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto p-4 sm:p-6 flex items-center justify-center animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop with strong blur */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity"
        onClick={!isLoading ? onCancel : undefined}
      />

      {/* Dialog Card */}
      <div
        className={`relative w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all duration-200 transform scale-100 ${
          isDarkMode
            ? 'bg-[#0A192F] border-white/15 text-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.8)]'
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Decorative Top Accent Light */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1.5 rounded-full ${
            variant === 'danger'
              ? 'bg-rose-500'
              : variant === 'logout'
              ? 'bg-amber-500'
              : variant === 'success'
              ? 'bg-emerald-500'
              : 'bg-cyan-500'
          }`}
        />

        <div className="flex items-start gap-4 mb-5 pt-1">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${style.iconBg}`}
          >
            <i className={icon || style.defaultIcon}></i>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.badgeClass}`}
              >
                {style.badgeText}
              </span>
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h3>
          </div>

          {!isLoading && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer shrink-0"
              aria-label="Tutup"
            >
              <i className="fa-solid fa-xmark text-base"></i>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div
          className={`text-xs sm:text-sm leading-relaxed mb-6 font-normal ${
            isDarkMode ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          {typeof description === 'string' ? (
            <p className="whitespace-pre-line">{description}</p>
          ) : (
            description
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
          {!singleAction && (
            <button
              type="button"
              disabled={isLoading}
              onClick={onCancel}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              {cancelLabel}
            </button>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg transition-all transform active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-2 ${style.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>{confirmLabel}</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
