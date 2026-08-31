import React, { useState, useMemo, useEffect } from 'react';
import { AJINOMOTO_LOGO_URL, getDefaultFilterPeriod, computeDashboardStats } from '../utils/storage';
import { INITIAL_SKILL_META, BULAN_LABELS } from '../data/initialData';
import { Employee, SkillMeta } from '../types';

interface LandingPageProps {
  employees?: Employee[];
  onEnterLogin: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  employees = [],
  onEnterLogin,
  isDarkMode,
  onToggleDarkMode
}) => {
  const currentYear = new Date().getFullYear();

  // ================= DYNAMIC DATABASE INTEGRATION =================
  // 1. Detect latest active period automatically (current year/month or closest available)
  const defaultPeriod = useMemo(() => getDefaultFilterPeriod(employees), [employees]);
  const activeYear = defaultPeriod.tahun[0] || String(currentYear);
  const activeMonth = defaultPeriod.bulan[0] || String(new Date().getMonth() + 1);
  const activeMonthName = BULAN_LABELS[Number(activeMonth) - 1] || 'Periode Terkini';

  // 2. Filter employees for active latest period
  const activePeriodEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const matched = employees.filter(
      (e) => String(e.tahun) === activeYear && String(e.bulan) === activeMonth
    );
    return matched.length > 0 ? matched : employees;
  }, [employees, activeYear, activeMonth]);

  // 3. Live Dashboard Telemetry Statistics
  const plantStats = useMemo(() => {
    return computeDashboardStats(activePeriodEmployees);
  }, [activePeriodEmployees]);

  const totalManpower = plantStats.totalManpower || activePeriodEmployees.length;
  const totalMS = plantStats.totalMS;
  const totalUS = plantStats.totalUS;
  const msPercent = totalManpower > 0 ? ((totalMS / totalManpower) * 100).toFixed(1) : '0.0';
  const usPercent = totalManpower > 0 ? ((totalUS / totalManpower) * 100).toFixed(1) : '0.0';
  const totalSkillStandards = INITIAL_SKILL_META.length;

  // ================= INTERACTIVE MATRIX SANDBOX STATE =================
  // Selected employee in Sandbox
  const [selectedEmpIndex, setSelectedEmpIndex] = useState<number>(0);
  const [selectedPositionKey, setSelectedPositionKey] = useState<string>('DEPT_MGR_UP');
  const [activeViewMode, setActiveViewMode] = useState<'jabatan' | 'levels'>('jabatan');
  const [activeLadderLevel, setActiveLadderLevel] = useState<number>(3);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'simulator' | 'radar' | 'leaderboard'>('simulator');

  // Employee data currently chosen for Sandbox
  const currentSandboxEmp: Employee | null = useMemo(() => {
    if (activePeriodEmployees.length > 0) {
      return activePeriodEmployees[selectedEmpIndex % activePeriodEmployees.length];
    }
    return null;
  }, [activePeriodEmployees, selectedEmpIndex]);

  // Minimum required skills standard for chosen employee
  const empStandard = useMemo(() => {
    if (currentSandboxEmp?.standard && currentSandboxEmp.standard > 0) {
      return currentSandboxEmp.standard;
    }
    if (!currentSandboxEmp) return 4;
    if (currentSandboxEmp.jobCategory === 'DEPT_MGR_UP') return 10;
    if (currentSandboxEmp.jobCategory === 'ASM_SM') return 8;
    if (currentSandboxEmp.jobCategory === 'LL_FOREMAN') return 6;
    if (currentSandboxEmp.jobCategory === 'NON_OPERATOR') return 2;
    return 4;
  }, [currentSandboxEmp]);

  // Get 3 representative skills for the selected employee
  const defaultSkillsList = useMemo(() => {
    if (currentSandboxEmp && currentSandboxEmp.skills && Object.keys(currentSandboxEmp.skills).length > 0) {
      const keys = Object.keys(currentSandboxEmp.skills);
      return keys.slice(0, 3).map((code) => {
        const meta = INITIAL_SKILL_META.find((s) => s.code === code);
        const isMastered = Boolean(currentSandboxEmp.skills[code]);
        return {
          code,
          name: meta ? `${meta.code} - ${meta.family}` : code,
          isMastered
        };
      });
    }
    // Fallback if no specific skills recorded
    return [
      { code: 'FI-1 / H-2', name: 'Fermentasi Proses MSG (FI-1 / H-2)', isMastered: true },
      { code: 'QA NE / QC', name: 'Standar Mutu QC & ISO 9001 (QA NE)', isMastered: true },
      { code: 'FI-2 / Prod', name: 'Pengemasan Berkecepatan Tinggi (FI-2)', isMastered: false }
    ];
  }, [currentSandboxEmp]);

  // Interactive Live Skill Mastery States
  const [interactiveMastery, setInteractiveMastery] = useState<{ [code: string]: boolean }>({});

  // Sync interactive mastery whenever selected employee changes
  useEffect(() => {
    const initialMastery: { [code: string]: boolean } = {};
    defaultSkillsList.forEach((s) => {
      initialMastery[s.code] = s.isMastered;
    });
    setInteractiveMastery(initialMastery);
  }, [defaultSkillsList]);

  const handleToggleSkill = (code: string) => {
    setInteractiveMastery((prev) => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  const handleResetSandbox = () => {
    const resetMastery: { [code: string]: boolean } = {};
    defaultSkillsList.forEach((s) => {
      resetMastery[s.code] = s.isMastered;
    });
    setInteractiveMastery(resetMastery);
  };

  // Base score calculation for other skills outside the 3 interactive ones
  const baseOtherSkillsScore = useMemo(() => {
    const originalMasteredInList = defaultSkillsList.filter((s) => s.isMastered).length;
    const actualTotal = currentSandboxEmp?.totalScore ?? 4;
    return Math.max(0, actualTotal - originalMasteredInList);
  }, [currentSandboxEmp, defaultSkillsList]);

  // Compute simulated live total score
  const simulatedTotalScore = useMemo(() => {
    const interactiveMasteredCount = Object.values(interactiveMastery).filter(Boolean).length;
    return baseOtherSkillsScore + interactiveMasteredCount;
  }, [baseOtherSkillsScore, interactiveMastery]);

  const simulatedGap = simulatedTotalScore - empStandard;
  const isMSQualified = simulatedTotalScore >= empStandard;

  // AJINOMOTO MS QUALIFICATIONS PER JABATAN
  const jobPositionQualifications = [
    {
      key: 'DEPT_MGR_UP',
      roleTitle: 'Dept. Manager up',
      gradeRange: 'Grade M4 - M5',
      jobCategoryLabel: 'Dept. Manager up (≥4 seksi / 10+ Skill)',
      threshold: '≥4 seksi',
      thresholdNumber: 4,
      targetPercent: 'Target Rasio MS: 30%',
      badge: 'Ambang Batas: ≥4 Seksi',
      badgeColor: 'amber',
      colorTheme: 'amber',
      icon: 'fa-user-tie',
      summary: 'Pimpinan departemen dengan pemahaman menyeluruh atas alur multi-proses operasional pabrik.',
      requirements: [
        'Menguasai minimal ≥ 4 seksi kompetensi lintas departemen operasional pabrik.',
        'Memahami keterkaitan proses hulu-hilir: Fermentasi, Kristalisasi, Utilitas Energi, dan Quality Assurance.',
        'Memimpin tinjauan efisiensi operasional dan kepatuhan standar mutu pangan (ASV, ISO, Halal).',
        'Menyetujui standardisasi matriks kompetensi dan rencana rotasi tahunan.'
      ],
      sampleRoles: ['Dept. Manager Fermentation', 'Dept. Manager QA/QC', 'Plant Technical Director', 'General Manager Factory']
    },
    {
      key: 'ASM_SM',
      roleTitle: 'ASM - Section Manager',
      gradeRange: 'Grade M1 - M3',
      jobCategoryLabel: 'ASM - SM (≥3 seksi / 8+ Skill)',
      threshold: '≥3 seksi',
      thresholdNumber: 3,
      targetPercent: 'Target Rasio MS: 30%',
      badge: 'Ambang Batas: ≥3 Seksi',
      badgeColor: 'indigo',
      colorTheme: 'indigo',
      icon: 'fa-user-check',
      summary: 'Manajer seksi dan asisten manajer yang menguasai berbagai proses kerja di departemennya.',
      requirements: [
        'Menguasai minimal ≥ 3 seksi kompetensi teknis di lingkungan departemen terkait.',
        'Melakukan penilaian berkala matriks multi-skill dan memetakan kebutuhan pelatihan anggota tim.',
        'Menangani investigasi ketidaksesuaian mutu dan deviasi proses di lini kerja.',
        'Merencanakan jadwal rotasi kerja dan program pembinaan teknis seksi.'
      ],
      sampleRoles: ['Section Manager Fermentation', 'Associate Manager EHS', 'Section Manager Logistics', 'SM HR Development']
    },
    {
      key: 'LL_FOREMAN',
      roleTitle: 'Line Leader & Foreman',
      gradeRange: 'Grade ST3 - ST4',
      jobCategoryLabel: 'LL - Foreman (≥2 seksi / 6+ Skill)',
      threshold: '≥2 seksi',
      thresholdNumber: 2,
      targetPercent: 'Target Rasio MS: 30%',
      badge: 'Ambang Batas: ≥2 Seksi',
      badgeColor: 'sky',
      colorTheme: 'cyan',
      icon: 'fa-users-gear',
      summary: 'Pengawas lini produksi yang menguasai pengoperasian dan penanganan kendala function/seksi.',
      requirements: [
        'Menguasai minimal ≥ 2 seksi kompetensi pada area lini operasional.',
        'Mampu melakukan penanganan kendala cepat (troubleshooting) dan pengaturan regu kerja (shift).',
        'Memimpin pengawasan efisiensi harian, briefing K3 sebelum kerja, dan disiplin sanitasi.',
        'Memberikan bimbingan teknis langsung kepada para operator lini.'
      ],
      sampleRoles: ['Foreman Inoculum', 'Line Leader High-Speed Packaging', 'Foreman K3 Fire & Safety', 'Line Leader ASRS']
    }
  ];

  const ladderDescriptions = [
    {
      level: 1,
      symbol: 'I',
      title: 'Tingkat I - Single Skill (1 Function/Seksi Dikuasai)',
      badge: '1 Function/Seksi (Simbol I)',
      desc: 'Telah menguasai dan pernah menduduki 1 function/seksi secara penuh. Menjadi fondasi awal spesialisasi operasional pabrik.',
      color: 'amber',
      impact: 'Spesialis pada 1 function/seksi utama'
    },
    {
      level: 2,
      symbol: 'L',
      title: 'Tingkat L - Multi-Skill Dasar (2 Function/Seksi Dikuasai)',
      badge: '2 Function/Seksi (Simbol L)',
      desc: 'Pernah menduduki dan menguasai 2 function/seksi berbeda. Mampu saling mem-backup dan rotasi fleksibel dalam satu lini produksi (Memenuhi syarat Operator MS).',
      color: 'sky',
      impact: 'Fleksibilitas rotasi 2 function/seksi dalam lini'
    },
    {
      level: 3,
      symbol: 'U',
      title: 'Tingkat U - Multi-Skill Teruji (3 Function/Seksi Dikuasai)',
      badge: '3 Function/Seksi (Simbol U)',
      desc: 'Pernah menduduki dan menguasai 3 function/seksi strategis. Fleksibilitas tinggi untuk rotasi antar-seksi dalam satu departemen dan memenuhi standar Line Leader/Foreman.',
      color: 'emerald',
      impact: 'Kualifikasi pengawas regu & rotasi antar-seksi'
    },
    {
      level: 4,
      symbol: 'O',
      title: 'Tingkat O - Full Multi-Skill Master (≥4 Function/Seksi Dikuasai)',
      badge: '≥4 Function/Seksi (Simbol O)',
      desc: 'Tingkat penguasaan tertinggi: Pernah menduduki dan menguasai ≥ 4 function/seksi komprehensif lintas departemen/divisi. Siap menjadi instruktur, koordinator proses pabrik, dan Dept. Manager.',
      color: 'indigo',
      impact: 'Master rotasi pabrik & pelatih kompetensi'
    }
  ];

  // Employee initials helper
  const getInitials = (name?: string) => {
    if (!name) return 'AP';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200 transition-colors duration-300 ${
        isDarkMode
          ? 'bg-[#070D19] text-slate-100'
          : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* ================= BACKGROUND AURAS & GRID MESH ================= */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {isDarkMode ? (
          <>
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 10% 15%, rgba(99,102,241,0.2), transparent 45%), radial-gradient(circle at 90% 85%, rgba(34,211,238,0.15), transparent 45%), radial-gradient(circle at 50% 50%, rgba(10,25,47,0.8), transparent 75%), #070D19'
              }}
            />
            <div className="blob blob-1 absolute w-[600px] h-[600px] -top-[160px] -left-[180px] bg-[rgba(99,102,241,0.2)] rounded-full blur-[140px]" />
            <div className="blob blob-2 absolute w-[620px] h-[620px] top-[30%] -right-[200px] bg-[rgba(34,211,238,0.16)] rounded-full blur-[140px]" />
            <div className="blob blob-3 absolute w-[520px] h-[520px] -bottom-[200px] left-[20%] bg-[rgba(245,158,11,0.12)] rounded-full blur-[130px]" />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'radial-gradient(ellipse 90% 75% at 50% 35%, black 40%, transparent 95%)'
              }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 10% 10%, rgba(224,231,255,0.7), transparent 45%), radial-gradient(circle at 90% 90%, rgba(224,242,254,0.7), transparent 45%), radial-gradient(circle at 50% 30%, rgba(254,243,199,0.35), transparent 60%), #F8FAFC'
              }}
            />
            <div className="blob blob-1 absolute w-[550px] h-[550px] -top-[140px] -left-[160px] bg-[rgba(99,102,241,0.08)] rounded-full blur-[130px]" />
            <div className="blob blob-2 absolute w-[580px] h-[580px] top-[25%] -right-[180px] bg-[rgba(56,189,248,0.08)] rounded-full blur-[130px]" />
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'radial-gradient(ellipse 85% 65% at 50% 30%, black 50%, transparent 95%)'
              }}
            />
          </>
        )}
      </div>

      {/* ================= MAIN CONTAINER ================= */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col min-h-screen w-full">
        
        {/* ================= FLOATING ISLAND HEADER ================= */}
        <header
          className={`sticky top-3 z-50 flex items-center justify-between px-4 sm:px-6 py-3 rounded-2xl sm:rounded-3xl border transition-all duration-300 backdrop-blur-xl ${
            isDarkMode
              ? 'bg-[#0A192F]/85 border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.5)]'
              : 'bg-white/90 border-slate-200/90 shadow-[0_4px_25px_rgba(0,0,0,0.05)]'
          }`}
        >
          {/* Brand & Factory Status */}
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white flex items-center justify-center p-2 shadow-md border border-slate-100 shrink-0">
              <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-sm sm:text-base tracking-tight">
                  Multi-Skill Platform
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE SYSTEM
                </span>
              </div>
              <p className={`text-[11px] sm:text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                PT Ajinomoto Indonesia &bull; Mojokerto Plant
              </p>
            </div>
          </div>

          {/* Quick Nav Anchors (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-slate-100/70 dark:bg-[#070D19]/70 border border-slate-200/60 dark:border-white/5 text-xs font-bold">
            <a
              href="#simulator"
              className={`px-3 py-1.5 rounded-xl transition ${
                isDarkMode ? 'text-slate-300 hover:text-cyan-300' : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <i className="fa-solid fa-gamepad mr-1 text-[11px]"></i> Simulator
            </a>
            <a
              href="#matrix-framework"
              className={`px-3 py-1.5 rounded-xl transition ${
                isDarkMode ? 'text-slate-300 hover:text-cyan-300' : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <i className="fa-solid fa-layer-group mr-1 text-[11px]"></i> Standar ILUO
            </a>
            <a
              href="#features"
              className={`px-3 py-1.5 rounded-xl transition ${
                isDarkMode ? 'text-slate-300 hover:text-cyan-300' : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <i className="fa-solid fa-cubes mr-1 text-[11px]"></i> Ekosistem
            </a>
          </nav>

          {/* Action Buttons & Theme Switcher */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleDarkMode}
              type="button"
              className={`h-10 px-3.5 rounded-2xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-[#0E2340] border-white/10 text-amber-300 hover:border-amber-400/50 hover:bg-[#122A4E]'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80 hover:border-slate-300'
              }`}
              title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            >
              <i className={isDarkMode ? 'fa-solid fa-sun text-amber-400 text-sm' : 'fa-solid fa-moon text-indigo-600 text-sm'}></i>
              <span className="hidden md:inline">{isDarkMode ? 'Terang' : 'Gelap'}</span>
            </button>

            {/* Main Admin Login CTA */}
            <button
              onClick={onEnterLogin}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-md ${
                isDarkMode
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-cyan-500/20'
                  : 'bg-gradient-to-r from-[#0E2340] to-[#1B3E68] hover:from-[#14315A] hover:to-[#224E82] text-white shadow-indigo-900/15'
              }`}
            >
              <span>Admin Portal</span>
              <i className="fa-solid fa-arrow-right-to-bracket text-xs"></i>
            </button>
          </div>
        </header>

        {/* ================= ASYMMETRICAL COMMAND CENTER HERO ================= */}
        <main className="flex-1 py-8 sm:py-12 flex flex-col gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            
            {/* LEFT COLUMN: HERO PITCH & TELEMETRY (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left">
              {/* Category Ribbon */}
              <div className="inline-flex items-center justify-center lg:justify-start gap-2 mb-4">
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold font-mono uppercase tracking-wider border ${
                    isDarkMode
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-cyan-300'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  Ajinomoto Operational Excellence
                </div>
                <span className={`text-xs font-semibold hidden sm:inline ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  &bull; Standar Manufaktur Terintegrasi
                </span>
              </div>

              {/* Ultra Modern Display Headline */}
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-[54px] font-extrabold leading-[1.12] mb-5 tracking-tight">
                Monitoring Presisi{' '}
                <span className="gradient-text">Multi&#8209;Skill</span>
                <br />
                <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                  Operator &amp; Staff Pabrik
                </span>
              </h1>

              {/* Strategic Description */}
              <p
                className={`text-sm sm:text-base max-w-2xl mx-auto lg:mx-0 mb-8 leading-relaxed font-medium ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                Pantau dan kelola pemetaan kompetensi 92 seksi operasional Pabrik Mojokerto secara terstruktur. Evaluasi kesesuaian standar kompetensi, dampingi proses peningkatan kualifikasi karyawan, dan dorong produktivitas lini produksi secara berkelanjutan.
              </p>

              {/* Action Hub */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 mb-8">
                <button
                  onClick={onEnterLogin}
                  className="cta-btn inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-display font-bold text-white text-sm sm:text-base w-full sm:w-auto cursor-pointer shadow-xl shadow-indigo-600/20"
                >
                  <span>Masuk ke Portal Admin</span>
                  <i className="fa-solid fa-arrow-right text-cyan-200"></i>
                </button>
              </div>

              {/* Live Plant Telemetry Ribbon */}
              <div
                className={`p-4 rounded-3xl border transition-all ${
                  isDarkMode
                    ? 'bg-[#0A192F]/80 border-white/10 shadow-lg'
                    : 'bg-white border-slate-200/90 shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-dashed border-slate-200 dark:border-white/10 text-xs gap-1.5">
                  <div className="flex items-center gap-2 font-bold font-mono text-cyan-600 dark:text-cyan-400">
                    <i className="fa-solid fa-industry"></i>
                    <span>STATISTIK KOMPETENSI PABRIK MOJOKERTO</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-mono font-bold">
                      {activeMonthName} {activeYear}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <i className="fa-solid fa-clock-rotate-left mr-1"></i>
                    Operasional Shift Aktif &bull; Mojokerto
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/60 border border-slate-200/60 dark:border-white/5">
                    <p className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-600 dark:text-cyan-400">{totalManpower}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Total Karyawan
                    </p>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/60 border border-slate-200/60 dark:border-white/5">
                    <p className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{msPercent}%</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Memenuhi Standar ({totalMS})
                    </p>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/60 border border-slate-200/60 dark:border-white/5">
                    <p className="text-xl sm:text-2xl font-extrabold font-mono text-amber-500">{totalSkillStandards}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Seksi Kompetensi
                    </p>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/60 border border-slate-200/60 dark:border-white/5">
                    <p className="text-xl sm:text-2xl font-extrabold font-mono text-rose-500">{usPercent}%</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Dalam Pembinaan ({totalUS})
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: INTERACTIVE LIVE SKILL SIMULATOR (5 Cols) */}
            <div id="simulator" className="lg:col-span-5 flex flex-col justify-center">
              <div className="relative">
                {/* Glow Backdrop */}
                <div
                  className={`absolute -inset-3 rounded-3xl blur-2xl transition-all duration-500 ${
                    isDarkMode
                      ? 'bg-gradient-to-tr from-indigo-600/30 via-cyan-500/20 to-amber-500/15'
                      : 'bg-gradient-to-tr from-indigo-200/50 via-cyan-100/50 to-amber-100/40'
                  }`}
                />

                {/* Console Container */}
                <div
                  className={`relative rounded-3xl p-5 sm:p-6 border transition-all duration-300 shadow-2xl backdrop-blur-xl ${
                    isDarkMode
                      ? 'bg-[#0A192F]/95 border-white/15 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
                      : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
                  }`}
                >
                  {/* Console Header */}
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-dashed border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                      </span>
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Simulasi Penilaian Kompetensi
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono ${
                        isMSQualified
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isMSQualified ? 'MEMENUHI STANDAR (MS)' : 'PERLU PENINGKATAN (US)'}
                    </span>
                  </div>

                  {/* Mode Tabs */}
                  <div className="flex gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-[#070D19] mb-4">
                    <button
                      type="button"
                      onClick={() => setActiveConsoleTab('simulator')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                        activeConsoleTab === 'simulator'
                          ? 'bg-white dark:bg-[#0E2340] text-indigo-600 dark:text-cyan-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <i className="fa-solid fa-user-check mr-1 text-[10px]"></i> Simulasi Karyawan
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveConsoleTab('radar')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                        activeConsoleTab === 'radar'
                          ? 'bg-white dark:bg-[#0E2340] text-indigo-600 dark:text-cyan-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <i className="fa-solid fa-chart-pie mr-1 text-[10px]"></i> Distribusi Divisi
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveConsoleTab('leaderboard')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                        activeConsoleTab === 'leaderboard'
                          ? 'bg-white dark:bg-[#0E2340] text-indigo-600 dark:text-cyan-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <i className="fa-solid fa-ranking-star mr-1 text-[10px]"></i> Peringkat Divisi
                    </button>
                  </div>

                  {/* Console Body: Simulator */}
                  {activeConsoleTab === 'simulator' && (
                    <div className="space-y-4">
                      {/* Operator Profile Preview with Database Integration & Switcher */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/80 border border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-extrabold text-sm shadow-md shrink-0">
                              {getInitials(currentSandboxEmp?.empName)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-extrabold truncate">
                                  {currentSandboxEmp?.empName || 'Agus Pratama, S.T.'}
                                </h4>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-white/10 font-bold text-slate-600 dark:text-slate-300">
                                  {currentSandboxEmp?.grade || 'Grade M3'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {currentSandboxEmp?.divisi || 'Production II'} &bull; {currentSandboxEmp?.department || 'Lini Fermentasi'}
                              </p>
                              <p className="text-[10px] font-medium text-cyan-600 dark:text-cyan-400 mt-0.5">
                                Jabatan: <span className="font-semibold">{currentSandboxEmp?.jobCategory || 'Operator'}</span> (Standar: {empStandard} Skill)
                              </p>
                            </div>
                          </div>

                          {/* Live Score Circle */}
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">Total Skill</p>
                            <p
                              className={`text-lg sm:text-xl font-extrabold font-mono leading-none ${
                                isMSQualified ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                              }`}
                            >
                              {simulatedTotalScore} <span className="text-xs text-slate-400 font-normal">/ {empStandard} Target</span>
                            </p>
                            <span className={`inline-block mt-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              simulatedGap >= 0
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            }`}>
                              {simulatedGap >= 0 ? `GAP +${simulatedGap} (MS)` : `GAP ${simulatedGap} (US)`}
                            </span>
                          </div>
                        </div>

                        {/* Database Employee Fast Switcher */}
                        {activePeriodEmployees.length > 1 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-mono text-[10px]">
                              Data Karyawan #{selectedEmpIndex + 1} dari {activePeriodEmployees.length} di Database
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedEmpIndex((prev) => (prev > 0 ? prev - 1 : activePeriodEmployees.length - 1))}
                                className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition"
                                title="Karyawan Sebelumnya"
                              >
                                <i className="fa-solid fa-chevron-left text-[10px]"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedEmpIndex((prev) => (prev + 1) % activePeriodEmployees.length)}
                                className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition"
                                title="Karyawan Berikutnya"
                              >
                                <i className="fa-solid fa-chevron-right text-[10px]"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Interactive Skill Toggle Selectors */}
                      <div className="space-y-2.5">
                        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                          <span>Uji Checklist Penguasaan Skill:</span>
                          <button
                            type="button"
                            onClick={handleResetSandbox}
                            className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Kembalikan status awal dari database"
                          >
                            <i className="fa-solid fa-rotate-left text-[10px]"></i>
                            <span>Kembalikan Awal</span>
                          </button>
                        </div>

                        {defaultSkillsList.map((skill, idx) => {
                          const isMastered = interactiveMastery[skill.code] ?? skill.isMastered;
                          return (
                            <div
                              key={skill.code}
                              className={`p-2.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-2.5 ${
                                isMastered
                                  ? 'bg-emerald-500/10 border-emerald-500/30'
                                  : 'bg-slate-100/80 dark:bg-[#0E2340]/60 border-slate-200/80 dark:border-white/5'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold font-mono text-slate-400">#{idx + 1}</span>
                                  <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                                    {skill.name}
                                  </p>
                                </div>
                                <span className={`text-[10px] font-medium ${isMastered ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                                  {isMastered ? '✓ Kualifikasi Terpenuhi (+1 Poin)' : 'Belum Memenuhi Standar (0 Poin)'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleSkill(skill.code)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs ${
                                  isMastered
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-105'
                                    : 'bg-white dark:bg-[#070D19] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#122A4E]'
                                }`}
                              >
                                {isMastered ? (
                                  <>
                                    <i className="fa-solid fa-check text-[10px]"></i>
                                    <span>Dikuasai (MS)</span>
                                  </>
                                ) : (
                                  <>
                                    <i className="fa-solid fa-plus text-[10px]"></i>
                                    <span>Tandai Dikuasai</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}

                        <p className={`text-[11px] leading-relaxed pt-1 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <i className="fa-solid fa-circle-info text-cyan-500 mr-1"></i>
                          Klik tombol pada skill di atas untuk melihat bagaimana perubahan keahlian langsung mempengaruhi status kelulusan (MS / US) karyawan.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Console Body: Radar Preview */}
                  {activeConsoleTab === 'radar' && (
                    <div className="space-y-3 py-2">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#070D19]/80 border border-slate-200/80 dark:border-white/10 text-center">
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            Evaluasi GAP Kompetensi Divisi Pabrik
                          </p>
                          <span className="text-[10px] font-mono font-bold text-cyan-500">
                            {activeMonthName} {activeYear}
                          </span>
                        </div>
                        <div className="space-y-3 text-left text-xs">
                          {plantStats.byDivisi.slice(0, 4).map((div) => {
                            const total = div.ms + div.us;
                            const pct = total > 0 ? Math.round((div.ms / total) * 100) : 0;
                            const gap = 100 - pct;
                            return (
                              <div key={div.label}>
                                <div className="flex justify-between font-semibold mb-1">
                                  <span className="truncate pr-2">{div.label} ({total} orang)</span>
                                  <span className={`font-mono font-bold shrink-0 ${gap === 0 ? 'text-emerald-500' : gap <= 10 ? 'text-cyan-500' : 'text-amber-500'}`}>
                                    {gap === 0 ? 'GAP: 0 (Terpenuhi)' : `GAP: ${gap}% Belum MS`}
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      pct >= 90 ? 'bg-emerald-500' : pct >= 80 ? 'bg-cyan-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.max(pct, 5)}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Console Body: Leaderboard (Dynamic Benchmark from Database) */}
                  {activeConsoleTab === 'leaderboard' && (
                    <div className="space-y-2.5 py-1 max-h-[260px] overflow-y-auto custom-scrollbar">
                      {plantStats.byDivisi.length > 0 ? (
                        plantStats.byDivisi.map((div, idx) => {
                          const total = div.ms + div.us;
                          const pct = total > 0 ? ((div.ms / total) * 100).toFixed(1) : '0.0';
                          return (
                            <div
                              key={div.label}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-[#070D19]/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs font-semibold"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                                    idx === 0
                                      ? 'bg-amber-400/20 text-amber-500'
                                      : idx === 1
                                      ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                      : idx === 2
                                      ? 'bg-amber-700/20 text-amber-600 dark:text-amber-400'
                                      : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div className="truncate">
                                  <p className="truncate text-slate-800 dark:text-slate-200">{div.label}</p>
                                  <p className="text-[10px] text-slate-400 font-normal">{total} Karyawan &bull; {div.ms} MS</p>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-emerald-500 shrink-0 ml-2">
                                {pct}% MS
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          Belum ada data divisi pada periode ini.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Console Footer Direct Action */}
                  <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                      <i className="fa-solid fa-lock text-cyan-500"></i> Role Protected Database
                    </span>
                    <button
                      type="button"
                      onClick={onEnterLogin}
                      className="text-xs font-bold text-indigo-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      Buka Portal Admin <i className="fa-solid fa-arrow-right text-[10px]"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= AJINOMOTO MS QUALIFICATIONS PER JABATAN ================= */}
          <section id="matrix-framework" className="py-4">
            <div
              className={`rounded-3xl p-6 sm:p-8 border transition-all duration-300 shadow-xl backdrop-blur-xl ${
                isDarkMode
                  ? 'bg-[#0A192F]/90 border-white/10 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.4)]'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-md'
              }`}
            >
              {/* Section Header with View Mode Switcher */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 mb-6 border-b border-dashed border-slate-200 dark:border-white/10 gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <i className="fa-solid fa-ranking-star text-amber-500"></i> STANDAR KUALIFIKASI RESMI
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
                    Standar Kelulusan (MS) &amp; Penilaian Kemahiran
                  </h3>
                  <p className={`text-xs sm:text-sm mt-1 max-w-2xl font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Panduan penentuan status Memenuhi Standar (MS) berdasarkan golongan jabatan serta rubrik 4 tingkat kematangan teknis operator (ILUO) di pabrik PT Ajinomoto Indonesia.
                  </p>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="p-1 rounded-2xl bg-slate-100 dark:bg-[#070D19] border border-slate-200 dark:border-white/10 flex items-center">
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('jabatan')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeViewMode === 'jabatan'
                          ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-id-card-clip text-xs"></i>
                      <span>Standar per Jabatan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('levels')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeViewMode === 'levels'
                          ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-layer-group text-xs"></i>
                      <span>4 Tingkat ILUO (1 - ≥4 Function/Seksi)</span>
                    </button>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <i className="fa-solid fa-circle-check text-[10px]"></i> Standar ASV Pabrik
                  </span>
                </div>
              </div>

              {/* ================= VIEW 1: QUALIFICATIONS PER JABATAN ================= */}
              {activeViewMode === 'jabatan' && (
                <div className="space-y-6">
                  {/* 3 Position Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
                    {jobPositionQualifications.map((pos) => {
                      const isSelected = selectedPositionKey === pos.key;
                      return (
                        <div
                          key={pos.key}
                          onClick={() => setSelectedPositionKey(pos.key)}
                          className={`p-4 sm:p-4.5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                            isSelected
                              ? isDarkMode
                                ? 'bg-[#0E2340] border-cyan-400 ring-2 ring-cyan-500/30 shadow-lg -translate-y-1'
                                : 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md -translate-y-1'
                              : isDarkMode
                              ? 'bg-[#070D19]/60 border-white/10 hover:border-white/20 hover:bg-[#0E2340]/40'
                              : 'bg-slate-50 border-slate-200/90 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          {/* Selected Active Indicator Pill */}
                          {isSelected && (
                            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-amber-400"></div>
                          )}

                          <div>
                            {/* Card Top: Icon & Grade */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-xs transition-transform group-hover:scale-110 ${
                                  isSelected
                                    ? 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <i className={`fa-solid ${pos.icon}`}></i>
                              </div>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                {pos.gradeRange}
                              </span>
                            </div>

                            {/* Role Title */}
                            <h4 className="font-display font-extrabold text-sm sm:text-base leading-tight mb-1">
                              {pos.roleTitle}
                            </h4>

                            {/* Job Category Key */}
                            <p className="text-[11px] font-mono font-semibold text-cyan-600 dark:text-cyan-400 mb-2">
                              {pos.jobCategoryLabel}
                            </p>

                            {/* Threshold Box */}
                            <div
                              className={`p-2.5 rounded-xl mb-3 border text-center ${
                                isSelected
                                  ? 'bg-cyan-500/10 border-cyan-500/30'
                                  : 'bg-slate-100 dark:bg-[#070D19]/80 border-slate-200 dark:border-white/5'
                              }`}
                            >
                              <p className="text-[9px] uppercase font-mono font-extrabold tracking-wider text-slate-400">
                                Syarat Minimal Kelulusan (MS)
                              </p>
                              <p className="text-xs sm:text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {pos.threshold}
                              </p>
                            </div>

                            {/* Brief Summary */}
                            <p className={`text-[11px] leading-relaxed line-clamp-3 mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {pos.summary}
                            </p>
                          </div>

                          {/* Footer Target Status */}
                          <div className="pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[10px] font-semibold">
                            <span className="text-slate-400">Target Pencapaian:</span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-cyan-400">
                              {pos.targetPercent}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Interactive Inspector Panel for Selected Position */}
                  {(() => {
                    const currentPos = jobPositionQualifications.find((p) => p.key === selectedPositionKey) || jobPositionQualifications[1];
                    return (
                      <div
                        className={`p-5 sm:p-7 rounded-3xl border transition-all duration-300 animate-fadeIn ${
                          isDarkMode
                            ? 'bg-[#0E2340]/80 border-cyan-500/30 shadow-xl'
                            : 'bg-indigo-50/60 border-indigo-200 shadow-sm'
                        }`}
                      >
                        {/* Inspector Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-dashed border-slate-200 dark:border-white/10 gap-3">
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-md text-lg shrink-0">
                              <i className={`fa-solid ${currentPos.icon}`}></i>
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-display text-lg sm:text-xl font-extrabold tracking-tight">
                                  {currentPos.roleTitle}
                                </h4>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                                  {currentPos.gradeRange}
                                </span>
                              </div>
                              <p className={`text-xs font-medium mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                Golongan: <strong className="font-mono text-indigo-600 dark:text-cyan-400">{currentPos.jobCategoryLabel}</strong> &bull; Standar Minimal: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{currentPos.threshold}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-[#070D19] border border-slate-200 dark:border-white/10 text-right">
                              <p className="text-[10px] uppercase font-mono font-bold text-slate-400">Target Pabrik</p>
                              <p className="text-xs sm:text-sm font-extrabold font-mono text-indigo-600 dark:text-cyan-400">
                                {currentPos.targetPercent}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Inspector Grid Content */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                          {/* Requirements & Criteria (7 Cols) */}
                          <div className="lg:col-span-7 space-y-3">
                            <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <i className="fa-solid fa-list-check text-cyan-500"></i> Kriteria Kelulusan Memenuhi Standar (MS):
                            </h5>
                            <div className="grid grid-cols-1 gap-2.5">
                              {currentPos.requirements.map((req, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-2xl bg-white dark:bg-[#070D19]/80 border border-slate-200/80 dark:border-white/10 flex items-start gap-3"
                                >
                                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                    <i className="fa-solid fa-check"></i>
                                  </span>
                                  <p className={`text-xs sm:text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {req}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Sample Positions & Evaluation Logic (5 Cols) */}
                          <div className="lg:col-span-5 space-y-4">
                            {/* Sample Roles in Plant */}
                            <div className="p-4 rounded-2xl bg-white dark:bg-[#070D19]/80 border border-slate-200/80 dark:border-white/10">
                              <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                                <i className="fa-solid fa-building-user text-indigo-500"></i> Contoh Posisi Kerja di Pabrik:
                              </h5>
                              <div className="flex flex-wrap gap-1.5">
                                {currentPos.sampleRoles.map((role, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#0E2340] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                                  >
                                    {role}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Standard Evaluation Formula Box */}
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-cyan-500/10 to-transparent border border-indigo-500/20">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-mono font-extrabold uppercase text-indigo-600 dark:text-cyan-400">
                                  Prinsip Penilaian Sistem
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold">
                                  Otomatis
                                </span>
                              </div>
                              <p className={`text-xs leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                Jumlah keahlian terverifikasi &ge;{' '}
                                <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{currentPos.thresholdNumber} Seksi</strong>{' '}
                                &rarr; <span className="font-bold text-emerald-600 dark:text-emerald-400">Status MS (Memenuhi Standar)</span>. Jika di bawah target, dicatat sebagai <span className="font-bold text-rose-500">GAP (US - Belum Standar)</span> untuk penyusunan jadwal pelatihan dan rotasi.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ================= VIEW 2: 4 TINGKAT ILUO (KUANTITAS FUNCTION/SEKSI) ================= */}
              {activeViewMode === 'levels' && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Practical Guidance Callout */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-100 dark:bg-[#070D19] border border-slate-200 dark:border-white/10 flex items-start gap-3.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <i className="fa-solid fa-shapes text-sm sm:text-base"></i>
                    </div>
                    <div className="text-xs sm:text-sm">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">
                          Konsep Tingkatan ILUO: Kuantitas Function / Seksi yang Pernah Diduduki
                        </h4>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20">
                          Standar Manufaktur Ajinomoto
                        </span>
                      </div>
                      <p className={`leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Tingkatan ini <strong>bukan diukur dari sekadar tingkat pemahaman teori</strong>, melainkan menggambarkan <strong>jumlah kuantitas function/seksi nyata yang pernah diduduki dan dikuasai secara mandiri</strong> oleh karyawan. Semakin banyak variasi function/seksi yang dikuasai, semakin tinggi fleksibilitas rotasi manpower di lantai produksi.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {ladderDescriptions.map((lad) => {
                      const isActive = activeLadderLevel === lad.level;
                      return (
                        <div
                          key={lad.level}
                          onClick={() => setActiveLadderLevel(lad.level)}
                          className={`p-4 sm:p-4.5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                            isActive
                              ? isDarkMode
                                ? 'bg-[#0E2340] border-cyan-400 ring-2 ring-cyan-500/30 shadow-lg -translate-y-1'
                                : 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20 shadow-md -translate-y-1'
                              : isDarkMode
                              ? 'bg-[#070D19]/60 border-white/10 hover:border-white/20'
                              : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-base font-extrabold text-indigo-600 dark:text-cyan-400">
                                  [{lad.symbol}]
                                </span>
                                <span className="text-[11px] font-mono font-bold text-slate-400">
                                  ({lad.level === 4 ? '≥4' : lad.level} Function/Seksi)
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  lad.level >= 2
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {lad.badge}
                              </span>
                            </div>
                            <h4 className="font-display font-bold text-xs sm:text-sm mb-1.5 text-slate-900 dark:text-slate-100">
                              {lad.title}
                            </h4>
                            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {lad.desc}
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-white/5 space-y-1">
                            <p className="text-[9px] uppercase font-mono font-bold text-slate-400">
                              Dampak Multi-Skill:
                            </p>
                            <p className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                              <i className="fa-solid fa-arrows-split-up-and-left text-[9px]"></i>
                              <span>{lad.impact}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ================= BENTO GRID: COMPLETE FACTORY ECOSYSTEM ================= */}
          <section id="features" className="py-4">
            <div className="text-center mb-8">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-mono mb-1">
                PENGELOLAAN DATA TERPADU
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                Alur Kerja &amp; Fasilitas Sistem Multi-Skill
              </h2>
              <p className={`text-xs sm:text-sm max-w-2xl mx-auto mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Dirancang untuk memudahkan Section Head, Dept Manager, dan tim HR Development dalam memantau kompetensi, merencanakan pelatihan, dan menyusun laporan secara akurat.
              </p>
            </div>

            {/* Asymmetrical Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              
              {/* Bento Card 1: 90+ Skill Matrix (Span 2) */}
              <div
                className={`md:col-span-2 rounded-3xl p-6 sm:p-7 border transition-all duration-300 hover:shadow-xl ${
                  isDarkMode
                    ? 'bg-[#0A192F]/85 border-white/10 hover:border-cyan-500/40 text-slate-100'
                    : 'bg-white border-slate-200/90 hover:border-indigo-300 text-slate-900 shadow-sm'
                }`}
              >
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-md">
                  <i className="fa-solid fa-table-cells-large text-lg"></i>
                </div>
                <h3 className="font-display font-bold text-lg sm:text-xl mb-2">
                  Matriks Kompetensi Menyeluruh (90+ Seksi Keahlian)
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Mencakup seluruh unit proses pabrik mulai dari Fermentasi MSG, Kristalisasi, Pengemasan Berkecepatan Tinggi, Analisis Laboratorium (QC), hingga Pemeliharaan Boiler dan Utilitas Pabrik.
                </p>

                {/* Division Tags Pill Box */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Fermentasi MSG', 'Kristalisasi', 'High-Speed Packaging', 'QC & Mikrobiologi', 'QA Food Safety', 'Utility & Boiler', 'Supply Chain', 'K3 & Lingkungan'].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#070D19] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bento Card 2: Executive Multi-Select Filters */}
              <div
                className={`md:col-span-1 lg:col-span-1 rounded-3xl p-6 border transition-all duration-300 hover:shadow-xl ${
                  isDarkMode
                    ? 'bg-[#0A192F]/85 border-white/10 hover:border-amber-500/40 text-slate-100'
                    : 'bg-white border-slate-200/90 hover:border-amber-300 text-slate-900 shadow-sm'
                }`}
              >
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4 bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <i className="fa-solid fa-filter text-lg"></i>
                </div>
                <h3 className="font-display font-bold text-base sm:text-lg mb-2">
                  Pencarian &amp; Penyaringan Fleksibel
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Temukan data karyawan dengan cepat berdasarkan periode tahun dan bulan, unit divisi, departemen, seksi kerja, maupun golongan jabatan.
                </p>
              </div>

              {/* Bento Card 3: Realtime GAP Calculation */}
              <div
                className={`md:col-span-1 lg:col-span-1 rounded-3xl p-6 border transition-all duration-300 hover:shadow-xl ${
                  isDarkMode
                    ? 'bg-[#0A192F]/85 border-white/10 hover:border-emerald-500/40 text-slate-100'
                    : 'bg-white border-slate-200/90 hover:border-emerald-300 text-slate-900 shadow-sm'
                }`}
              >
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4 bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  <i className="fa-solid fa-chart-column text-lg"></i>
                </div>
                <h3 className="font-display font-bold text-base sm:text-lg mb-2">
                  Penentuan Kualifikasi (MS / US) Otomatis
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Sistem otomatis membandingkan jumlah keahlian yang dimiliki dengan standar minimal jabatan, sehingga status kelulusan (MS) dan kebutuhan pelatihan (US) langsung teridentifikasi.
                </p>
              </div>

              {/* Bento Card 4: Single-Door HR Development Admin Control (Span 2) */}
              <div
                className={`md:col-span-2 rounded-3xl p-6 sm:p-7 border transition-all duration-300 hover:shadow-xl ${
                  isDarkMode
                    ? 'bg-[#0A192F]/85 border-white/10 hover:border-indigo-500/40 text-slate-100'
                    : 'bg-white border-slate-200/90 hover:border-indigo-300 text-slate-900 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
                    <i className="fa-solid fa-sliders text-lg"></i>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">PENGELOLAAN DATA HR</span>
                </div>
                <h3 className="font-display font-bold text-lg sm:text-xl mb-2">
                  Pusat Pengelolaan Data HR &amp; Tim Penilai
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Akses khusus bagi penilai dan tim HR untuk input evaluasi berkala, pembaruan data karyawan, sinkronisasi Google Sheets / Supabase, serta manajemen periode evaluasi.
                </p>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#070D19] border border-slate-200 dark:border-white/5">
                    <p className="font-bold text-cyan-600 dark:text-cyan-400">Data Karyawan</p>
                    <p className="text-[10px] text-slate-400">Input &amp; Pembaruan</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#070D19] border border-slate-200 dark:border-white/5">
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">Hitung Multi-Skill</p>
                    <p className="text-[10px] text-slate-400">Status MS &amp; GAP</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#070D19] border border-slate-200 dark:border-white/5">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">Sinkronisasi Cloud</p>
                    <p className="text-[10px] text-slate-400">Penyimpanan Aman</p>
                  </div>
                </div>
              </div>

              {/* Bento Card 5: Excel & Report Export (Span 2) */}
              <div
                className={`md:col-span-2 rounded-3xl p-6 sm:p-7 border transition-all duration-300 hover:shadow-xl ${
                  isDarkMode
                    ? 'bg-[#0A192F]/85 border-white/10 hover:border-emerald-500/40 text-slate-100'
                    : 'bg-white border-slate-200/90 hover:border-emerald-300 text-slate-900 shadow-sm'
                }`}
              >
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4 bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  <i className="fa-solid fa-file-excel text-lg"></i>
                </div>
                <h3 className="font-display font-bold text-lg sm:text-xl mb-2">
                  Laporan &amp; Rekapitulasi Siap Pakai
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Unduh ringkasan evaluasi lengkap per divisi, grafik seksi, dan catatan evaluasi karyawan dalam format spreadsheet (.xlsx / .csv) dan dokumen resmi.
                </p>
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  <i className="fa-solid fa-check-circle"></i>
                  <span>Format Sesuai Standar Laporan Manajemen &amp; Audit Mutu</span>
                </div>
              </div>
            </div>
          </section>

          {/* ================= 4-STEP FACTORY OPERATIONAL SOP ================= */}
          <section className="py-4">
            <div
              className={`rounded-3xl p-6 sm:p-8 border transition-all ${
                isDarkMode
                  ? 'bg-gradient-to-r from-[#0A192F] via-[#0E2340] to-[#0A192F] border-white/10 text-white'
                  : 'bg-white border-slate-200/90 shadow-md text-slate-900'
              }`}
            >
              <div className="text-center max-w-2xl mx-auto mb-8">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-500 font-mono mb-1">
                  ALUR KERJA DI PABRIK
                </p>
                <h3 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                  Tahapan Pelaksanaan Evaluasi Multi-Skill
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
                {/* Step 1 */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/70 border border-slate-200/80 dark:border-white/10 relative">
                  <span className="text-3xl font-extrabold font-mono text-indigo-500/40 absolute top-3 right-4">01</span>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center text-sm font-bold mb-3">
                    <i className="fa-solid fa-clipboard-check"></i>
                  </div>
                  <h4 className="font-display font-bold text-sm mb-1">Penilaian Berkala</h4>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Pengujian dan observasi keahlian teknis secara berkala di function/seksi dan laboratorium.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/70 border border-slate-200/80 dark:border-white/10 relative">
                  <span className="text-3xl font-extrabold font-mono text-cyan-500/40 absolute top-3 right-4">02</span>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center text-sm font-bold mb-3">
                    <i className="fa-solid fa-table-list"></i>
                  </div>
                  <h4 className="font-display font-bold text-sm mb-1">Pemetaan Matriks</h4>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Pencatatan data penguasaan skill ke dalam matriks untuk fleksibilitas rotasi manpower saat musim produksi tinggi.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/70 border border-slate-200/80 dark:border-white/10 relative">
                  <span className="text-3xl font-extrabold font-mono text-amber-500/40 absolute top-3 right-4">03</span>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center text-sm font-bold mb-3">
                    <i className="fa-solid fa-chalkboard-user"></i>
                  </div>
                  <h4 className="font-display font-bold text-sm mb-1">Program Pelatihan</h4>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Penyusunan jadwal bimbingan teknis (OJT) bagi operator yang belum memenuhi standar (US).
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#070D19]/70 border border-slate-200/80 dark:border-white/10 relative">
                  <span className="text-3xl font-extrabold font-mono text-emerald-500/40 absolute top-3 right-4">04</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-sm font-bold mb-3">
                    <i className="fa-solid fa-award"></i>
                  </div>
                  <h4 className="font-display font-bold text-sm mb-1">Sertifikasi &amp; Laporan</h4>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Pemberian sertifikasi kompetensi resmi dan rekapitulasi pencapaian untuk tinjauan manajemen.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ================= FINAL CALL TO ACTION BANNER ================= */}
          <section className="py-4">
            <div
              className={`rounded-3xl p-8 sm:p-10 border relative overflow-hidden transition-all text-center flex flex-col items-center justify-center ${
                isDarkMode
                  ? 'bg-gradient-to-r from-indigo-950/90 via-[#0A192F] to-cyan-950/90 border-cyan-500/30 text-white shadow-2xl shadow-cyan-500/10'
                  : 'bg-gradient-to-r from-indigo-900 via-[#0E2340] to-indigo-950 text-white border-slate-800 shadow-xl'
              }`}
            >
              <div className="h-16 w-16 rounded-3xl bg-white p-3 shadow-lg mb-4">
                <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="w-full h-full object-contain" />
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                Siap Memulai Monitoring Multi-Skill?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl mb-6">
                Masuk menggunakan akun terotorisasi untuk mengelola data kompetensi, menyetujui evaluasi, dan mencetak laporan pabrik.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onEnterLogin}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm transition cursor-pointer shadow-lg inline-flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-arrow-right-to-bracket text-xs"></i>
                  <span>Login Akun Admin</span>
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* ================= REFINED FOOTER ================= */}
        <footer
          className={`py-6 border-t flex flex-col sm:flex-row items-center justify-between text-xs gap-3 ${
            isDarkMode ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Sistem Operasional Aktif &bull; Mojokerto Factory Server</span>
          </div>
          <p>
            &copy; {currentYear} PT Ajinomoto Indonesia &bull; PT Ajinex International. Hak Cipta Dilindungi.
          </p>
        </footer>
      </div>
    </div>
  );
};
