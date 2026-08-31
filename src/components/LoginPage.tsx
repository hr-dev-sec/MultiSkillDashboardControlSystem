import React, { useState } from 'react';
import { AJINOMOTO_LOGO_URL, checkLoginAsync } from '../utils/storage';
import { UserSession } from '../types';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  onBackToLanding: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onBackToLanding,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);

  const roleInfo = {
    roleName: 'HR Development Administrator',
    badge: 'Akses Utama',
    color: 'amber',
    icon: 'fa-user-shield',
    desc: 'Pengelolaan terpusat pemantauan kompetensi Multi-Skill: Konfigurasi matriks 92 standar keahlian, pengelolaan data karyawan, sinkronisasi data cloud, dan pengesahan laporan resmi.'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await checkLoginAsync(username.trim(), password);
      setLoading(false);

      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setErrorMsg(res.message || 'Username atau kata sandi belum tepat. Mohon periksa kembali kredensial Anda.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg('Terjadi gangguan saat memverifikasi akun.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row selection:bg-amber-500/30 selection:text-amber-200 transition-colors duration-300 ${
        isDarkMode
          ? 'bg-[#070D19] text-[#E5E9F5]'
          : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* ================= LEFT: EXECUTIVE SINGLE-DOOR CREDENTIAL HUB ================= */}
      <div
        className={`relative flex-[1.2] overflow-hidden flex flex-col justify-between p-6 sm:p-10 lg:p-14 border-b lg:border-b-0 lg:border-r transition-colors duration-300 ${
          isDarkMode
            ? 'bg-[#0A192F]/90 border-white/10'
            : 'bg-white border-slate-200/90'
        }`}
      >
        {/* Dynamic Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {isDarkMode ? (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 10% 10%, rgba(245,158,11,0.2), transparent 55%), radial-gradient(circle at 90% 90%, rgba(14,165,233,0.15), transparent 55%), #0A192F'
                }}
              />
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                  maskImage: 'radial-gradient(ellipse 80% 60% at 40% 30%, black 40%, transparent 90%)'
                }}
              />
              <div className="blob-1 absolute w-[500px] h-[500px] -top-[140px] -left-[160px] bg-[rgba(245,158,11,0.18)] rounded-full blur-[120px]" />
              <div className="blob-2 absolute w-[520px] h-[520px] -bottom-[160px] -right-[140px] bg-[rgba(14,165,233,0.14)] rounded-full blur-[120px]" />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 10% 10%, rgba(254,243,199,0.7), transparent 50%), radial-gradient(circle at 90% 90%, rgba(224,242,254,0.7), transparent 50%), #FFFFFF'
                }}
              />
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                  maskImage: 'radial-gradient(ellipse 80% 60% at 40% 30%, black 40%, transparent 90%)'
                }}
              />
              <div className="blob-1 absolute w-[440px] h-[440px] -top-[120px] -left-[140px] bg-[rgba(245,158,11,0.08)] rounded-full blur-[110px]" />
              <div className="blob-2 absolute w-[480px] h-[480px] -bottom-[140px] -right-[120px] bg-[rgba(56,189,248,0.08)] rounded-full blur-[110px]" />
            </>
          )}
        </div>

        {/* Top: Brand Identity Header */}
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center bg-white p-2.5 border border-slate-200/80 shadow-md shrink-0">
                <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="font-mono text-amber-600 dark:text-amber-400 text-[9.5px] sm:text-[10.5px] font-extrabold tracking-wider uppercase">
                  PT AJINOMOTO INDONESIA &bull; PT AJINEX INTERNATIONAL
                </p>
                <h2 className="font-display text-base sm:text-lg font-extrabold tracking-tight">
                  Multi-Skill Management Portal
                </h2>
              </div>
            </div>

            {/* Quick Theme Switcher */}
            <button
              onClick={onToggleDarkMode}
              type="button"
              className={`p-2.5 rounded-2xl border flex items-center justify-center transition cursor-pointer ${
                isDarkMode
                  ? 'bg-[#0E2340] border-white/10 text-amber-300 hover:bg-[#122A4E]'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            >
              <i className={isDarkMode ? 'fa-solid fa-sun text-sm text-amber-400' : 'fa-solid fa-moon text-sm text-amber-600'}></i>
            </button>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            <i className="fa-solid fa-shield-halved text-amber-600 dark:text-amber-400"></i> Portal Akses Terpadu
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Pusat Otorisasi HR Development
          </h1>
          <p className={`text-xs sm:text-sm leading-relaxed max-w-md font-medium mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Sistem Multi-Skill Monitoring terintegrasi untuk pemantauan, evaluasi kompetensi kerja, pembaruan data karyawan, dan penerbitan laporan resmi PT Ajinomoto Indonesia.
          </p>

          {/* Single Dedicated Account Card */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Tingkat Otorisasi Terdaftar:
            </p>

            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 flex items-start justify-between gap-4 ${
                isDarkMode
                  ? 'bg-[#0E2340]/90 border-cyan-500/30 shadow-lg'
                  : 'bg-slate-50/90 border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base shrink-0 bg-gradient-to-br from-indigo-600 to-cyan-600 text-white shadow-md font-black">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      {roleInfo.roleName}
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                      {roleInfo.badge}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {roleInfo.desc}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <i className="fa-solid fa-shield-check"></i>
                    <span>Tingkat Keamanan Terproteksi (Akses Administrator HRD)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Security Info */}
        <div
          className={`relative z-10 flex items-center justify-between pt-6 mt-6 border-t ${
            isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <i className="fa-solid fa-circle-check text-emerald-500"></i>
            <span>Server Mojokerto Terverifikasi (SSL 256-Bit)</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">
            SISTEM TERPROTEKSI
          </span>
        </div>
      </div>

      {/* ================= RIGHT: FLOATING LOGIN FORM CARD ================= */}
      <div
        className={`flex-1 relative flex items-center justify-center p-6 sm:p-10 lg:p-12 overflow-hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-[#070D19]' : 'bg-[#F8FAFC]'
        }`}
      >
        <div className={`w-full max-w-md transition duration-300 ${shake ? 'shake' : ''}`}>
          <div
            className={`rounded-3xl border transition-all duration-300 shadow-2xl overflow-hidden backdrop-blur-xl ${
              isDarkMode
                ? 'bg-[#0A192F]/95 border-white/15 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.6)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-xl'
            }`}
          >
            {/* Header Form */}
            <div className="px-7 pt-8 pb-5 text-center border-b border-slate-200/80 dark:border-white/10">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl flex items-center justify-center bg-white p-2.5 shadow-md border border-slate-100 logo-float">
                <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="w-full h-full object-contain" />
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                Masuk ke Portal
              </h2>
              <p className={`text-xs sm:text-sm mt-1 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Silakan masuk untuk mengelola matriks kompetensi karyawan.
              </p>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-6 space-y-4">
              {errorMsg && (
                <div className="rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30 flex items-start gap-2.5 animate-fadeIn">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-rose-500"></i>
                  <span className="leading-tight">{errorMsg}</span>
                </div>
              )}

              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 ml-1 text-slate-600 dark:text-slate-300">
                  Username Administrator
                </label>
                <div className="relative group">
                  <i className="fa-regular fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-colors group-focus-within:text-cyan-500"></i>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition focus:ring-3 ${
                      isDarkMode
                        ? 'bg-[#0E2340] border-white/10 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-indigo-500/20'
                    }`}
                    placeholder="mis. hr_admin"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 ml-1 text-slate-600 dark:text-slate-300">
                  Kata Sandi (Password)
                </label>
                <div className="relative group">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-colors group-focus-within:text-cyan-500"></i>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`w-full pl-11 pr-11 py-3 rounded-2xl text-sm font-semibold border outline-none transition focus:ring-3 ${
                      isDarkMode
                        ? 'bg-[#0E2340] border-white/10 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-indigo-500/20'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    <i className={showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'}></i>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="cta-btn w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-bold text-sm text-white shadow-xl shadow-indigo-600/20 mt-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <i className="fa-solid fa-arrow-right text-xs text-cyan-200"></i>
                  </>
                )}
              </button>
            </form>

            {/* Footer Quick Options */}
            <div className="px-6 pb-6 text-center border-t border-slate-200/80 dark:border-white/10 pt-4 space-y-2">
              <button
                type="button"
                onClick={onBackToLanding}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-cyan-400 inline-flex items-center gap-1.5 transition cursor-pointer pt-1"
              >
                <i className="fa-solid fa-arrow-left text-[10px]"></i> Kembali ke Halaman Utama
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
