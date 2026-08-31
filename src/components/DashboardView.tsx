import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  Plugin
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { DashboardStats } from '../types';

// Custom Chart.js Plugin for Minimalist Soft Shadow & Glow
const softShadowPlugin: Plugin = {
  id: 'softShadowPlugin',
  beforeDatasetDraw(chart, args) {
    const { ctx } = chart;
    ctx.save();
    // Apply a soft ambient shadow for elements
    ctx.shadowColor = 'rgba(15, 23, 42, 0.06)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
  },
  afterDatasetDraw(chart) {
    const { ctx } = chart;
    ctx.restore();
  }
};

// Register Chart.js modules and custom plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  softShadowPlugin
);

interface DashboardViewProps {
  stats: DashboardStats;
  isDarkMode?: boolean;
  onOpenPdfModal?: () => void;
  onOpenExcelModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  isDarkMode = false,
  onOpenPdfModal,
  onOpenExcelModal
}) => {
  const {
    totalManpower,
    totalMS,
    totalUS,
    percentMS,
    byPosition,
    byDivisi,
    byDepartment,
    byGrade,
    genderMap,
    notes,
    lastUpdated
  } = stats;

  // Local interactive view toggles
  const [positionViewMode, setPositionViewMode] = useState<'percent' | 'count'>('percent');
  const [divisiViewMode, setDivisiViewMode] = useState<'stacked' | 'percent'>('stacked');
  const [deptViewMode, setDeptViewMode] = useState<'stacked' | 'percent'>('stacked');
  const [deptSortMode, setDeptSortMode] = useState<'default' | 'highest'>('default');

  const pctFormatted = (percentMS * 100).toFixed(1) + '%';
  const targetOverall = 80.0; // Standard company multi-skill target
  const gapToTarget = (targetOverall - percentMS * 100).toFixed(1);
  const isTargetAchieved = percentMS * 100 >= targetOverall;

  const updatedFormatted =
    new Date(lastUpdated).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WIB';

  // Find top performing division and department
  const topDivisi = byDivisi.length
    ? [...byDivisi].sort((a, b) => {
        const rateA = a.ms + a.us > 0 ? a.ms / (a.ms + a.us) : 0;
        const rateB = b.ms + b.us > 0 ? b.ms / (b.ms + b.us) : 0;
        return rateB - rateA;
      })[0]
    : null;
  const topDivisiRate =
    topDivisi && topDivisi.ms + topDivisi.us > 0
      ? ((topDivisi.ms / (topDivisi.ms + topDivisi.us)) * 100).toFixed(1) + '%'
      : '-';

  // Dynamic Theme Palette Values
  const tickColor = isDarkMode ? '#94A3B8' : '#475569';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(148, 163, 184, 0.12)';
  const tooltipBg = isDarkMode ? 'rgba(6, 10, 22, 0.96)' : 'rgba(14, 35, 64, 0.96)';
  const tooltipBorder = isDarkMode ? 'rgba(245, 158, 11, 0.35)' : 'rgba(184, 135, 75, 0.35)';

  // Common Typography & Minimalist Tooltip Options for Chart.js
  const commonFont = {
    family: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    size: 11,
    weight: '500' as const
  };

  const boldFont = {
    family: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    size: 11,
    weight: '600' as const
  };

  // Ultra-Clean Minimalist Floating Tooltip Config
  const sharedTooltipConfig: any = {
    enabled: true,
    backgroundColor: tooltipBg,
    titleColor: '#F8FAFC',
    bodyColor: isDarkMode ? '#CBD5E1' : '#E2E8F0',
    borderColor: tooltipBorder,
    borderWidth: 1,
    padding: {
      top: 10,
      bottom: 10,
      left: 14,
      right: 14
    },
    cornerRadius: 12,
    caretSize: 6,
    caretPadding: 8,
    titleFont: {
      family: "'Plus Jakarta Sans', sans-serif",
      size: 12,
      weight: '700'
    },
    bodyFont: {
      family: "'Plus Jakarta Sans', sans-serif",
      size: 11,
      weight: '500'
    },
    titleMarginBottom: 6,
    bodySpacing: 5,
    usePointStyle: true,
    boxWidth: 8,
    boxHeight: 8,
    boxPadding: 6,
    displayColors: true,
    animation: {
      duration: 150
    }
  };

  // ----------------------------------------------------
  // 1. Chart: Target vs Result per Job Position
  // ----------------------------------------------------
  const positionChartData = {
    labels: byPosition.map((p) => p.label),
    datasets:
      positionViewMode === 'percent'
        ? [
            {
              label: 'Target KPI (%)',
              data: byPosition.map((p) => Number((p.target * 100).toFixed(1))),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
                  gradient.addColorStop(1, 'rgba(14, 165, 233, 0.12)');
                } else {
                  gradient.addColorStop(0, 'rgba(100, 116, 139, 0.7)');
                  gradient.addColorStop(1, 'rgba(148, 163, 184, 0.15)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#38BDF8' : 'rgba(100, 116, 139, 0.9)',
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false,
              maxBarThickness: 38
            },
            {
              label: 'Result Aktual (%)',
              data: byPosition.map((p) => Number((p.resultPercent * 100).toFixed(1))),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(251, 191, 36, 0.95)');
                  gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.7)');
                  gradient.addColorStop(1, 'rgba(217, 119, 6, 0.15)');
                } else {
                  gradient.addColorStop(0, 'rgba(245, 158, 11, 0.95)');
                  gradient.addColorStop(0.5, 'rgba(217, 119, 6, 0.7)');
                  gradient.addColorStop(1, 'rgba(180, 83, 9, 0.2)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#FBBF24' : '#F59E0B',
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false,
              maxBarThickness: 38
            }
          ]
        : [
            {
              label: 'MS (Standar)',
              data: byPosition.map((p) => p.ok),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
                  gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.65)');
                  gradient.addColorStop(1, 'rgba(5, 150, 105, 0.15)');
                } else {
                  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.95)');
                  gradient.addColorStop(0.5, 'rgba(5, 150, 105, 0.65)');
                  gradient.addColorStop(1, 'rgba(4, 120, 87, 0.15)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#34D399' : '#10B981',
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false,
              maxBarThickness: 38
            },
            {
              label: 'Total Manpower',
              data: byPosition.map((p) => p.manpower),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(129, 140, 248, 0.85)');
                  gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.5)');
                  gradient.addColorStop(1, 'rgba(30, 27, 75, 0.15)');
                } else {
                  gradient.addColorStop(0, 'rgba(14, 165, 233, 0.85)');
                  gradient.addColorStop(0.5, 'rgba(30, 58, 138, 0.5)');
                  gradient.addColorStop(1, 'rgba(15, 23, 42, 0.15)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#818CF8' : '#38BDF8',
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false,
              maxBarThickness: 38
            }
          ]
  };

  const positionChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          font: boldFont,
          color: tickColor,
          padding: 16
        }
      },
      tooltip: {
        ...sharedTooltipConfig,
        callbacks: {
          label: (item: any) => {
            if (positionViewMode === 'percent') {
              return ` ${item.dataset.label}: ${item.raw}%`;
            }
            return ` ${item.dataset.label}: ${item.raw} Orang`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: commonFont, color: tickColor },
        border: { display: false }
      },
      y: {
        beginAtZero: true,
        max: positionViewMode === 'percent' ? 100 : undefined,
        grid: {
          color: gridColor,
          lineWidth: 1
        },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: commonFont,
          padding: 8,
          callback: (v: any) => (positionViewMode === 'percent' ? v + '%' : v)
        }
      }
    }
  };

  // ----------------------------------------------------
  // 2. Chart: Sebaran MS vs US per Divisi
  // ----------------------------------------------------
  const divisiChartData = {
    labels: byDivisi.map((d) => d.label),
    datasets:
      divisiViewMode === 'stacked'
        ? [
            {
              label: 'MS (Standar)',
              data: byDivisi.map((d) => d.ms),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 450, 0);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
                  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.65)');
                } else {
                  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.95)');
                  gradient.addColorStop(1, 'rgba(52, 211, 153, 0.7)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#34D399' : '#10B981',
              borderWidth: 1,
              borderRadius: { topLeft: 8, bottomLeft: 8, topRight: 0, bottomRight: 0 },
              borderSkipped: false,
              barThickness: 22
            },
            {
              label: 'US (Belum Standar)',
              data: byDivisi.map((d) => d.us),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 450, 0);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(251, 113, 133, 0.9)');
                  gradient.addColorStop(1, 'rgba(244, 63, 94, 0.55)');
                } else {
                  gradient.addColorStop(0, 'rgba(244, 63, 94, 0.85)');
                  gradient.addColorStop(1, 'rgba(251, 113, 133, 0.6)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#FB7185' : '#F43F5E',
              borderWidth: 1,
              borderRadius: { topRight: 8, bottomRight: 8, topLeft: 0, bottomLeft: 0 },
              borderSkipped: false,
              barThickness: 22
            }
          ]
        : [
            {
              label: '% Pencapaian MS',
              data: byDivisi.map((d) => {
                const total = d.ms + d.us;
                return total > 0 ? Number(((d.ms / total) * 100).toFixed(1)) : 0;
              }),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 450, 0);
                gradient.addColorStop(0, isDarkMode ? 'rgba(251, 191, 36, 0.95)' : 'rgba(245, 158, 11, 0.95)');
                gradient.addColorStop(1, isDarkMode ? 'rgba(245, 158, 11, 0.6)' : 'rgba(251, 191, 36, 0.65)');
                return gradient;
              },
              borderColor: isDarkMode ? '#FBBF24' : '#F59E0B',
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 22
            }
          ]
  };

  const horizontalStackedOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          font: boldFont,
          color: tickColor,
          padding: 16
        }
      },
      tooltip: {
        ...sharedTooltipConfig,
        callbacks: {
          label: (item: any) => {
            if (divisiViewMode === 'percent') {
              return ` ${item.dataset.label}: ${item.raw}%`;
            }
            return ` ${item.dataset.label}: ${item.raw} Karyawan`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: divisiViewMode === 'stacked',
        beginAtZero: true,
        max: divisiViewMode === 'percent' ? 100 : undefined,
        grid: {
          color: gridColor,
          lineWidth: 1
        },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: commonFont,
          padding: 8,
          callback: (v: any) => (divisiViewMode === 'percent' ? v + '%' : v)
        }
      },
      y: {
        stacked: divisiViewMode === 'stacked',
        grid: { display: false },
        border: { display: false },
        ticks: { color: tickColor, font: commonFont, padding: 6 }
      }
    }
  };

  // ----------------------------------------------------
  // 3. Chart: Sebaran MS vs US per Department
  // ----------------------------------------------------
  let processedDepts = [...byDepartment];
  if (deptSortMode === 'highest') {
    processedDepts.sort((a, b) => {
      const rateA = a.ms + a.us > 0 ? a.ms / (a.ms + a.us) : 0;
      const rateB = b.ms + b.us > 0 ? b.ms / (b.ms + b.us) : 0;
      return rateB - rateA;
    });
  }

  const deptChartData = {
    labels: processedDepts.map((d) => d.label),
    datasets:
      deptViewMode === 'stacked'
        ? [
            {
              label: 'MS (Standar)',
              data: processedDepts.map((d) => d.ms),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 450, 0);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
                  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.65)');
                } else {
                  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.95)');
                  gradient.addColorStop(1, 'rgba(52, 211, 153, 0.7)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#34D399' : '#10B981',
              borderWidth: 1,
              borderRadius: { topLeft: 8, bottomLeft: 8, topRight: 0, bottomRight: 0 },
              borderSkipped: false,
              barThickness: 16
            },
            {
              label: 'US (Belum Standar)',
              data: processedDepts.map((d) => d.us),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 450, 0);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(251, 113, 133, 0.9)');
                  gradient.addColorStop(1, 'rgba(244, 63, 94, 0.55)');
                } else {
                  gradient.addColorStop(0, 'rgba(244, 63, 94, 0.85)');
                  gradient.addColorStop(1, 'rgba(251, 113, 133, 0.6)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#FB7185' : '#F43F5E',
              borderWidth: 1,
              borderRadius: { topRight: 8, bottomRight: 8, topLeft: 0, bottomLeft: 0 },
              borderSkipped: false,
              barThickness: 16
            }
          ]
        : [
            {
              label: '% Pencapaian MS',
              data: processedDepts.map((d) => {
                const total = d.ms + d.us;
                return total > 0 ? Number(((d.ms / total) * 100).toFixed(1)) : 0;
              }),
              backgroundColor: (context: any) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 450, 0);
                if (isDarkMode) {
                  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
                  gradient.addColorStop(1, 'rgba(14, 165, 233, 0.65)');
                } else {
                  gradient.addColorStop(0, 'rgba(14, 165, 233, 0.95)');
                  gradient.addColorStop(1, 'rgba(56, 189, 248, 0.65)');
                }
                return gradient;
              },
              borderColor: isDarkMode ? '#38BDF8' : '#0EA5E9',
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 16
            }
          ]
  };

  const deptChartOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          font: boldFont,
          color: tickColor,
          padding: 16
        }
      },
      tooltip: {
        ...sharedTooltipConfig,
        callbacks: {
          label: (item: any) => {
            if (deptViewMode === 'percent') {
              return ` ${item.dataset.label}: ${item.raw}%`;
            }
            return ` ${item.dataset.label}: ${item.raw} Karyawan`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: deptViewMode === 'stacked',
        beginAtZero: true,
        max: deptViewMode === 'percent' ? 100 : undefined,
        grid: {
          color: gridColor,
          lineWidth: 1
        },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: commonFont,
          padding: 8,
          callback: (v: any) => (deptViewMode === 'percent' ? v + '%' : v)
        }
      },
      y: {
        stacked: deptViewMode === 'stacked',
        grid: { display: false },
        border: { display: false },
        ticks: { color: tickColor, font: commonFont, padding: 6 }
      }
    }
  };

  // ----------------------------------------------------
  // 4. Chart: Sebaran MS vs US per Grade
  // ----------------------------------------------------
  const gradeChartData = {
    labels: byGrade.map((g) => g.label),
    datasets: [
      {
        label: 'MS (Standar)',
        data: byGrade.map((g) => g.ms),
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          if (isDarkMode) {
            gradient.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.45)');
          } else {
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.95)');
            gradient.addColorStop(1, 'rgba(5, 150, 105, 0.55)');
          }
          return gradient;
        },
        borderColor: isDarkMode ? '#34D399' : '#10B981',
        borderWidth: 1,
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 8, bottomRight: 8 },
        borderSkipped: false,
        maxBarThickness: 34
      },
      {
        label: 'US (Belum Standar)',
        data: byGrade.map((g) => g.us),
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          if (isDarkMode) {
            gradient.addColorStop(0, 'rgba(251, 113, 133, 0.9)');
            gradient.addColorStop(1, 'rgba(244, 63, 94, 0.45)');
          } else {
            gradient.addColorStop(0, 'rgba(244, 63, 94, 0.9)');
            gradient.addColorStop(1, 'rgba(225, 29, 72, 0.55)');
          }
          return gradient;
        },
        borderColor: isDarkMode ? '#FB7185' : '#F43F5E',
        borderWidth: 1,
        borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        maxBarThickness: 34
      }
    ]
  };

  const verticalStackedOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          font: boldFont,
          color: tickColor,
          padding: 16
        }
      },
      tooltip: {
        ...sharedTooltipConfig,
        callbacks: {
          label: (item: any) => ` ${item.dataset.label}: ${item.raw} Orang`
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        border: { display: false },
        ticks: { color: tickColor, font: commonFont }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: gridColor,
          lineWidth: 1
        },
        border: { display: false },
        ticks: { color: tickColor, font: commonFont, padding: 8 }
      }
    }
  };

  // ----------------------------------------------------
  // 5. Chart: Gender Distribution Donut
  // ----------------------------------------------------
  const genderEntries = [
    { 
      label: 'Laki-laki', 
      value: genderMap.L, 
      color: isDarkMode ? '#38BDF8' : '#0E2340', 
      color2: isDarkMode ? '#0EA5E9' : '#1E3A8A' 
    },
    { 
      label: 'Perempuan', 
      value: genderMap.P, 
      color: '#F59E0B', 
      color2: '#D97706' 
    },
    { 
      label: 'Lainnya', 
      value: genderMap.Lainnya, 
      color: isDarkMode ? '#64748B' : '#94A3B8', 
      color2: isDarkMode ? '#475569' : '#64748B' 
    }
  ].filter((e) => e.value > 0);

  const totalGender = genderEntries.reduce((acc, curr) => acc + curr.value, 0);

  const genderChartData = {
    labels: genderEntries.map((e) => e.label),
    datasets: [
      {
        data: genderEntries.map((e) => e.value),
        backgroundColor: genderEntries.map((e) => e.color),
        hoverBackgroundColor: genderEntries.map((e) => e.color2),
        borderColor: isDarkMode ? '#0C1425' : '#ffffff',
        borderWidth: 3,
        hoverOffset: 4,
        spacing: 4,
        borderRadius: 6
      }
    ]
  };

  const genderChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '80%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          font: boldFont,
          color: tickColor,
          padding: 16
        }
      },
      tooltip: {
        ...sharedTooltipConfig,
        callbacks: {
          label: (item: any) => {
            const val = item.raw;
            const pct = totalGender > 0 ? ((val / totalGender) * 100).toFixed(1) : '0';
            return ` ${item.label}: ${val} Orang (${pct}%)`;
          }
        }
      }
    }
  };

  // ----------------------------------------------------
  // 6. Chart: Manpower per Job Position (Dual Bar)
  // ----------------------------------------------------
  const manpowerPositionData = {
    labels: byPosition.map((p) => p.label),
    datasets: [
      {
        label: 'Standar (MS / OK)',
        data: byPosition.map((p) => p.ok),
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          if (isDarkMode) {
            gradient.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
            gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.65)');
            gradient.addColorStop(1, 'rgba(5, 150, 105, 0.15)');
          } else {
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.95)');
            gradient.addColorStop(0.5, 'rgba(5, 150, 105, 0.65)');
            gradient.addColorStop(1, 'rgba(4, 120, 87, 0.15)');
          }
          return gradient;
        },
        borderColor: isDarkMode ? '#34D399' : '#10B981',
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 34
      },
      {
        label: 'Belum Standar (US / Not OK)',
        data: byPosition.map((p) => p.notOk),
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          if (isDarkMode) {
            gradient.addColorStop(0, 'rgba(251, 113, 133, 0.9)');
            gradient.addColorStop(0.5, 'rgba(244, 63, 94, 0.6)');
            gradient.addColorStop(1, 'rgba(225, 29, 72, 0.15)');
          } else {
            gradient.addColorStop(0, 'rgba(244, 63, 94, 0.9)');
            gradient.addColorStop(0.5, 'rgba(225, 29, 72, 0.6)');
            gradient.addColorStop(1, 'rgba(159, 18, 57, 0.15)');
          }
          return gradient;
        },
        borderColor: isDarkMode ? '#FB7185' : '#F43F5E',
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 34
      }
    ]
  };

  const manpowerPositionOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          font: boldFont,
          color: tickColor,
          padding: 16
        }
      },
      tooltip: {
        ...sharedTooltipConfig,
        callbacks: {
          label: (item: any) => ` ${item.dataset.label}: ${item.raw} Orang`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: tickColor, font: commonFont }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: gridColor,
          lineWidth: 1
        },
        border: { display: false },
        ticks: { color: tickColor, font: commonFont, padding: 8 }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* EXECUTIVE HIGHLIGHT BANNER */}
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 transition-all duration-300 ${
          isDarkMode
            ? 'bg-gradient-to-r from-[#0A192F] via-[#0E2340] to-[#122A4E] text-white shadow-2xl border border-cyan-500/25 shadow-[0_0_35px_rgba(34,211,238,0.1)]'
            : 'bg-white text-slate-900 shadow-xs border border-slate-200/90'
        }`}
      >
        <div
          className={`absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
            isDarkMode ? 'bg-cyan-500/15' : 'bg-amber-400/10'
          }`}
        />
        <div
          className={`absolute bottom-0 left-1/3 -mb-16 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
            isDarkMode ? 'bg-emerald-500/15' : 'bg-blue-400/10'
          }`}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isDarkMode
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                PT Ajinomoto Indonesia - PT Ajinex International &bull; Mojokerto
              </span>
              <span className={`text-xs hidden sm:inline ${isDarkMode ? 'text-white/40' : 'text-slate-300'}`}>&bull;</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isDarkMode
                    ? 'bg-slate-900/90 text-cyan-300 border border-cyan-400/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <i className={`fa-solid ${isDarkMode ? 'fa-moon text-cyan-300' : 'fa-sun text-amber-500'}`}></i>
                <span>{isDarkMode ? 'Mode Gelap (Midnight Cyber)' : 'Mode Terang (Daylight Pro)'}</span>
              </span>
            </div>
            <h2 className={`text-lg sm:text-xl font-display font-extrabold tracking-tight flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              <span>Ringkasan Eksekutif Pemantauan Multi-Skill</span>
            </h2>
            <p className={`text-xs max-w-2xl leading-relaxed ${
              isDarkMode ? 'text-white/80' : 'text-slate-600'
            }`}>
              Pemantauan kompetensi 92 keahlian operasional seluruh insan Ajinomoto lintas divisi, departemen, dan level jabatan di Pabrik Mojokerto. Standar kelulusan minimum: Dept. Manager up (&ge;4 seksi) &middot; ASM-SM (&ge;3 seksi) &middot; LL-Foreman (&ge;2 seksi).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className={`px-4 py-2.5 rounded-2xl border backdrop-blur-md shadow-xs ${
              isDarkMode
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-slate-50 border-slate-200/80 text-slate-800'
            }`}>
              <p className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Target Pabrik</p>
              <p className="text-base font-black text-amber-600 dark:text-amber-300">80.0%</p>
            </div>
            <div className={`px-4 py-2.5 rounded-2xl border backdrop-blur-md shadow-xs ${
              isDarkMode
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-slate-50 border-slate-200/80 text-slate-800'
            }`}>
              <p className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Divisi Terbaik</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-300">{topDivisi ? topDivisi.label : '-'}</p>
            </div>
            <div className={`px-4 py-2.5 rounded-2xl border backdrop-blur-md shadow-xs ${
              isDarkMode
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-slate-50 border-slate-200/80 text-slate-800'
            }`}>
              <p className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Pencapaian Tertinggi</p>
              <p className="text-base font-black text-slate-900 dark:text-white">{topDivisiRate}</p>
            </div>

            {onOpenPdfModal && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={onOpenPdfModal}
                className="px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer bg-red-600 hover:bg-red-700 text-white"
                title="Cetak & Unduh Laporan PDF Resmi Standar PT Ajinomoto Indonesia"
              >
                <i className="fa-solid fa-file-pdf text-sm"></i>
                <span className="hidden sm:inline">Cetak Laporan PDF</span>
                <span className="sm:hidden">PDF</span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* 4 STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Manpower */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -5, scale: 1.018, transition: { duration: 0.2 } }}
          className="relative overflow-hidden rounded-3xl p-5 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Karyawan
              </p>
              <h3 className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                {totalManpower.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Terdaftar</span> dalam periode aktif
              </p>
            </div>
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform shrink-0 ${
              isDarkMode
                ? 'text-white bg-gradient-to-br from-[#0E2340] to-[#1E3A8A] border border-cyan-500/20'
                : 'text-blue-700 bg-blue-50 border border-blue-200/80'
            }`}>
              <i className="fa-solid fa-users text-lg"></i>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Cakupan Pemantauan</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{byDivisi.length} Divisi &bull; {byDepartment.length} Dept</span>
          </div>
        </motion.div>

        {/* Card 2: Standar MS/OK */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -5, scale: 1.018, transition: { duration: 0.2 } }}
          className="relative overflow-hidden rounded-3xl p-5 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Memenuhi Standar (MS)
              </p>
              <h3 className="text-3xl font-display font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
                {totalMS.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{pctFormatted}</span> dari total karyawan
              </p>
            </div>
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform shrink-0 ${
              isDarkMode
                ? 'text-white bg-gradient-to-br from-emerald-500 to-teal-700 border border-emerald-500/30'
                : 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
            }`}>
              <i className="fa-solid fa-circle-check text-lg"></i>
            </div>
          </div>
          {/* Mini Progress Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                style={{ width: `${Math.min(percentMS * 100, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Card 3: Belum Standar US/Not OK */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -5, scale: 1.018, transition: { duration: 0.2 } }}
          className="relative overflow-hidden rounded-3xl p-5 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Dalam Pengembangan (US)
              </p>
              <h3 className="text-3xl font-display font-black text-rose-600 dark:text-rose-400 mt-1 tracking-tight">
                {totalUS.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {totalManpower > 0 ? ((totalUS / totalManpower) * 100).toFixed(1) + '%' : '0%'}
                </span>{' '}
                dalam rencana pembinaan
              </p>
            </div>
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform shrink-0 ${
              isDarkMode
                ? 'text-white bg-gradient-to-br from-rose-500 to-red-700 border border-rose-500/30'
                : 'text-rose-700 bg-rose-50 border border-rose-200/80'
            }`}>
              <i className="fa-solid fa-circle-exclamation text-lg"></i>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Target Pengembangan</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">Gap: {totalUS} Orang</span>
          </div>
        </motion.div>

        {/* Card 4: % Pencapaian Multi-Skill */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -5, scale: 1.018, transition: { duration: 0.2 } }}
          className="relative overflow-hidden rounded-3xl p-5 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pencapaian Multi-Skill
              </p>
              <h3 className="text-3xl font-display font-black text-amber-600 dark:text-amber-400 mt-1 tracking-tight">
                {pctFormatted}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                {isTargetAchieved ? (
                  <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                    <i className="fa-solid fa-check mr-1 text-[10px]"></i>Target Tercapai ({targetOverall}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center text-amber-700 dark:text-amber-400 font-bold">
                    <i className="fa-solid fa-arrow-trend-up mr-1 text-[10px]"></i>Gap {gapToTarget}% ke Target 80%
                  </span>
                )}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform shrink-0 ${
              isDarkMode
                ? 'text-slate-950 font-black bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border border-amber-400/40'
                : 'text-amber-800 bg-amber-50 border border-amber-200/80 font-black'
            }`}>
              <i className="fa-solid fa-trophy text-lg"></i>
            </div>
          </div>
          {/* Progress bar vs 80% KPI target */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="relative w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                style={{ width: `${Math.min(percentMS * 100, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ROW 1: Target vs Result & MS/US per Divisi */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Target vs Result per Position */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-dashed border-slate-200 dark:border-white/10 gap-3">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isDarkMode
                  ? 'text-white bg-gradient-to-br from-[#0E2340] to-[#1E3A8A] border border-cyan-500/20'
                  : 'text-amber-800 bg-amber-50 border border-amber-200/80'
              }`}>
                <i className="fa-solid fa-bullseye text-sm"></i>
              </div>
              <div>
                <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Target vs Result per Job Position
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dept. Manager up (&ge;4 seksi) &middot; ASM-SM (&ge;3 seksi) &middot; LL-Foreman (&ge;2 seksi)
                </p>
              </div>
            </div>

            {/* View Mode Toggle Switch */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setPositionViewMode('percent')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  positionViewMode === 'percent'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Persentase (%)
              </button>
              <button
                type="button"
                onClick={() => setPositionViewMode('count')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  positionViewMode === 'count'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Headcount (Org)
              </button>
            </div>
          </div>

          <div className="h-72">
            <Bar data={positionChartData} options={positionChartOptions} />
          </div>
        </motion.div>

        {/* Chart 2: Sebaran MS vs US per Divisi */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-dashed border-slate-200 dark:border-white/10 gap-3">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isDarkMode
                  ? 'text-slate-950 font-bold bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border border-amber-400/40'
                  : 'text-amber-800 bg-amber-50 border border-amber-200/80 font-bold'
              }`}>
                <i className="fa-solid fa-sitemap text-sm"></i>
              </div>
              <div>
                <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Sebaran MS vs US per Divisi
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Jumlah karyawan Multi-Skill (MS) dan belum standar (US)
                </p>
              </div>
            </div>

            {/* View Mode Toggle Switch */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setDivisiViewMode('stacked')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  divisiViewMode === 'stacked'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Stacked (MS/US)
              </button>
              <button
                type="button"
                onClick={() => setDivisiViewMode('percent')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  divisiViewMode === 'percent'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                % Capaian
              </button>
            </div>
          </div>

          <div className="h-72">
            <Bar data={divisiChartData} options={horizontalStackedOptions} />
          </div>
        </motion.div>
      </div>

      {/* ROW 2: per Department & per Grade */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 3: per Department */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-dashed border-slate-200 dark:border-white/10 gap-3">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isDarkMode
                  ? 'text-white bg-gradient-to-br from-blue-500 to-sky-700'
                  : 'text-blue-700 bg-blue-50 border border-blue-200/80'
              }`}>
                <i className="fa-solid fa-building text-sm"></i>
              </div>
              <div>
                <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Sebaran MS vs US per Department
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perbandingan pencapaian antar departemen di pabrik
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setDeptViewMode('stacked')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition cursor-pointer ${
                    deptViewMode === 'stacked'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Stacked
                </button>
                <button
                  type="button"
                  onClick={() => setDeptViewMode('percent')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition cursor-pointer ${
                    deptViewMode === 'percent'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  % Capaian
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDeptSortMode(deptSortMode === 'default' ? 'highest' : 'default')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-2xl border transition cursor-pointer flex items-center gap-1.5 ${
                  deptSortMode === 'highest'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title="Urutkan berdasarkan capaian tertinggi"
              >
                <i className="fa-solid fa-arrow-down-wide-short text-[10px]"></i>
                <span>{deptSortMode === 'highest' ? 'Top Rate' : 'Urut Nama'}</span>
              </button>
            </div>
          </div>

          <div className="h-80">
            <Bar data={deptChartData} options={deptChartOptions} />
          </div>
        </motion.div>

        {/* Chart 4: per Grade */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-dashed border-slate-200 dark:border-white/10 gap-3">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isDarkMode
                  ? 'text-emerald-400 bg-gradient-to-br from-[#0E2340] to-[#1E3A8A]'
                  : 'text-purple-700 bg-purple-50 border border-purple-200/80'
              }`}>
                <i className="fa-solid fa-layer-group text-sm"></i>
              </div>
              <div>
                <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Sebaran MS vs US per Grade Karyawan
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribusi pencapaian dari tingkat Managerial (M5) hingga Staff (ST1)
                </p>
              </div>
            </div>

            <div className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-bold">
              {byGrade.length} Grade Level
            </div>
          </div>

          <div className="h-80">
            <Bar data={gradeChartData} options={verticalStackedOptions} />
          </div>
        </motion.div>
      </div>

      {/* ROW 3: Gender distribution & Job Category headcount */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart 5: Gender Donut */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow xl:col-span-1"
        >
          <div className="flex items-start gap-3 pb-4 mb-4 border-b border-dashed border-slate-200 dark:border-white/10">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isDarkMode
                ? 'text-slate-950 font-bold bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600'
                : 'text-amber-800 bg-amber-50 border border-amber-200/80'
            }`}>
              <i className="fa-solid fa-venus-mars text-sm"></i>
            </div>
            <div>
              <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Komposisi Gender L/P
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Distribusi gender karyawan terfilter
              </p>
            </div>
          </div>

          <div className="h-64 relative flex items-center justify-center">
            {genderEntries.length > 0 ? (
              <>
                <Doughnut data={genderChartData} options={genderChartOptions} />
                {/* Center Badge in Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                  <span className="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                    {totalGender}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Karyawan
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">Tidak ada data</p>
            )}
          </div>
        </motion.div>

        {/* Chart 6: Manpower per Job Position */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl hover:shadow-md transition-shadow xl:col-span-2"
        >
          <div className="flex items-start gap-3 pb-4 mb-4 border-b border-dashed border-slate-200 dark:border-white/10">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isDarkMode
                ? 'text-white bg-gradient-to-br from-emerald-500 to-teal-700'
                : 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
            }`}>
              <i className="fa-solid fa-id-badge text-sm"></i>
            </div>
            <div>
              <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Manpower per Job Position
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Jumlah karyawan berstatus OK (MS) dan Not OK (US) pada tiap kelompok jabatan
              </p>
            </div>
          </div>

          <div className="h-64">
            <Bar data={manpowerPositionData} options={manpowerPositionOptions} />
          </div>
        </motion.div>
      </div>

      {/* LOG NOTES & OPERATIONAL STANDARDS */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-xs dark:shadow-xl"
      >
        <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-dashed border-slate-200 dark:border-white/10">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center text-amber-900 dark:text-amber-300 bg-amber-400/20 border border-amber-400/30 shrink-0">
            <i className="fa-regular fa-note-sticky text-xs"></i>
          </div>
          <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
            Catatan Log Sistem &amp; Standar Operasional Pabrik
          </h4>
        </div>

        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 pl-1">
          {notes.map((note, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
              <span>{note}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-1.5">
            <i className="fa-regular fa-clock text-amber-500"></i>
            <span>Terakhir diperbarui:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{updatedFormatted}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            HRD &amp; Continuous Improvement Department &bull; Mojokerto Plant
          </span>
        </div>
      </motion.div>
    </div>
  );
};
