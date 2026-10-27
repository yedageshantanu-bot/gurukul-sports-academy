import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  Printer,
  Sparkles,
  UserCheck,
  Layers,
  Medal,
  Copy,
  Eye,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Palette,
  Settings2,
  Tag,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { useToast } from '../../contexts/ToastContext';

// Default martial arts belt & sash categories
// Default martial arts belt & sash categories (Official Gurukul syllabus aligned)
export const DEFAULT_BELT_CATEGORIES = [
  // Standard Karate & Martial Arts Belts
  { id: 'yellow-belt', name: 'Yellow', group: 'Official Belts' },
  { id: 'orange-belt', name: 'Orange', group: 'Official Belts' },
  { id: 'blue-belt', name: 'Blue', group: 'Official Belts' },
  { id: 'green-belt', name: 'Green', group: 'Official Belts' },
  { id: 'maroon-belt', name: 'Maroon', group: 'Official Belts' },
  { id: 'purple-ii-belt', name: 'Purple II', group: 'Official Belts' },
  { id: 'purple-i-belt', name: 'Purple I', group: 'Official Belts' },
  { id: 'brown-iii-belt', name: 'Brown III', group: 'Official Belts' },
  { id: 'brown-ii-belt', name: 'Brown II', group: 'Official Belts' },
  { id: 'brown-i-belt', name: 'Brown I', group: 'Official Belts' },
  { id: 'black-belt', name: 'Black', group: 'Official Belts' },

  // Traditional Kalari Sashes
  { id: 'yellow-sash', name: 'Yellow Sash', group: 'Kalari Sashes' },
  { id: 'orange-sash', name: 'Orange Sash', group: 'Kalari Sashes' },
  { id: 'blue-sash', name: 'Blue Sash', group: 'Kalari Sashes' },
  { id: 'green-sash', name: 'Green Sash', group: 'Kalari Sashes' },
  { id: 'maroon-sash', name: 'Maroon Sash', group: 'Kalari Sashes' },
  { id: 'purple-ii-sash', name: 'Purple Sash II', group: 'Kalari Sashes' },
  { id: 'purple-i-sash', name: 'Purple Sash I', group: 'Kalari Sashes' },
  { id: 'brown-iii-sash', name: 'Brown Sash III', group: 'Kalari Sashes' },
  { id: 'brown-ii-sash', name: 'Brown Sash II', group: 'Kalari Sashes' },
  { id: 'brown-i-sash', name: 'Brown Sash I', group: 'Kalari Sashes' },
  { id: 'black-sash', name: 'Black Sash', group: 'Kalari Sashes' },

  // Foundation & Kyu Grades
  { id: 'white-belt', name: 'White Belt', group: 'Foundation Grades' },
  { id: 'white-sash', name: 'White Sash', group: 'Foundation Grades' },
  { id: 'red-belt', name: 'Red Belt', group: 'Specialty Ranks' },
  { id: 'gold-belt', name: 'Gold Belt', group: 'Specialty Ranks' },
];

