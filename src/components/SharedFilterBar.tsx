import React, { useState, useEffect, useRef } from 'react';
import { AppFiltersState, PeriodsData, Employee } from '../types';
import { BULAN_LABELS } from '../data/initialData';

interface SharedFilterBarProps {
  filters: AppFiltersState;
  onFilterChange: (newFilters: AppFiltersState) => void;
  onResetFilters: () => void;
  periods: PeriodsData;
  employees: Employee[];
}

interface FilterDef {
  key: keyof AppFiltersState;
  title: string;
  allLabel: string;
  icon: string;
}

const FILTER_DEFS: FilterDef[] = [
  { key: 'tahun', title: 'Tahun', allLabel: 'Semua Tahun', icon: 'fa-calendar' },
  { key: 'bulan', title: 'Bulan', allLabel: 'Semua Bulan', icon: 'fa-calendar-days' },
  { key: 'divisi', title: 'Divisi', allLabel: 'Semua Divisi', icon: 'fa-sitemap' },
  { key: 'department', title: 'Department', allLabel: 'Semua Dept', icon: 'fa-building' },
  { key: 'jabatan', title: 'Jabatan', allLabel: 'Semua Jabatan', icon: 'fa-id-badge' }
];

export const SharedFilterBar: React.FC<SharedFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  periods,
  employees
}) => {
  const [openDropdown, setOpenDropdown] = useState<keyof AppFiltersState | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute options dynamically
  const getOptionsForFilter = (key: keyof AppFiltersState): { value: string; label: string }[] => {
    if (key === 'tahun') {
      return periods.tahunList.map((t) => ({ value: String(t), label: String(t) }));
    }

    if (key === 'bulan') {
      let bulanNums: number[] = [];
      if (filters.tahun.length) {
        const set: Record<number, boolean> = {};
        filters.tahun.forEach((t) => {
          (periods.bulanByTahun[String(t)] || []).forEach((b) => {
            set[b] = true;
          });
        });
        bulanNums = Object.keys(set).map(Number).sort((a, b) => a - b);
      }
      if (!bulanNums.length) {
        bulanNums = Array.from({ length: 12 }, (_, i) => i + 1);
      }
      return bulanNums.map((b) => ({ value: String(b), label: BULAN_LABELS[b - 1] || String(b) }));
    }

    const set: Record<string, boolean> = {};
    employees.forEach((e) => {
      if (key === 'divisi' && e.divisi) set[e.divisi] = true;
      if (key === 'department' && e.department) set[e.department] = true;
      if (key === 'jabatan' && e.jabatan) set[e.jabatan] = true;
    });

    return Object.keys(set)
      .sort()
      .map((val) => ({ value: val, label: val }));
  };

  const handleToggleOption = (key: keyof AppFiltersState, value: string) => {
    const current = filters[key];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ ...filters, [key]: next });
  };

  const handleSelectAll = (key: keyof AppFiltersState) => {
    const options = getOptionsForFilter(key);
    onFilterChange({ ...filters, [key]: options.map((o) => o.value) });
  };

  const handleClear = (key: keyof AppFiltersState) => {
    onFilterChange({ ...filters, [key]: [] });
  };

  const getButtonLabel = (key: keyof AppFiltersState, allLabel: string): string => {
    const selected = filters[key];
    if (!selected.length) return allLabel;
    if (selected.length === 1) {
      if (key === 'bulan') {
        const num = Number(selected[0]);
        return BULAN_LABELS[num - 1] || selected[0];
      }
      return selected[0];
    }
    return `${selected.length} dipilih`;
  };

  const activeFiltersCount = (Object.keys(filters) as (keyof AppFiltersState)[]).reduce(
    (count: number, key) => {
      const arr = filters[key];
      return Array.isArray(arr) && arr.length > 0 ? count + 1 : count;
    },
    0
  );
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div
      ref={filterBarRef}
      id="shared-filter-bar"
      className="bg-white/95 dark:bg-[#0A192F]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-white/10 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2.5 relative z-30 transition-colors shadow-2xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter Title Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 font-bold text-xs">
          <i className="fa-solid fa-filter text-[11px] text-amber-600 dark:text-amber-400"></i>
          <span>Filter Data</span>
          {hasActiveFilters && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
              {activeFiltersCount}
            </span>
          )}
        </div>

        {/* Dropdown Filters */}
        {FILTER_DEFS.map((def) => {
          const isOpen = openDropdown === def.key;
          const options = getOptionsForFilter(def.key);
          const selected = filters[def.key];
          const isHasValue = selected.length > 0;

          return (
            <div key={def.key} className="ms-filter relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(isOpen ? null : def.key)}
                className={`ms-filter-btn flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                  isHasValue
                    ? 'border-amber-400 bg-amber-50/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-500 font-bold ring-1 ring-amber-400/40'
                    : 'text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0E2340]/80 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <i className={`fa-solid ${def.icon} text-[10px] opacity-60`}></i>
                  <span className="truncate max-w-[110px] sm:max-w-[130px]">
                    {getButtonLabel(def.key, def.allLabel)}
                  </span>
                </div>
                <i
                  className={`fa-solid fa-chevron-down ms-filter-caret text-[9px] transition-transform duration-200 ${
                    isOpen
                      ? 'rotate-180 text-amber-600 dark:text-amber-400'
                      : isHasValue
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-400'
                  }`}
                ></i>
              </button>

              {isOpen && (
                <div className="ms-filter-panel absolute top-[calc(100%+6px)] left-0 sm:left-auto w-64 max-w-[calc(100vw-32px)] bg-white dark:bg-[#0E2340] border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="ms-filter-panel-actions flex gap-2 p-2 border-b border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A192F]/80">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(def.key)}
                      className="flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer active:scale-95"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClear(def.key)}
                      className="flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer active:scale-95"
                    >
                      Kosongkan
                    </button>
                  </div>

                  <div className="ms-filter-options max-h-56 overflow-y-auto p-1.5 space-y-0.5 overscroll-contain">
                    {options.length ? (
                      options.map((opt) => {
                        const isChecked = selected.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={`ms-filter-option flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleOption(def.key, opt.value)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 w-4 h-4"
                            />
                            <span className="truncate">{opt.label}</span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="ms-filter-empty text-center text-xs text-slate-400 py-3">Tidak ada opsi</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Right: Reset Action & Count */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResetFilters}
          className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 border ${
            hasActiveFilters
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 shadow-2xs'
              : 'bg-transparent border-transparent text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
          }`}
          title="Reset semua filter ke kondisi awal"
        >
          <i className={`fa-solid fa-rotate-left text-[11px] ${hasActiveFilters ? 'text-amber-600 dark:text-amber-400' : ''}`}></i>
          <span>Reset Filter</span>
        </button>
      </div>
    </div>
  );
};