// Belt badge color styling helper
export const getBeltBadgeClass = (color: string) => {
  const c = (color || '').toLowerCase().trim();

  // Dual combinations (e.g. "White & Yellow", "Green & Blue", "Blue & Brown")
  if (c.includes('&') || c.includes('/')) {
    if (c.includes('white') && c.includes('yellow')) return 'bg-gradient-to-r from-slate-200/20 to-yellow-500/20 text-yellow-200 border-yellow-400/40 shadow-sm';
    if (c.includes('yellow') && c.includes('orange')) return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-amber-200 border-amber-400/40 shadow-sm';
    if (c.includes('green') && c.includes('blue')) return 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-teal-200 border-teal-400/40 shadow-sm';
    if (c.includes('blue') && c.includes('brown')) return 'bg-gradient-to-r from-blue-500/20 to-amber-800/30 text-sky-200 border-sky-400/40 shadow-sm';
    if (c.includes('brown') && c.includes('black')) return 'bg-gradient-to-r from-amber-900/40 to-slate-900/60 text-amber-200 border-amber-700/50 shadow-sm';
    return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-200 border-purple-400/40 shadow-sm';
  }

  if (c.includes('gold')) return 'bg-amber-400/25 text-amber-200 border-amber-400/60 shadow-sm shadow-amber-500/10';
  if (c.includes('camo')) return 'bg-emerald-800/30 text-emerald-200 border-emerald-700/50';
  if (c.includes('black') || c.includes('dan')) return 'bg-slate-950/90 text-amber-300 border-amber-500/40 shadow-sm';
  if (c.includes('brown')) return 'bg-amber-950/60 text-amber-200 border-amber-700/60';
  if (c.includes('maroon')) return 'bg-rose-950/70 text-rose-200 border-rose-700/60 shadow-sm';
  if (c.includes('purple')) return 'bg-purple-900/40 text-purple-200 border-purple-600/50 shadow-sm';
  if (c.includes('blue')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  if (c.includes('green') || c.includes('emerald')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (c.includes('orange')) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (c.includes('yellow')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (c.includes('red') || c.includes('rose')) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (c.includes('white') || c.includes('silver')) return 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 shadow-sm';

  return 'bg-slate-800/60 text-slate-200 border-white/20';
};

interface MartialRank {
  id: string;
  discipline_code: string;
  rank_order: number;
  rank_name: string;
  belt_color: string;
  description: string | null;
  syllabus?: string | null;
}

interface Discipline {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ranks?: MartialRank[];
}

interface StudentRank {
  id: string;
  student_id: string;
  student_name: string;
  student_code?: string;
  dob?: string;
  contact_number: string;
  discipline_code: string;
  discipline_name?: string;
  current_rank_name: string;
  belt_color: string;
  rank_order: number;
  promoted_at: string;
  certificate_number: string | null;
  nextRank?: MartialRank | null;
}

interface CertificateRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  dob: string;
  contact_number: string;
  discipline_code: string;
  discipline_name: string;
  from_rank_name: string | null;
  to_rank_name: string;
  belt_color: string;
  promoted_at: string;
  certificate_number: string;
  examiner_name: string;
  represented_from: string;
  notes: string | null;
  fatherName?: string;
  parentName?: string;
  parent_name?: string;
  father_name?: string;
}

export const RanksPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'STUDENTS' | 'CERTIFICATES' | 'CURRICULUM'>('STUDENTS');
  const [studentRanks, setStudentRanks] = useState<StudentRank[]>([]);
  const [allRanks, setAllRanks] = useState<MartialRank[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');
  // Card-level active discipline toggle for dual-discipline students (1 card per student)
  const [cardActiveDisciplines, setCardActiveDisciplines] = useState<Record<string, string>>({});

  // Discipline Section Management
  const [isDisciplineModalOpen, setIsDisciplineModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null);
  const [disciplineForm, setDisciplineForm] = useState({ name: '', description: '' });
  const [savingDiscipline, setSavingDiscipline] = useState(false);

  // Certificate Registry Date Filter States
  const [certStartDate, setCertStartDate] = useState('');
  const [certEndDate, setCertEndDate] = useState('');
  const [certDisciplineFilter, setCertDisciplineFilter] = useState('ALL');
  const [certSearchTerm, setCertSearchTerm] = useState('');
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);

  // Modals
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [selectedStudentForPromotion, setSelectedStudentForPromotion] = useState<StudentRank | null>(null);
  const [promotionTargetRankId, setPromotionTargetRankId] = useState('');
  const [examinerName, setExaminerName] = useState('Chief Master (Gurukul Academy)');
  const [representedFrom, setRepresentedFrom] = useState('Gurukul Sports Academy Central Dojo');
  const [promoting, setPromoting] = useState(false);

  // Assign Student Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [academyStudents, setAcademyStudents] = useState<Array<{ id: string; fullName: string; contactNumber: string; dob?: string }>>([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignDiscipline, setAssignDiscipline] = useState('KALARIPPAYATTU');
  const [assignRankName, setAssignRankName] = useState('Beginner');

  // Belt Rank Edit/Create Modal State
  const [isBeltModalOpen, setIsBeltModalOpen] = useState(false);
  const [editingBeltRank, setEditingBeltRank] = useState<MartialRank | null>(null);
  const [beltForm, setBeltForm] = useState({
    disciplineCode: 'KALARIPPAYATTU',
    rankOrder: 1,
    rankName: '',
    beltColor: 'Yellow',
    description: '',
    syllabus: '',
  });
  const [savingBelt, setSavingBelt] = useState(false);

  // Preview Certificate Modal (Clean Excel Tabular View)
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);

  // Export full certificate registry to Excel CSV spreadsheet
  const exportCertificatesToCsv = () => {
    const list = filteredCertificates.length > 0 ? filteredCertificates : certificates;
    if (list.length === 0) {
      toast.error('No certificate records available to export.');
      return;
    }

    const headers = [
      'Sr No',
      'Athlete Reg No',
      'Student Full Name',
      'Parent / Guardian Name',
      'Parent WhatsApp / Phone',
      'Date of Birth (DOB)',
      'Martial Arts Discipline',
      'From Rank (Previous Belt)',
      'To Rank (Promoted Belt)',
      'Belt Color',
      'Exam / Promotion Date',
      'Certificate Number',
      'Represented From',
      'Chief Examiner Name',
    ];

    const rows = list.map((cert, index) => [
      index + 1,
      cert.student_code || 'GSA-ATH',
      cert.student_name,
      cert.parent_name || cert.fatherName || '',
      cert.contact_number || '',
      cert.dob && !isNaN(new Date(cert.dob).getTime()) ? new Date(cert.dob).toLocaleDateString('en-IN') : '',
      cert.discipline_name || cert.discipline_code,
      cert.from_rank_name || 'Beginner',
      cert.to_rank_name,
      cert.belt_color,
      cert.promoted_at && !isNaN(new Date(cert.promoted_at).getTime()) ? new Date(cert.promoted_at).toLocaleDateString('en-IN') : '',
      cert.certificate_number,
      cert.represented_from || 'Gurukul Sports Academy',
      cert.examiner_name || 'Chief Master',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row
            .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gurukul_Promotion_Belt_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} certificate promotion records to Excel CSV!`);
  };

  // Export single certificate record to Excel CSV
  const exportSingleCertificateToCsv = (cert: CertificateRecord) => {
    const headers = [
      'Athlete Reg No',
      'Student Full Name',
      'Parent / Guardian Name',
      'Parent WhatsApp / Phone',
      'Date of Birth (DOB)',
      'Martial Arts Discipline',
      'From Rank (Previous Belt)',
      'To Rank (Promoted Belt)',
      'Belt Color',
      'Exam / Promotion Date',
      'Certificate Number',
      'Represented From',
      'Chief Examiner Name',
    ];

    const row = [
      cert.student_code || 'GSA-ATH',
      cert.student_name,
      cert.parent_name || cert.fatherName || '',
      cert.contact_number || '',
      cert.dob && !isNaN(new Date(cert.dob).getTime()) ? new Date(cert.dob).toLocaleDateString('en-IN') : '',
      cert.discipline_name || cert.discipline_code,
      cert.from_rank_name || 'Beginner',
      cert.to_rank_name,
      cert.belt_color,
      cert.promoted_at && !isNaN(new Date(cert.promoted_at).getTime()) ? new Date(cert.promoted_at).toLocaleDateString('en-IN') : '',
      cert.certificate_number,
      cert.represented_from || 'Gurukul Sports Academy',
      cert.examiner_name || 'Chief Master',
    ];

    const csvContent =
      '\uFEFF' +
      [headers, row]
        .map((r) =>
          r
            .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const studentSafe = (cert.student_name || 'Athlete').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    link.setAttribute('download', `Gurukul_Certificate_${studentSafe}_Excel.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cert.student_name}'s record to Excel (CSV)!`);
  };

  // Copy records to clipboard as tab-delimited text for 1-click paste into Excel
  const copyCertificatesToClipboard = (listToCopy?: CertificateRecord[]) => {
    const list = listToCopy || (filteredCertificates.length > 0 ? filteredCertificates : certificates);
    if (list.length === 0) {
      toast.warning('No records to copy.');
      return;
    }

    const headers = [
      'Athlete Reg No',
      'Student Full Name',
      'Parent / Guardian Name',
      'Parent WhatsApp / Phone',
      'Date of Birth (DOB)',
      'Martial Arts Discipline',
      'From Rank (Previous Belt)',
      'To Rank (Promoted Belt)',
      'Belt Color',
      'Exam / Promotion Date',
      'Certificate Number',
      'Represented From',
      'Chief Examiner Name',
    ];

    const rows = list.map((cert) => [
      cert.student_code || 'GSA-ATH',
      cert.student_name,
      cert.parent_name || cert.fatherName || '',
      cert.contact_number || '',
      cert.dob && !isNaN(new Date(cert.dob).getTime()) ? new Date(cert.dob).toLocaleDateString('en-IN') : '',
      cert.discipline_name || cert.discipline_code,
      cert.from_rank_name || 'Beginner',
      cert.to_rank_name,
      cert.belt_color,
      cert.promoted_at && !isNaN(new Date(cert.promoted_at).getTime()) ? new Date(cert.promoted_at).toLocaleDateString('en-IN') : '',
      cert.certificate_number,
      cert.represented_from || 'Gurukul Sports Academy',
      cert.examiner_name || 'Chief Master',
    ]);

    const tsvContent = [headers, ...rows]
      .map((r) => r.map((c) => String(c ?? '').replace(/\t/g, ' ')).join('\t'))
      .join('\n');

    navigator.clipboard.writeText(tsvContent).then(
      () => toast.success(`Copied ${list.length} row(s) to clipboard! Paste directly into Excel with Ctrl+V.`),
      () => toast.error('Could not copy to clipboard. Please use Export to Excel.')
    );
  };

  // Belt Category Management State
  const [customBeltCategories, setCustomBeltCategories] = useState<Array<{ id: string; name: string; group: string; isCustom?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('gurukul_custom_belt_categories');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load custom belt categories:', e);
    }
    return DEFAULT_BELT_CATEGORIES;
  });

  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryGroup, setNewCategoryGroup] = useState('Custom / Academy');
  const [isCustomColorInput, setIsCustomColorInput] = useState(false);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.warning('Please enter a belt category name');
      return;
    }
    if (customBeltCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.info(`Category "${trimmed}" already exists.`);
      return;
    }
    const newCat = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      group: newCategoryGroup || 'Custom / Academy',
      isCustom: true,
    };
    const updated = [...customBeltCategories, newCat];
    setCustomBeltCategories(updated);
    try {
      localStorage.setItem('gurukul_custom_belt_categories', JSON.stringify(updated));
    } catch (e) {}
    toast.success(`Belt category "${trimmed}" added successfully!`);
    setNewCategoryName('');
  };

  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; group: string } | null>(null);

  const handleDeleteCategory = (catId: string, catName: string) => {
    if (!window.confirm(`Are you sure you want to remove belt category "${catName}"?`)) return;
    const updated = customBeltCategories.filter((c) => c.id !== catId);
    setCustomBeltCategories(updated);
    try {
      localStorage.setItem('gurukul_custom_belt_categories', JSON.stringify(updated));
    } catch (e) {}
    toast.success(`Category "${catName}" deleted.`);
  };

  const handleMoveCategory = (catId: string, direction: 'UP' | 'DOWN') => {
    const index = customBeltCategories.findIndex((c) => c.id === catId);
    if (index === -1) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customBeltCategories.length) return;

    const updated = [...customBeltCategories];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    setCustomBeltCategories(updated);
    try {
      localStorage.setItem('gurukul_custom_belt_categories', JSON.stringify(updated));
    } catch (e) {}
    toast.success(`Category sequence (kram) updated!`);
  };

  const handleSaveEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;
    const trimmed = editingCategory.name.trim();
    const updated = customBeltCategories.map((c) =>
      c.id === editingCategory.id
        ? { ...c, name: trimmed, group: editingCategory.group }
        : c
    );
    setCustomBeltCategories(updated);
    try {
      localStorage.setItem('gurukul_custom_belt_categories', JSON.stringify(updated));
    } catch (e) {}
    toast.success(`Category "${trimmed}" updated!`);
    setEditingCategory(null);
  };

  const handleMoveRankOrder = async (rank: MartialRank, direction: 'UP' | 'DOWN') => {
    const disciplineRanks = allRanks
      .filter((r) => r.discipline_code === rank.discipline_code)
      .sort((a, b) => a.rank_order - b.rank_order);

    const currentIndex = disciplineRanks.findIndex((r) => r.id === rank.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= disciplineRanks.length) return;

    const targetRank = disciplineRanks[targetIndex];

    try {
      const currentOrder = rank.rank_order;
      const targetOrder = targetRank.rank_order;

      // Optimistic update
      setAllRanks((prev) =>
        prev.map((r) => {
          if (r.id === rank.id) return { ...r, rank_order: targetOrder };
          if (r.id === targetRank.id) return { ...r, rank_order: currentOrder };
          return r;
        })
      );

      await Promise.all([
        apiClient(`/ranks/${rank.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ rankOrder: targetOrder }),
        }),
        apiClient(`/ranks/${targetRank.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ rankOrder: currentOrder }),
        }),
      ]);

      toast.success(`Kram (order) updated for "${rank.rank_name}"!`);
      await fetchRanks();
    } catch (err: any) {
      toast.error('Failed to update rank order');
      await fetchRanks();
    }
  };

  const handleResetCategories = () => {
    if (!window.confirm('Reset belt categories to academy default set?')) return;
    setCustomBeltCategories(DEFAULT_BELT_CATEGORIES);
    try {
      localStorage.setItem('gurukul_custom_belt_categories', JSON.stringify(DEFAULT_BELT_CATEGORIES));
    } catch (e) {}
    toast.success('Belt categories reset to default.');
  };

  const handleOpenAddBelt = (disciplineCode: string = 'KALARIPPAYATTU') => {
    setEditingBeltRank(null);
    const existingRanks = allRanks.filter((r) => r.discipline_code === disciplineCode);
    const maxOrder = existingRanks.reduce((max, r) => Math.max(max, r.rank_order), 0);
    setIsCustomColorInput(false);

    setBeltForm({
      disciplineCode,
      rankOrder: maxOrder + 1,
      rankName: '',
      beltColor: 'Yellow',
      description: '',
      syllabus: '',
    });
    setIsBeltModalOpen(true);
  };

  const handleOpenEditBelt = (rank: MartialRank) => {
    setEditingBeltRank(rank);
    const matchesPreset = customBeltCategories.some(
      (c) => c.name.toLowerCase() === (rank.belt_color || '').toLowerCase()
    );
    setIsCustomColorInput(!matchesPreset);
    setBeltForm({
      disciplineCode: rank.discipline_code,
      rankOrder: rank.rank_order,
      rankName: rank.rank_name,
      beltColor: rank.belt_color,
      description: rank.description || '',
      syllabus: rank.syllabus || '',
    });
    setIsBeltModalOpen(true);
  };

  const handleSaveBelt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beltForm.rankName.trim()) {
      toast.error('Rank / Belt name is required');
      return;
    }
    setSavingBelt(true);
    try {
      if (editingBeltRank) {
        await apiClient(`/ranks/${editingBeltRank.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            rankOrder: Number(beltForm.rankOrder),
            rankName: beltForm.rankName.trim(),
            beltColor: beltForm.beltColor.trim(),
            description: beltForm.description.trim() || undefined,
            syllabus: beltForm.syllabus.trim() || undefined,
          }),
        });
        toast.success(`Belt rank "${beltForm.rankName}" updated successfully!`);
      } else {
        await apiClient('/ranks', {
          method: 'POST',
          body: JSON.stringify({
            disciplineCode: beltForm.disciplineCode,
            rankOrder: Number(beltForm.rankOrder),
            rankName: beltForm.rankName.trim(),
            beltColor: beltForm.beltColor.trim(),
            description: beltForm.description.trim() || undefined,
            syllabus: beltForm.syllabus.trim() || undefined,
          }),
        });
        toast.success(`New belt rank "${beltForm.rankName}" created successfully!`);
      }
      setIsBeltModalOpen(false);
      setEditingBeltRank(null);
      await fetchRanks();
      await fetchDisciplines();
      await fetchStudentRanks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save belt rank');
    } finally {
      setSavingBelt(false);
    }
  };

  const handleDeleteBelt = async (rank: MartialRank) => {
    if (!window.confirm(`Are you sure you want to remove "${rank.rank_name}"?`)) return;
    try {
      await apiClient(`/ranks/${rank.id}`, { method: 'DELETE' });
      toast.success(`Belt rank "${rank.rank_name}" deleted.`);
      await fetchRanks();
      await fetchDisciplines();
      await fetchStudentRanks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete belt rank');
    }
  };

  // Discipline Section Handlers
  const handleOpenAddDiscipline = () => {
    setEditingDiscipline(null);
    setDisciplineForm({ name: '', description: '' });
    setIsDisciplineModalOpen(true);
  };

  const handleOpenEditDiscipline = (disc: Discipline) => {
    setEditingDiscipline(disc);
    setDisciplineForm({ name: disc.name, description: disc.description || '' });
    setIsDisciplineModalOpen(true);
  };

  const handleSaveDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disciplineForm.name.trim()) {
      toast.warning('Discipline name is required');
      return;
    }
    setSavingDiscipline(true);
    try {
      if (editingDiscipline) {
        await apiClient(`/ranks/disciplines/${editingDiscipline.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: disciplineForm.name.trim(),
            description: disciplineForm.description.trim() || undefined,
          }),
        });
        toast.success(`Discipline "${disciplineForm.name}" updated successfully!`);
      } else {
        await apiClient('/ranks/disciplines', {
          method: 'POST',
          body: JSON.stringify({
            name: disciplineForm.name.trim(),
            description: disciplineForm.description.trim() || undefined,
          }),
        });
        toast.success(`New section "${disciplineForm.name}" created! You can now add belts.`);
      }
      setIsDisciplineModalOpen(false);
      setEditingDiscipline(null);
      setDisciplineForm({ name: '', description: '' });
      await fetchDisciplines();
      await fetchRanks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save discipline');
    } finally {
      setSavingDiscipline(false);
    }
  };

  const handleDeleteDiscipline = async (disc: Discipline) => {
    if (!window.confirm(`Are you sure you want to delete the "${disc.name}" section and all its belts?`)) return;
    try {
      await apiClient(`/ranks/disciplines/${disc.id}`, { method: 'DELETE' });
      toast.success(`Discipline "${disc.name}" deleted successfully.`);
      await fetchDisciplines();
      await fetchRanks();
      await fetchStudentRanks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete discipline');
    }
  };


  // Fetch initial student ranks
  const fetchStudentRanks = async () => {
    try {
      setLoading(true);
      const res = await apiClient<any>('/ranks/students');
      const list = Array.isArray(res) ? res : res?.data || [];
      setStudentRanks(list);
    } catch (err) {
      console.error('Failed to load student ranks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all martial arts rank definitions
  const fetchRanks = async () => {
    try {
      const res = await apiClient<any>('/ranks/list');
      const list = Array.isArray(res) ? res : res?.data || [];
      setAllRanks(list);
    } catch (err) {
      console.error('Failed to load ranks list:', err);
    }
  };

  // Fetch all martial arts disciplines / sections
  const fetchDisciplines = async () => {
    try {
      const res = await apiClient<any>('/ranks/disciplines');
      const list = Array.isArray(res) ? res : res?.data || [];
      setDisciplines(list);
    } catch (err) {
      console.error('Failed to load disciplines:', err);
    }
  };

  // Fetch academy students
  const fetchAcademyStudents = async () => {
    try {
      const res = await apiClient<any>('/students');
      const list = Array.isArray(res) ? res : res?.data || [];
      setAcademyStudents(
        list.map((s: any) => ({
          id: s.id,
          fullName: s.fullName || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
          contactNumber: s.contactNumber || s.phone || '',
          dob: s.dob || s.dateOfBirth || '',
        }))
      );
    } catch (err) {
      console.error('Failed to load academy students:', err);
    }
  };

  // Fetch certificates with user-specified date range filter
  const fetchCertificates = async () => {
    try {
      setLoadingCerts(true);
      const params = new URLSearchParams();
      if (certStartDate) params.append('startDate', certStartDate);
      if (certEndDate) params.append('endDate', certEndDate);
      if (certDisciplineFilter !== 'ALL') {
        params.append('discipline', certDisciplineFilter);
        params.append('discipline_code', certDisciplineFilter);
      }

      const res = await apiClient<any>(`/ranks/certificates?${params.toString()}`);
      const rawList = Array.isArray(res) ? res : res?.certificates || res?.data?.certificates || res?.data || [];
      
      const normalizedList = rawList.map((r: any) => ({
        id: r.id || `cert-${Math.random()}`,
        student_id: r.student_id || r.studentId || '',
        student_name: r.student_name || r.playerName || 'Athlete Trainee',
        student_code: r.student_code || r.regNumber || 'GSA-ATH',
        fatherName: r.parent_name || r.fatherName || r.parentName || r.father_name || '',
        parentName: r.parent_name || r.fatherName || r.parentName || r.father_name || '',
        parent_name: r.parent_name || r.fatherName || r.parentName || r.father_name || '',
        father_name: r.parent_name || r.fatherName || r.parentName || r.father_name || '',
        dob: r.dob || '2012-05-14',
        contact_number: r.contact_number || r.parentWhatsapp || r.parent_whatsapp || r.student_mobile || '',
        discipline_code: r.discipline_code || r.disciplineCode || 'MARTIAL_ARTS',
        discipline_name: r.discipline_name || r.disciplineName || (r.discipline_code === 'KALARIPPAYATTU' ? 'Kalarippayattu' : 'Karate + Wushu'),
        from_rank_name: r.from_rank_name || r.previousRank || null,
        to_rank_name: r.to_rank_name || r.rankSecured || 'Rank Holder',
        belt_color: r.belt_color || r.beltColor || 'Yellow',
        promoted_at: r.promoted_at || r.promotionDate || new Date().toISOString(),
        certificate_number: r.certificate_number || r.certificateNumber || `GSA-CERT-${String(r.id || '').slice(0, 6)}`,
        examiner_name: r.examiner_name || r.promotedBy || 'Chief Master (Gurukul Academy)',
        represented_from: r.represented_from || r.representedFrom || 'Gurukul Sports Academy Central Dojo',
        notes: r.notes || null,
      }));

      // Defensive frontend deduplication: Group by student_id + discipline_code
      // Keep only one per group, preferring the one with a non-null/non-empty student_code (reg_number)
      const groupedCerts = new Map<string, CertificateRecord[]>();
      for (const cert of normalizedList) {
        const key = `${cert.student_id}:${cert.discipline_code}`;
        if (!groupedCerts.has(key)) {
          groupedCerts.set(key, []);
        }
        groupedCerts.get(key)!.push(cert);
      }

      const deduplicatedList: CertificateRecord[] = [];
      for (const group of groupedCerts.values()) {
        group.sort((a, b) => {
          const aHasReg = Boolean(
            a.student_code &&
            a.student_code.trim() !== '' &&
            a.student_code.toUpperCase() !== 'GSA-ATH'
          );
          const bHasReg = Boolean(
            b.student_code &&
            b.student_code.trim() !== '' &&
            b.student_code.toUpperCase() !== 'GSA-ATH'
          );
          if (aHasReg !== bHasReg) {
            return aHasReg ? -1 : 1;
          }

          const dateA = new Date(a.promoted_at || 0).getTime();
          const dateB = new Date(b.promoted_at || 0).getTime();
          return dateB - dateA;
        });

        deduplicatedList.push(group[0]);
      }

      // Sort the final list back by promoted_at DESC
      deduplicatedList.sort((a, b) => {
        const dateA = new Date(a.promoted_at || 0).getTime();
        const dateB = new Date(b.promoted_at || 0).getTime();
        return dateB - dateA;
      });

      setCertificates(deduplicatedList);
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    fetchStudentRanks();
    fetchRanks();
    fetchDisciplines();
    fetchAcademyStudents();
  }, []);

  useEffect(() => {
    if (activeTab === 'CERTIFICATES') {
      fetchCertificates();
    }
  }, [activeTab, certStartDate, certEndDate, certDisciplineFilter]);

  // Open 1-Click Promote Modal
  const openPromoteModal = (studentRank: StudentRank) => {
    setSelectedStudentForPromotion(studentRank);
    // Find next rank in same discipline
    const disciplineRanks = allRanks
      .filter((r) => r.discipline_code === studentRank.discipline_code)
      .sort((a, b) => a.rank_order - b.rank_order);
    const next = disciplineRanks.find((r) => r.rank_order > studentRank.rank_order);
    if (next) {
      setPromotionTargetRankId(next.id);
    } else if (disciplineRanks.length > 0) {
      setPromotionTargetRankId(disciplineRanks[disciplineRanks.length - 1].id);
    }
    setIsPromoteModalOpen(true);
  };

  // Execute Rank Up Promotion
  const handlePromoteStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForPromotion) return;

    const chosenRank = allRanks.find((r) => r.id === promotionTargetRankId);
    if (!chosenRank) {
      toast.warning('Please select the target rank.');
      return;
    }

    try {
      setPromoting(true);
      const res = await apiClient<any>('/ranks/promote', {
        method: 'POST',
        body: JSON.stringify({
          student_id: selectedStudentForPromotion.student_id,
          studentId: selectedStudentForPromotion.student_id,
          discipline_code: selectedStudentForPromotion.discipline_code,
          disciplineCode: selectedStudentForPromotion.discipline_code,
          new_rank_id: chosenRank.id,
          nextRankId: chosenRank.id,
          examiner_name: examinerName,
          examinerName: examinerName,
          promotedBy: examinerName,
          represented_from: representedFrom,
          representedFrom: representedFrom,
          notes: 'Promoted via Gurukul Belt Examination System',
        }),
      });

      setIsPromoteModalOpen(false);
      const studentName = selectedStudentForPromotion.student_name;
      setSelectedStudentForPromotion(null);
      fetchStudentRanks();

      toast.success(res?.message || `Success! ${studentName} promoted to ${chosenRank.rank_name}.`);
    } catch (err: any) {
      console.error('Promotion failed:', err);
      toast.error(err.message || 'Could not promote student. Please retry.');
    } finally {
      setPromoting(false);
    }
  };

  // Handle Assign initial rank
  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentId) return;

    try {
      await apiClient('/ranks/assign', {
        method: 'POST',
        body: JSON.stringify({
          student_id: assignStudentId,
          discipline_code: assignDiscipline,
          rank_name: assignRankName,
        }),
      });

      setIsAssignModalOpen(false);
      setAssignStudentId('');
      fetchStudentRanks();
      toast.success('Student enrolled into Martial Arts rank registry successfully!');
    } catch (err) {
      console.error('Failed to assign rank:', err);
      toast.error('Could not enroll student in martial arts rank registry.');
    }
  };


  // Print Certificate Registry sheet
  const handlePrintRegistry = () => {
    window.print();
  };

  const q = (searchTerm || '').trim().toLowerCase();

  interface ConsolidatedStudentCard {
    student_id: string;
    student_name: string;
    contact_number: string;
    student_code?: string;
    dob?: string;
    disciplines: StudentRank[];
  }

  // Strict 1-to-1 Consolidated Representation: Each student appears EXACTLY ONCE on the screen!
  const consolidatedStudentCards = React.useMemo(() => {
    const studentMap = new Map<string, ConsolidatedStudentCard>();

    (studentRanks || []).forEach((sr) => {
      const studentName = (sr.student_name || '').toLowerCase();
      const studentCode = (sr.student_code || '').toLowerCase();
      const contact = (sr.contact_number || '').toLowerCase();
      const currentRank = (sr.current_rank_name || '').toLowerCase();
      const belt = (sr.belt_color || '').toLowerCase();
      const matchesSearch =
        !q ||
        studentName.includes(q) ||
        studentCode.includes(q) ||
        contact.includes(q) ||
        currentRank.includes(q) ||
        belt.includes(q);
      if (!matchesSearch) return;

      const matchesDiscipline = disciplineFilter === 'ALL' || sr.discipline_code === disciplineFilter;
      if (!matchesDiscipline) return;

      const key = sr.student_id || sr.student_name.trim().toLowerCase();
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          student_id: sr.student_id,
          student_name: sr.student_name,
          contact_number: sr.contact_number,
          student_code: sr.student_code,
          dob: sr.dob,
          disciplines: [sr],
        });
      } else {
        const existing = studentMap.get(key)!;
        if (!existing.disciplines.some((d) => d.discipline_code === sr.discipline_code)) {
          existing.disciplines.push(sr);
        }
      }
    });

    return Array.from(studentMap.values());
  }, [studentRanks, q, disciplineFilter]);

  const certQ = (certSearchTerm || '').trim().toLowerCase();
  const filteredCertificates = (certificates || []).filter((cert) => {
    if (!certQ) return true;
    const name = (cert.student_name || '').toLowerCase();
    const reg = (cert.student_code || '').toLowerCase();
    const certNum = (cert.certificate_number || '').toLowerCase();
    const rank = (cert.to_rank_name || '').toLowerCase();
    const phone = (cert.contact_number || '').toLowerCase();
    const parent = (cert.parentName || cert.fatherName || '').toLowerCase();
    return (
      name.includes(certQ) ||
      reg.includes(certQ) ||
      certNum.includes(certQ) ||
      rank.includes(certQ) ||
      phone.includes(certQ) ||
      parent.includes(certQ)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
            <span>Martial Arts & Athletics</span>
            <span>•</span>
            <span className="text-orange-600 dark:text-orange-400 font-semibold">Belt Examinations & Certification</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center gap-2.5">
            <Award className="w-7 h-7 text-amber-500 dark:text-amber-400" />
            Martial Arts Belt Promotion & Certificate Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage Kalarippayattu and Karate + Wushu belt progression, promote students with 1 click, and export date-filtered certificate registers in clean Excel spreadsheet (Row & Column) format.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Enroll Student in Belt Registry
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'STUDENTS'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Athletes & 1-Click Rank-Up
        </button>

        <button
          onClick={() => setActiveTab('CERTIFICATES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'CERTIFICATES'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Certificate Registry (Row & Column Excel Export)
        </button>

        <button
          onClick={() => setActiveTab('CURRICULUM')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'CURRICULUM'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Layers className="w-4 h-4" />
          Belt Curriculum & Disciplines
        </button>
      </div>

      {/* TAB 1: ATHLETES & 1-CLICK RANK-UP */}
      {activeTab === 'STUDENTS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search athlete by name or reg no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Disciplines</option>
                {disciplines.length > 0 ? (
                  disciplines.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="KALARIPPAYATTU">Kalarippayattu</option>
                    <option value="KARATE_WUSHU">Karate</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {loading ? (
            <SkeletonLoader rows={5} />
          ) : consolidatedStudentCards.length === 0 ? (
            <Card className="p-10 text-center bg-white dark:bg-[#0F172A]/70 border-slate-200 dark:border-white/10 shadow-sm">
              <Award className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No students found in martial arts rank registry</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enroll students to track their belt progression and issue certificates.</p>
              <Button
                onClick={() => setIsAssignModalOpen(true)}
                className="mt-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Enroll First Student
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {consolidatedStudentCards.map((athlete) => {
                const studentKey = athlete.student_id || athlete.student_name;
                const activeCode =
                  cardActiveDisciplines[studentKey] ||
                  (disciplineFilter !== 'ALL'
                    ? disciplineFilter
                    : athlete.disciplines[0]?.discipline_code);

                const currentRank =
                  athlete.disciplines.find((d) => d.discipline_code === activeCode) ||
                  athlete.disciplines[0];

                const getBeltBadge = (color: string) => getBeltBadgeClass(color);

                return (
                  <Card
                    key={studentKey}
                    className="p-5 bg-white dark:bg-gradient-to-b dark:from-[#0F172A] dark:to-[#0A1120] border-slate-200 dark:border-white/10 hover:border-amber-500/50 transition-all shadow-sm group relative overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Dual Discipline Switcher Pills if student is enrolled in 2+ disciplines */}
                      {athlete.disciplines.length > 1 ? (
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-white/10 mb-3">
                          {athlete.disciplines.map((d) => {
                            const isSel = d.discipline_code === currentRank.discipline_code;
                            return (
                              <button
                                key={d.discipline_code}
                                type="button"
                                onClick={() =>
                                  setCardActiveDisciplines((prev) => ({
                                    ...prev,
                                    [studentKey]: d.discipline_code,
                                  }))
                                }
                                className={`flex-1 py-1 px-2.5 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                  isSel
                                    ? d.discipline_code === 'KALARIPPAYATTU'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'bg-amber-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                <span>🥋 {d.discipline_code === 'KALARIPPAYATTU' ? 'Kalari' : d.discipline_code === 'KARATE_WUSHU' ? 'Karate' : d.discipline_code.replace('_', ' ')}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${isSel ? 'bg-black/25 text-white' : 'bg-slate-200 dark:bg-white/10'}`}>
                                  {d.belt_color || d.current_rank_name.split(' ')[0]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            currentRank.discipline_code === 'KALARIPPAYATTU'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : currentRank.discipline_code === 'KARATE_WUSHU'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                          }`}>
                            {currentRank.discipline_code.replace('_', ' ')}
                          </span>
                          {currentRank.student_code && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">#{currentRank.student_code}</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {athlete.student_name}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">{athlete.contact_number || 'No contact'}</p>
                        </div>

                        <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                          <Medal className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Current Belt Banner for Active Discipline */}
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                            {currentRank.discipline_code === 'KALARIPPAYATTU' ? 'Current Kalari Rank' : 'Current Karate Belt'}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-black px-2.5 py-1 rounded-md border ${getBeltBadge(currentRank.belt_color)}`}>
                              {currentRank.current_rank_name}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Promoted On</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 mt-1 block">
                            {new Date(currentRank.promoted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      {/* Next Belt Preview if available */}
                      {currentRank.nextRank && (
                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between px-1">
                          <span>Next Target:</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-300 flex items-center gap-1">
                            {currentRank.nextRank.rank_name} <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {currentRank.certificate_number ? `Cert: ${currentRank.certificate_number}` : 'Awaiting Cert'}
                      </span>

                      <Button
                        onClick={() => openPromoteModal(currentRank)}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs py-1.5 px-3 shadow-md shadow-orange-500/20 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        1-Click Rank Up
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CERTIFICATE REGISTRY & PDF PRINT EXPORT (WITH DATE FILTER) */}
      {activeTab === 'CERTIFICATES' && (
        <div className="space-y-4">
          {/* User Request Highlight: Date Range Filter Toolbar */}
          <Card className="p-4 bg-white dark:bg-[#0F172A]/90 border-slate-200 dark:border-white/10 space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  Examination Date Range Filter for Physical Certificate Writing
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select the date window to generate the exact roster for physical certificate inscription (Player Name, DOB, Reg No, Rank, Discipline, Dojo).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={exportCertificatesToCsv}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3 font-bold shadow-md shadow-emerald-500/20 flex items-center cursor-pointer"
                  title="Download Excel-compatible CSV spreadsheet of all athlete promotions"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  Export All to Excel (CSV)
                </Button>
                <Button
                  onClick={() => copyCertificatesToClipboard()}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-white/10 text-xs py-2 px-3 font-semibold flex items-center shadow-xs cursor-pointer"
                  title="Copy all rows to clipboard for 1-click paste into Microsoft Excel"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                  Copy All for Excel
                </Button>
                <Button
                  onClick={handlePrintRegistry}
                  className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-white/10 text-xs py-2 px-3 font-semibold flex items-center shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-700 dark:text-slate-300" />
                  Print Spreadsheet Sheet
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">From Date (Exam Window)</label>
                <input
                  type="date"
                  value={certStartDate}
                  onChange={(e) => setCertStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#0A1120] border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">To Date</label>
                <input
                  type="date"
                  value={certEndDate}
                  onChange={(e) => setCertEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#0A1120] border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Discipline</label>
                <select
                  value={certDisciplineFilter}
                  onChange={(e) => setCertDisciplineFilter(e.target.value)}
                  className="w-full bg-white dark:bg-[#0A1120] border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Disciplines</option>
                  {disciplines.length > 0 ? (
                    disciplines.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="KALARIPPAYATTU">Kalarippayattu</option>
                      <option value="KARATE_WUSHU">Karate</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  onClick={fetchCertificates}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs py-1.5"
                >
                  Apply Filter
                </Button>
                {(certStartDate || certEndDate || certDisciplineFilter !== 'ALL') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCertStartDate('');
                      setCertEndDate('');
                      setCertDisciplineFilter('ALL');
                    }}
                    className="text-xs py-1.5 px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Certificate Records Table (Clean Excel Row & Column Grid) */}
          {loadingCerts ? (
            <SkeletonLoader rows={5} />
          ) : certificates.length === 0 ? (
            <Card className="p-10 text-center bg-white dark:bg-[#0F172A]/60 border-slate-200 dark:border-white/10 shadow-sm">
              <FileSpreadsheet className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No promotion records match this date filter</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Adjust the date range above to view promotions from previous examination cycles.</p>
            </Card>
          ) : (
            <div className="bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-xl print:bg-white print:text-black print:border-black">
              <div className="p-4 bg-slate-50 dark:bg-[#0A1120] border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Showing {filteredCertificates.length} {filteredCertificates.length !== certificates.length ? `(filtered from ${certificates.length})` : ''} Certificate Records
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium flex items-center gap-1">
                    <FileSpreadsheet className="w-3 h-3" />
                    Excel Row &amp; Column Format
                  </span>
                </div>

                {/* Instant Search Bar */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by student name, reg no, cert #..."
                    value={certSearchTerm}
                    onChange={(e) => setCertSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-xs"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-[#0A1120] text-slate-700 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-white/10 print:bg-slate-100 print:text-black">
                    <tr>
                      <th className="py-3 px-2 text-center w-12 border-r border-slate-200 dark:border-white/5">Sr.</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">Player Reg No.</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">Athlete Full Name</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">Parent / Guardian</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">Parent Contact</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">DOB</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">Martial Art Subject</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">From Rank</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">To Rank (Belt Secured)</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">Exam Date</th>
                      <th className="py-3 px-3 border-r border-slate-200 dark:border-white/5">Certificate No.</th>
                      <th className="py-3 px-3 text-right print:hidden">Excel Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-[#0F172A]/70 print:divide-slate-300">
                    {filteredCertificates.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center py-8 text-slate-500 dark:text-slate-400">
                          No certificate records found matching &quot;{certSearchTerm}&quot;.
                        </td>
                      </tr>
                    ) : (
                      filteredCertificates.map((cert, idx) => (
                      <tr key={cert.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors print:text-black">
                        <td className="py-3 px-2 text-center font-mono text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-600 dark:text-amber-400 border-r border-slate-100 dark:border-white/5 print:text-black">
                          {cert.student_code || 'GSA-ATH'}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-white/5">
                          <span className="font-bold text-slate-900 dark:text-white print:text-black block">{cert.student_name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 print:text-black">
                          {cert.parent_name || cert.fatherName || 'On Record'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 print:text-black">
                          {cert.contact_number || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 print:text-black">
                          {cert.dob && !isNaN(new Date(cert.dob).getTime()) ? new Date(cert.dob).toLocaleDateString('en-IN') : 'On File'}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-white/5">
                          <span className="font-semibold text-slate-800 dark:text-white print:text-black">{cert.discipline_name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5 print:text-black">
                          {cert.from_rank_name || <span className="italic text-slate-400">Beginner</span>}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-white/5">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 print:border-black print:text-black">
                            <Award className="w-3 h-3 text-amber-500 dark:text-amber-400 print:hidden" />
                            {cert.to_rank_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 print:text-black">
                          {cert.promoted_at && !isNaN(new Date(cert.promoted_at).getTime())
                            ? new Date(cert.promoted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : 'Current Session'}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold border-r border-slate-100 dark:border-white/5 print:text-black">
                          {cert.certificate_number}
                        </td>
                        <td className="py-3 px-3 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              onClick={() => exportSingleCertificateToCsv(cert)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1 px-2.5 shadow-xs rounded-md flex items-center gap-1 cursor-pointer"
                              title="Export this row to Excel (CSV)"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              Export Excel
                            </Button>
                            <Button
                              onClick={() => setPreviewCert(cert)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-[11px] py-1 px-2 border border-slate-200 dark:border-white/10 rounded-md flex items-center gap-1 cursor-pointer"
                              title="View Row Details"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              Details
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CURRICULUM & DISCIPLINES */}
      {activeTab === 'CURRICULUM' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0F172A]/70 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                Academy Martial Arts &amp; Sports Belt Curriculum
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customize belt progression orders, color tags, and grading requirements for each discipline.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                onClick={handleOpenAddDiscipline}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3.5 font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Discipline / Section
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsManageCategoriesOpen(true)}
                className="text-xs py-2 px-3 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                Manage Belt Colors &amp; Categories
              </Button>
              <Button
                onClick={() => handleOpenAddBelt(disciplines[0]?.code || 'KARATE_WUSHU')}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs py-2 px-3.5 font-bold shadow-md shadow-orange-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add New Belt Rank
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {disciplines.length === 0 ? (
              <div className="col-span-full p-8 rounded-xl bg-white dark:bg-[#0F172A]/70 border border-slate-200 dark:border-white/10 text-center">
                <p className="text-slate-600 dark:text-slate-400 text-sm">No disciplines configured. Click &quot;Add Discipline / Section&quot; to create one.</p>
              </div>
            ) : (
              disciplines.map((disc) => {
                const discRanks = allRanks
                  .filter((r) => r.discipline_code === disc.code)
                  .sort((a, b) => a.rank_order - b.rank_order);
                const isBuiltin = disc.code === 'KALARIPPAYATTU' || disc.code === 'KARATE_WUSHU';

                return (
                  <Card
                    key={disc.id || disc.code}
                    className="p-5 preserve-dark bg-[#0A1120] border-slate-700/80 space-y-4 flex flex-col justify-between rounded-2xl shadow-lg"
                  >
                    <div>
                      <div className="flex items-start justify-between pb-3 border-b border-white/10 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {disc.code === 'KALARIPPAYATTU'
                              ? 'Ancient Martial Art'
                              : disc.code === 'KARATE_WUSHU'
                              ? 'Combat & Forms'
                              : 'Martial Discipline'}
                          </span>
                          <h3 className="text-base font-bold text-white mt-1 flex items-center gap-2">
                            {disc.name}
                            <span className="text-[11px] font-normal text-slate-400">({discRanks.length} Belts)</span>
                          </h3>
                          {disc.description && (
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{disc.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleOpenAddBelt(disc.code)}
                            className="text-[11px] py-1 px-2.5 h-7 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Belt
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditDiscipline(disc)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded transition-colors"
                            title={`Edit Section: ${disc.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isBuiltin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDiscipline(disc)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title={`Delete Section: ${disc.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2.5 mt-3">
                        {discRanks.length === 0 ? (
                          <div className="p-4 rounded-lg bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400">
                            No belts configured in {disc.name} yet. Click &quot;Add Belt&quot; to configure Level 1, Level 2, etc.
                          </div>
                        ) : (
                          discRanks.map((rank) => (
                            <div
                              key={rank.id}
                              className="p-3 bg-slate-900/60 rounded-lg border border-white/5 flex flex-col gap-1.5 group hover:border-amber-500/40 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col items-center flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveRankOrder(rank, 'UP')}
                                      className="text-slate-500 hover:text-amber-400 p-0.5 -mb-1 transition-colors"
                                      title="Kram Upar (Move Up in Hierarchy)"
                                    >
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center">
                                      {rank.rank_order}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveRankOrder(rank, 'DOWN')}
                                      className="text-slate-500 hover:text-amber-400 p-0.5 -mt-1 transition-colors"
                                      title="Kram Niche (Move Down in Hierarchy)"
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-white block">{rank.rank_name}</span>
                                    <span className="text-[11px] text-slate-400">{rank.description || 'Syllabus & Stance Mastery'}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shadow-sm ${getBeltBadgeClass(rank.belt_color)}`}>
                                    {rank.belt_color}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditBelt(rank)}
                                    className="p-1 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded transition-colors"
                                    title="Edit Belt"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBelt(rank)}
                                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded transition-colors"
                                    title="Delete Belt"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {rank.syllabus && (
                                <div className="ml-8 text-[10px] text-amber-300/90 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 font-mono">
                                  📋 <span className="font-semibold text-amber-200">Syllabus:</span> {rank.syllabus}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: 1-Click Promote Student */}
      <Modal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        title={`Promote Athlete: ${selectedStudentForPromotion?.student_name || ''}`}
      >
        <form onSubmit={handlePromoteStudent} className="space-y-4">
          <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-200">
            <span className="font-bold text-slate-900 dark:text-white block">Current Discipline: {selectedStudentForPromotion?.discipline_code.replace('_', ' ')}</span>
            Current Belt: <strong>{selectedStudentForPromotion?.current_rank_name}</strong>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Promote to New Rank / Belt *</label>
            <select
              required
              value={promotionTargetRankId}
              onChange={(e) => setPromotionTargetRankId(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            >
              {allRanks
                .filter((r) => r.discipline_code === selectedStudentForPromotion?.discipline_code)
                .sort((a, b) => a.rank_order - b.rank_order)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Order {r.rank_order}: {r.rank_name} ({r.belt_color} Belt)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Chief Examiner / Master *</label>
            <input
              type="text"
              required
              value={examinerName}
              onChange={(e) => setExaminerName(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Represented From (Dojo / Branch) *</label>
            <input
              type="text"
              required
              value={representedFrom}
              onChange={(e) => setRepresentedFrom(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400" />
            <span>Rank will be updated and recorded in the Certificate Registry. Export records to Excel from the Certificate Registry tab.</span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPromoteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={promoting}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold"
            >
              {promoting ? 'Promoting...' : 'Confirm Promotion'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Enroll Athlete in Belt Registry */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Enroll Student into Martial Arts Belt Registry"
      >
        <form onSubmit={handleAssignStudent} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Select Academy Student *</label>
            <select
              required
              value={assignStudentId}
              onChange={(e) => setAssignStudentId(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            >
              <option value="">-- Choose Athlete --</option>
              {academyStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.contactNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Discipline *</label>
              <select
                value={assignDiscipline}
                onChange={(e) => setAssignDiscipline(e.target.value)}
                className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
              >
                {disciplines.length > 0 ? (
                  disciplines.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="KALARIPPAYATTU">Kalarippayattu</option>
                    <option value="KARATE_WUSHU">Karate</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Initial Belt / Grade *</label>
              <select
                value={assignRankName}
                onChange={(e) => setAssignRankName(e.target.value)}
                className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
              >
                {allRanks
                  .filter((r) => r.discipline_code === assignDiscipline)
                  .sort((a, b) => a.rank_order - b.rank_order)
                  .map((r) => (
                    <option key={r.id} value={r.rank_name}>
                      {r.rank_name} ({r.belt_color})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              Enroll in Registry
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Athlete Certificate Record (Excel Row & Column Table View) */}
      <Modal
        isOpen={Boolean(previewCert)}
        onClose={() => setPreviewCert(null)}
        title="Athlete Promotion & Certificate Record (Row & Column View)"
        maxWidth="lg"
      >
        {previewCert && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {previewCert.student_name}
                    <span className="text-[11px] font-mono font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {previewCert.student_code || 'GSA-ATH'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Excel Spreadsheet Record • Certificate #{previewCert.certificate_number}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => exportSingleCertificateToCsv(previewCert)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export to Excel (CSV)
                </Button>
                <Button
                  onClick={() => copyCertificatesToClipboard([previewCert])}
                  variant="outline"
                  className="text-xs py-1.5 px-3 border-white/20 text-slate-300 hover:text-white flex items-center gap-1.5"
                  title="Copy row to paste directly into Microsoft Excel"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  Copy for Excel
                </Button>
              </div>
            </div>

            {/* Clean 2-Column Key/Value Excel Grid Table */}
            <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0A1120]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-white/10">
                    <th className="py-2.5 px-3.5 w-1/3 border-r border-white/10">Excel Column (Field Name)</th>
                    <th className="py-2.5 px-3.5 w-2/3">Record Value (Cell Data)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Player Reg No</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold text-amber-400">{previewCert.student_code || 'GSA-ATH'}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Student Full Name</td>
                    <td className="py-2.5 px-3.5 font-bold text-white">{previewCert.student_name}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Parent / Guardian Name</td>
                    <td className="py-2.5 px-3.5 text-slate-200">{previewCert.parent_name || previewCert.fatherName || 'On Record'}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Parent Contact / WhatsApp</td>
                    <td className="py-2.5 px-3.5 text-slate-200 font-mono">{previewCert.contact_number || 'N/A'}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Date of Birth (DOB)</td>
                    <td className="py-2.5 px-3.5 text-slate-200">{previewCert.dob && !isNaN(new Date(previewCert.dob).getTime()) ? new Date(previewCert.dob).toLocaleDateString('en-IN') : 'On File'}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Martial Arts Discipline</td>
                    <td className="py-2.5 px-3.5 text-slate-200 font-semibold">{previewCert.discipline_name}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">From Rank (Previous Belt)</td>
                    <td className="py-2.5 px-3.5 text-slate-400">{previewCert.from_rank_name || 'Beginner'}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">To Rank (Promoted Belt)</td>
                    <td className="py-2.5 px-3.5 font-bold text-amber-300">
                      <span className="inline-flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        {previewCert.to_rank_name}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Belt Color</td>
                    <td className="py-2.5 px-3.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getBeltBadgeClass(previewCert.belt_color)}`}>
                        {previewCert.belt_color}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Exam / Promotion Date</td>
                    <td className="py-2.5 px-3.5 text-slate-200 font-medium">
                      {previewCert.promoted_at && !isNaN(new Date(previewCert.promoted_at).getTime())
                        ? new Date(previewCert.promoted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Current Session'}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Certificate Number</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-400">{previewCert.certificate_number}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Represented From (Dojo / Branch)</td>
                    <td className="py-2.5 px-3.5 text-slate-200">{previewCert.represented_from || 'Gurukul Sports Academy'}</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-400 border-r border-white/10">Chief Examiner / Master</td>
                    <td className="py-2.5 px-3.5 text-slate-200">{previewCert.examiner_name || 'Chief Master (Gurukul Academy)'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => setPreviewCert(null)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                onClick={() => exportSingleCertificateToCsv(previewCert)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Download Excel (CSV)
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4: Add / Edit Belt Rank */}
      <Modal
        isOpen={isBeltModalOpen}
        onClose={() => setIsBeltModalOpen(false)}
        title={editingBeltRank ? `Edit Belt: ${editingBeltRank.rank_name}` : 'Add New Belt Rank'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveBelt} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Discipline *</label>
              <select
                disabled={Boolean(editingBeltRank)}
                value={beltForm.disciplineCode}
                onChange={(e) => setBeltForm({ ...beltForm, disciplineCode: e.target.value })}
                className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 disabled:opacity-50 shadow-xs"
              >
                {disciplines.length > 0 ? (
                  disciplines.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="KALARIPPAYATTU">Kalarippayattu</option>
                    <option value="KARATE_WUSHU">Karate</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Rank Order / Level *</label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={beltForm.rankOrder}
                onChange={(e) => setBeltForm({ ...beltForm, rankOrder: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Rank / Belt Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Yellow Belt (8th Kyu) or Meythari Level 1"
              value={beltForm.rankName}
              onChange={(e) => setBeltForm({ ...beltForm, rankName: e.target.value })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                Belt Color Category *
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomColorInput(!isCustomColorInput)}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-500 font-semibold underline underline-offset-2 flex items-center gap-1"
                >
                  {isCustomColorInput ? 'Select from Presets' : '+ Type Custom'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManageCategoriesOpen(true)}
                  className="text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200/60 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 font-medium"
                  title="Configure & Manage Academy Belt Categories"
                >
                  <Settings2 className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  Manage Colors
                </button>
              </div>
            </div>

            {isCustomColorInput ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. White Sash, Gold Belt, Yellow Stripe, Camo"
                    value={beltForm.beltColor}
                    onChange={(e) => setBeltForm({ ...beltForm, beltColor: e.target.value })}
                    className="flex-1 bg-white dark:bg-[#0F172A] border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium shadow-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const trimmed = beltForm.beltColor.trim();
                      if (!trimmed) return toast.warning('Enter a category name first');
                      if (customBeltCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
                        return toast.info('Already exists in category list');
                      }
                      const newCat = {
                        id: `custom-${Date.now()}`,
                        name: trimmed,
                        group: 'Custom / Academy',
                        isCustom: true,
                      };
                      const updated = [...customBeltCategories, newCat];
                      setCustomBeltCategories(updated);
                      try {
                        localStorage.setItem('gurukul_custom_belt_categories', JSON.stringify(updated));
                      } catch (e) {}
                      toast.success(`Saved "${trimmed}" to belt categories!`);
                    }}
                    className="text-[11px] h-8 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap"
                    title="Save this custom name to the persistent category dropdown"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Save Category
                  </Button>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Type any custom belt or sash color. Click &quot;Save Category&quot; to make it permanently available in the dropdown.
                </p>
              </div>
            ) : (
              <select
                value={beltForm.beltColor}
                onChange={(e) => {
                  if (e.target.value === '__CUSTOM__') {
                    setIsCustomColorInput(true);
                  } else {
                    setBeltForm({ ...beltForm, beltColor: e.target.value });
                  }
                }}
                className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
              >
                {Array.from(new Set(customBeltCategories.map((c) => c.group))).map((groupName) => (
                  <optgroup key={groupName} label={groupName} className="bg-slate-100 dark:bg-[#0A1120] text-slate-700 dark:text-slate-300 font-bold">
                    {customBeltCategories
                      .filter((c) => c.group === groupName)
                      .map((cat) => (
                        <option key={cat.id} value={cat.name} className="text-slate-900 dark:text-white py-1">
                          {cat.name}
                        </option>
                      ))}
                  </optgroup>
                ))}

                {Array.from(new Set(allRanks.map((r) => r.belt_color).filter(Boolean)))
                  .filter((c) => !customBeltCategories.some((cat) => cat.name.toLowerCase() === c.toLowerCase()))
                  .length > 0 && (
                  <optgroup label="Active In Database Curriculum" className="bg-slate-100 dark:bg-[#0A1120] text-amber-600 dark:text-amber-400 font-bold">
                    {Array.from(new Set(allRanks.map((r) => r.belt_color).filter(Boolean)))
                      .filter((c) => !customBeltCategories.some((cat) => cat.name.toLowerCase() === c.toLowerCase()))
                      .map((c) => (
                        <option key={c} value={c} className="text-slate-900 dark:text-white">
                          {c}
                        </option>
                      ))}
                  </optgroup>
                )}

                <option value="__CUSTOM__" className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40">
                  ➕ Type Custom Belt Color / Category...
                </option>
              </select>
            )}

            {/* Live Visual Badge Preview */}
            <div className="mt-2.5 p-2 rounded-lg bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                Live Belt Badge Preview:
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border shadow-sm ${getBeltBadgeClass(beltForm.beltColor)}`}>
                {beltForm.beltColor || 'White Belt'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Belt Grade Title / Mastery Description</label>
            <input
              type="text"
              placeholder="e.g. बालशिष्य, Kata & Stances, or Form Mastery"
              value={beltForm.description}
              onChange={(e) => setBeltForm({ ...beltForm, description: e.target.value })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Official Examination Syllabus (Katas, Weapons, Techniques)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. TAIKYOKU SHODAN, TAIKYOKU NIDAN | KATHI CHAUMUKHI or STICK BASICS"
              value={beltForm.syllabus}
              onChange={(e) => setBeltForm({ ...beltForm, syllabus: e.target.value })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-xs"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Displays on athlete curriculum and grading examination records as per the official academy poster.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBeltModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingBelt}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
            >
              {savingBelt ? 'Saving...' : editingBeltRank ? 'Update Belt Rank' : 'Create Belt Rank'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: Manage Belt Color Categories */}
      <Modal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        title="Martial Arts Belt Color & Category Manager"
        maxWidth="lg"
      >
        <div className="space-y-5">
          <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/20 rounded-xl text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold mb-1">
              <Palette className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Full Admin Control Over Belt Colors &amp; Sashes</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Add custom martial arts belts, sashes (Kalari), or dual combinations. These categories will be available across the Academy curriculum, student promotions, and certificate registries.
            </p>
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="p-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Add New Belt / Sash Category
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. Camo Belt, White Sash, Gold Belt, Red-Black Stripe"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-xs"
                />
              </div>
              <div>
                <select
                  value={newCategoryGroup}
                  onChange={(e) => setNewCategoryGroup(e.target.value)}
                  className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
                >
                  <option value="Custom / Academy">Custom / Academy</option>
                  <option value="Standard Belts">Standard Belts</option>
                  <option value="Kalari Sashes">Kalari Sashes</option>
                  <option value="Dual Combinations">Dual Combinations</option>
                  <option value="Kyu / Dan Grades">Kyu / Dan Grades</option>
                  <option value="Specialty Ranks">Specialty Ranks</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Live Preview:</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border shadow-sm ${getBeltBadgeClass(newCategoryName || 'White Belt')}`}>
                  {newCategoryName || 'Category Preview'}
                </span>
              </div>
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Category
              </Button>
            </div>
          </form>

          {/* Edit Category Form (when an item is selected for editing) */}
          {editingCategory && (
            <form onSubmit={handleSaveEditCategory} className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Belt / Category Name &amp; Group
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="w-full bg-white dark:bg-[#0F172A] border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-400 shadow-xs"
                  />
                </div>
                <div>
                  <select
                    value={editingCategory.group}
                    onChange={(e) => setEditingCategory({ ...editingCategory, group: e.target.value })}
                    className="w-full bg-white dark:bg-[#0F172A] border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-400 shadow-xs"
                  >
                    <option value="Custom / Academy">Custom / Academy</option>
                    <option value="Standard Belts">Standard Belts</option>
                    <option value="Kalari Sashes">Kalari Sashes</option>
                    <option value="Dual Combinations">Dual Combinations</option>
                    <option value="Kyu / Dan Grades">Kyu / Dan Grades</option>
                    <option value="Specialty Ranks">Specialty Ranks</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Live Preview:</span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border shadow-sm ${getBeltBadgeClass(editingCategory.name)}`}>
                    {editingCategory.name || 'Preview'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingCategory(null)}
                    className="text-xs py-1 px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-1 px-3.5"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* List of Categories with Reorder (Kram) & Delete on ALL */}
          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {Array.from(new Set(customBeltCategories.map((c) => c.group))).map((groupName) => (
              <div key={groupName} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    {groupName} ({customBeltCategories.filter((c) => c.group === groupName).length})
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <ArrowUpDown className="w-2.5 h-2.5" /> Kram Badalne Ke Liye Teer (↑/↓) Dabayein
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {customBeltCategories
                    .filter((c) => c.group === groupName)
                    .map((cat, idx, arr) => (
                      <div
                        key={cat.id}
                        className="p-2.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 group hover:border-amber-500/40 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded border shadow-sm ${getBeltBadgeClass(cat.name)}`}>
                            {cat.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(cat.id, 'UP')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                            title="Move Up (Kram Upar)"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(cat.id, 'DOWN')}
                            disabled={idx === arr.length - 1}
                            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                            title="Move Down (Kram Niche)"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategory({ id: cat.id, name: cat.name, group: cat.group })}
                            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors ml-1"
                            title={`Edit "${cat.name}"`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors"
                            title={`Delete category "${cat.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={handleResetCategories}
              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-300 underline"
            >
              Reset to Defaults
            </button>
            <Button
              type="button"
              onClick={() => setIsManageCategoriesOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white text-xs font-semibold border border-slate-300 dark:border-white/10"
            >
              Done / Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 6: Add / Edit Discipline Section */}
      <Modal
        isOpen={isDisciplineModalOpen}
        onClose={() => setIsDisciplineModalOpen(false)}
        title={editingDiscipline ? `Edit Section: ${editingDiscipline.name}` : 'Add New Discipline / Section'}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveDiscipline} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Discipline / Section Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Kung Fu, Taekwondo, Kickboxing, Boxing, Judo"
              value={disciplineForm.name}
              onChange={(e) => setDisciplineForm({ ...disciplineForm, name: e.target.value })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Creates a dedicated belt curriculum section and allows athlete belt assignments.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Description / Tagline (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Traditional Chinese Martial Art, Wushu & Sanda"
              value={disciplineForm.description}
              onChange={(e) => setDisciplineForm({ ...disciplineForm, description: e.target.value })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDisciplineModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingDiscipline}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              {savingDiscipline ? 'Saving...' : editingDiscipline ? 'Update Section' : 'Create Section'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
