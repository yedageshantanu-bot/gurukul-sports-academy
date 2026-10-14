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
  FileText,
  Layers,
  Medal,
  Download,
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
import { downloadCertificatePdf } from '../../utils/certificatePdfGenerator';
import { downloadCombinedCertificatesPdf } from '../../utils/certificateBundlePdf';

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
  if (c.includes('white') || c.includes('silver')) return 'bg-slate-200/15 text-slate-100 border-slate-300/40 shadow-sm';

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

  // Discipline Section Management
  const [isDisciplineModalOpen, setIsDisciplineModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null);
  const [disciplineForm, setDisciplineForm] = useState({ name: '', description: '' });
  const [savingDiscipline, setSavingDiscipline] = useState(false);

  // Certificate Registry Date Filter States (The specific feature twist requested by user)
  const [certStartDate, setCertStartDate] = useState('');
  const [certEndDate, setCertEndDate] = useState('');
  const [certDisciplineFilter, setCertDisciplineFilter] = useState('ALL');
  const [certSearchTerm, setCertSearchTerm] = useState('');
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null);

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

  // Preview Certificate Modal
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);

  // Export full certificate registry to Excel CSV spreadsheet
  const exportCertificatesToCsv = () => {
    const list = filteredCertificates.length > 0 ? filteredCertificates : certificates;
    if (list.length === 0) {
      toast.error('No certificate records available to export.');
      return;
    }

    const headers = [
      'Athlete Reg No',
      'Student Full Name',
      'Parent / Guardian Name',
      'Parent WhatsApp',
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

  // Handle direct PDF certificate generation & download
  const handleDownloadCertificate = async (cert: CertificateRecord) => {
    try {
      setDownloadingCertId(cert.id);
      toast.info(`Preparing official certificate for ${cert.student_name}...`);
      await downloadCertificatePdf(cert);
      toast.success(`Official certificate for ${cert.student_name} downloaded successfully!`);
    } catch (err: any) {
      console.error('Failed to generate certificate PDF:', err);
      toast.error('Could not generate certificate PDF. Please retry.');
    } finally {
      setDownloadingCertId(null);
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

  // Download combined multi-page PDF bundle for all currently filtered certificates
  const [generatingBundle, setGeneratingBundle] = useState(false);
  const handleDownloadCombinedCertificates = async () => {
    if (!certificates.length) {
      toast.warning('No certificates to download in current filter.');
      return;
    }
    try {
      setGeneratingBundle(true);
      const rangeLabel =
        certStartDate && certEndDate
          ? `${certStartDate}_to_${certEndDate}`
          : certStartDate
          ? `from_${certStartDate}`
          : certEndDate
          ? `until_${certEndDate}`
          : 'all';

      toast.info(`Generating combined PDF bundle for ${certificates.length} certificate(s)...`);
      await downloadCombinedCertificatesPdf(certificates, rangeLabel);
      toast.success(`Combined certificate bundle downloaded (${certificates.length} certificates).`);
    } catch (err: any) {
      console.error('Failed to generate combined certificates bundle:', err);
      toast.error('Could not generate combined certificate PDF. Please retry.');
    } finally {
      setGeneratingBundle(false);
    }
  };

  // Print Certificate Registry sheet
  const handlePrintRegistry = () => {
    window.print();
  };

  const q = (searchTerm || '').trim().toLowerCase();
  const filteredStudentRanks = (studentRanks || []).filter((sr) => {
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
    const matchesDiscipline = disciplineFilter === 'ALL' || sr.discipline_code === disciplineFilter;
    return matchesSearch && matchesDiscipline;
  });

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
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
            <span>Martial Arts & Athletics</span>
            <span>•</span>
            <span className="text-orange-400 font-semibold">Belt Examinations & Certification</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
            <Award className="w-7 h-7 text-amber-400" />
            Martial Arts Belt Promotion & Certificate Registry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage Kalarippayattu and Karate + Wushu belt progression, promote students with 1 click, and export date-filtered certificate registers (single or combined PDF bundle).
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
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'STUDENTS'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Athletes & 1-Click Rank-Up
        </button>

        <button
          onClick={() => setActiveTab('CERTIFICATES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'CERTIFICATES'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" />
          Certificate Registry (Date Range Filter & PDF Export)
        </button>

        <button
          onClick={() => setActiveTab('CURRICULUM')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'CURRICULUM'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                className="w-full pl-9 pr-3 py-2 bg-[#0F172A] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
          ) : filteredStudentRanks.length === 0 ? (
            <Card className="p-10 text-center bg-[#0F172A]/70 border-white/10">
              <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No students found in martial arts rank registry</p>
              <p className="text-xs text-slate-500 mt-1">Enroll students to track their belt progression and issue certificates.</p>
              <Button
                onClick={() => setIsAssignModalOpen(true)}
                className="mt-3 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Enroll First Student
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudentRanks.map((student) => {
                const getBeltBadge = (color: string) => getBeltBadgeClass(color);

                return (
                  <Card
                    key={student.id}
                    className="p-5 bg-gradient-to-b from-[#0F172A] to-[#0A1120] border-white/10 hover:border-amber-500/40 transition-all shadow-md group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            student.discipline_code === 'KALARIPPAYATTU'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : student.discipline_code === 'KARATE_WUSHU'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          }`}>
                            {student.discipline_code === 'BOTH' ? 'Both (Kalari + Karate/Wushu)' : student.discipline_code.replace('_', ' ')}
                          </span>
                          {student.student_code && (
                            <span className="text-[10px] text-slate-500 font-mono">#{student.student_code}</span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                          {student.student_name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{student.contact_number || 'No contact'}</p>
                      </div>

                      <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                        <Medal className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Current Belt Banner */}
                    <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Current Belt</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-md border ${getBeltBadge(student.belt_color)}`}>
                            {student.current_rank_name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Promoted On</span>
                        <span className="text-xs font-semibold text-slate-300 mt-1 block">
                          {new Date(student.promoted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Next Belt Preview if available */}
                    {student.nextRank && (
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between px-1">
                        <span>Next Target:</span>
                        <span className="font-semibold text-amber-300 flex items-center gap-1">
                          {student.nextRank.rank_name} <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {/* Action button */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {student.certificate_number ? `Cert: ${student.certificate_number}` : 'Awaiting Cert'}
                      </span>

                      <Button
                        onClick={() => openPromoteModal(student)}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs py-1.5 px-3 shadow-md shadow-orange-500/20"
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
          <Card className="p-4 bg-[#0F172A]/90 border-white/10 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-400" />
                  Examination Date Range Filter for Physical Certificate Writing
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select the date window to generate the exact roster for physical certificate inscription (Player Name, DOB, Reg No, Rank, Discipline, Dojo).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={exportCertificatesToCsv}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3 font-bold shadow-md shadow-emerald-500/20"
                  title="Download Excel-compatible CSV of all athlete promotions"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  Export to Excel (CSV)
                </Button>
                <Button
                  onClick={handleDownloadCombinedCertificates}
                  disabled={generatingBundle || certificates.length === 0}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs py-2 px-3 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {generatingBundle
                    ? 'Generating...'
                    : `Download Combined PDF (${certificates.length})`}
                </Button>
                <Button
                  onClick={handlePrintRegistry}
                  className="bg-slate-800 hover:bg-slate-700 text-white border border-white/10 text-xs py-2 px-3"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  Print Registry Sheet
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">From Date (Exam Window)</label>
                <input
                  type="date"
                  value={certStartDate}
                  onChange={(e) => setCertStartDate(e.target.value)}
                  className="w-full bg-[#0A1120] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">To Date</label>
                <input
                  type="date"
                  value={certEndDate}
                  onChange={(e) => setCertEndDate(e.target.value)}
                  className="w-full bg-[#0A1120] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Discipline</label>
                <select
                  value={certDisciplineFilter}
                  onChange={(e) => setCertDisciplineFilter(e.target.value)}
                  className="w-full bg-[#0A1120] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
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

          {/* Certificate Records Table */}
          {loadingCerts ? (
            <SkeletonLoader rows={5} />
          ) : certificates.length === 0 ? (
            <Card className="p-10 text-center bg-[#0F172A]/60 border-white/10">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No promotion records match this date filter</p>
              <p className="text-xs text-slate-500 mt-1">Adjust the date range above to view promotions from previous examination cycles.</p>
            </Card>
          ) : (
            <div className="bg-[#0F172A] rounded-xl border border-white/10 overflow-hidden shadow-xl print:bg-white print:text-black print:border-black">
              <div className="p-4 bg-[#0A1120] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Showing {filteredCertificates.length} {filteredCertificates.length !== certificates.length ? `(filtered from ${certificates.length})` : ''} Certificate Records
                  </span>
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Ready for Inscription
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
                    className="w-full pl-9 pr-3 py-1.5 bg-[#0F172A] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A1120] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/10 print:bg-slate-100 print:text-black">
                    <tr>
                      <th className="py-3 px-3">Player Reg No.</th>
                      <th className="py-3 px-3">Player Full Name</th>
                      <th className="py-3 px-3">Date of Birth (DOB)</th>
                      <th className="py-3 px-3">Martial Art Subject</th>
                      <th className="py-3 px-3">From Rank (Previous)</th>
                      <th className="py-3 px-3">To Rank (Belt Secured)</th>
                      <th className="py-3 px-3">Represented From</th>
                      <th className="py-3 px-3">Exam Date</th>
                      <th className="py-3 px-3">Certificate No.</th>
                      <th className="py-3 px-3 text-right print:hidden">Certificate Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#0F172A]/70 print:divide-slate-300">
                    {filteredCertificates.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-slate-400">
                          No certificate records found matching "{certSearchTerm}".
                        </td>
                      </tr>
                    ) : (
                      filteredCertificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-white/5 transition-colors print:text-black">
                        <td className="py-3 px-3 font-mono font-bold text-amber-400 print:text-black">
                          {cert.student_code || 'GSA-ATH'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-white print:text-black block">{cert.student_name}</span>
                          <span className="text-[11px] text-slate-400 print:text-slate-600">{cert.contact_number}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 print:text-black">
                          {cert.dob && !isNaN(new Date(cert.dob).getTime()) ? new Date(cert.dob).toLocaleDateString('en-IN') : 'On File'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-white print:text-black">{cert.discipline_name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 print:text-black">
                          {cert.from_rank_name || <span className="italic text-slate-500">Beginner</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 print:border-black print:text-black">
                            <Award className="w-3 h-3 text-amber-400 print:hidden" />
                            {cert.to_rank_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 print:text-black">
                          {cert.represented_from || 'Gurukul Sports Academy'}
                        </td>
                        <td className="py-3 px-3 text-slate-300 print:text-black">
                          {cert.promoted_at && !isNaN(new Date(cert.promoted_at).getTime())
                            ? new Date(cert.promoted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : 'Current Session'}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-400 font-bold print:text-black">
                          {cert.certificate_number}
                        </td>
                        <td className="py-3 px-3 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              onClick={() => handleDownloadCertificate(cert)}
                              disabled={downloadingCertId === cert.id}
                              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-[11px] font-bold py-1 px-2.5 shadow-sm rounded-md"
                              title="Download Official PDF Certificate"
                            >
                              <Download className="w-3.5 h-3.5 mr-1" />
                              {downloadingCertId === cert.id ? 'Generating...' : 'Download PDF'}
                            </Button>
                            <Button
                              onClick={() => setPreviewCert(cert)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] py-1 px-2 border border-white/10 rounded-md"
                              title="Preview Certificate Card"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-slate-400" />
                              Preview
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0F172A]/70 p-4 rounded-xl border border-white/10">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                Academy Martial Arts &amp; Sports Belt Curriculum
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize belt progression orders, color tags, and grading requirements for each discipline.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                onClick={handleOpenAddDiscipline}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3.5 font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Discipline / Section
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsManageCategoriesOpen(true)}
                className="text-xs py-2 px-3 border-amber-500/30 text-amber-300 hover:text-white hover:bg-amber-500/10 font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                Manage Belt Colors &amp; Categories
              </Button>
              <Button
                onClick={() => handleOpenAddBelt(disciplines[0]?.code || 'KARATE_WUSHU')}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs py-2 px-3.5 font-bold shadow-md shadow-orange-500/20"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add New Belt Rank
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {disciplines.length === 0 ? (
              <div className="col-span-full p-8 rounded-xl bg-[#0F172A]/70 border border-white/10 text-center">
                <p className="text-slate-400 text-sm">No disciplines configured. Click &quot;Add Discipline / Section&quot; to create one.</p>
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
                    className="p-5 bg-[#0F172A]/90 border-white/10 space-y-4 flex flex-col justify-between"
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
          <div className="p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl text-xs text-amber-200">
            <span className="font-bold text-white block">Current Discipline: {selectedStudentForPromotion?.discipline_code.replace('_', ' ')}</span>
            Current Belt: <strong>{selectedStudentForPromotion?.current_rank_name}</strong>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Promote to New Rank / Belt *</label>
            <select
              required
              value={promotionTargetRankId}
              onChange={(e) => setPromotionTargetRankId(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
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
            <label className="text-xs font-semibold text-slate-300 block mb-1">Chief Examiner / Master *</label>
            <input
              type="text"
              required
              value={examinerName}
              onChange={(e) => setExaminerName(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Represented From (Dojo / Branch) *</label>
            <input
              type="text"
              required
              value={representedFrom}
              onChange={(e) => setRepresentedFrom(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="p-3 bg-slate-800/80 border border-white/10 rounded-lg text-xs text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>Rank will be updated and logged in the Certificate Registry. Download certificates from the Certificate Registry tab.</span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
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
            <label className="text-xs font-semibold text-slate-300 block mb-1">Select Academy Student *</label>
            <select
              required
              value={assignStudentId}
              onChange={(e) => setAssignStudentId(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Discipline *</label>
              <select
                value={assignDiscipline}
                onChange={(e) => setAssignDiscipline(e.target.value)}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Initial Belt / Grade *</label>
              <select
                value={assignRankName}
                onChange={(e) => setAssignRankName(e.target.value)}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
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

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
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

      {/* MODAL 3: Digital Certificate Preview Card */}
      <Modal
        isOpen={Boolean(previewCert)}
        onClose={() => setPreviewCert(null)}
        title="Official Certificate Inscription Card"
      >
        {previewCert && (
          <div className="p-6 bg-gradient-to-b from-[#0A1120] to-[#0F172A] rounded-2xl border-2 border-amber-500/40 text-center space-y-4 shadow-2xl relative">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400">
                <Award className="w-8 h-8" />
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold block">
                Certificate of Rank Achievement
              </span>
              <h2 className="text-xl font-black text-white mt-1">Gurukul Sports Academy</h2>
              <span className="text-xs text-slate-400">Department of Traditional & Combat Arts</span>
            </div>

            <div className="py-3 border-y border-white/10 space-y-2">
              <p className="text-xs text-slate-300">This is to certify that athlete</p>
              <h3 className="text-2xl font-black text-amber-300">
                {(() => {
                  const sName = previewCert.student_name || '';
                  const fName = previewCert.fatherName || previewCert.parent_name || '';

                  // Split student name into first and surname
                  const studentParts = sName.trim().split(/\s+/);
                  const studentFirst = studentParts[0] || '';
                  const studentSurname = studentParts.length > 1 ? studentParts[studentParts.length - 1] : '';

                  // Get just the father's first name
                  const fatherParts = fName.trim().split(/\s+/);
                  const fatherFirst = fatherParts[0] || '';

                  // Build the new Indian naming convention: STUDENT_FIRST FATHER_FIRST STUDENT_SURNAME
                  if (fatherFirst) {
                    if (studentSurname && studentSurname !== studentFirst) {
                      return `${studentFirst} ${fatherFirst} ${studentSurname}`;
                    } else {
                      return `${studentFirst} ${fatherFirst}`;
                    }
                  }
                  return sName;
                })()}
              </h3>
              <p className="text-xs text-slate-400">
                Registration No: <span className="font-mono text-white font-semibold">{previewCert.student_code || 'GSA-ATH'}</span> | DOB: <span className="text-white font-semibold">{previewCert.dob ? new Date(previewCert.dob).toLocaleDateString('en-IN') : 'On File'}</span>
              </p>
              <p className="text-xs text-slate-300 mt-2">
                has successfully passed the comprehensive examination and secured the rank of
              </p>
              <div className="inline-block bg-amber-500/20 border border-amber-400/50 rounded-lg px-4 py-1 text-sm font-black text-amber-300">
                {previewCert.to_rank_name} ({previewCert.discipline_name})
              </div>
            </div>

            <div className="grid grid-cols-2 text-left text-xs gap-3 pt-2 text-slate-400">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Represented From</span>
                <span className="font-semibold text-white">{previewCert.represented_from}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-slate-500 uppercase">Exam Date</span>
                <span className="font-semibold text-white">{new Date(previewCert.promoted_at).toLocaleDateString('en-IN')}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Certificate Serial</span>
                <span className="font-mono font-bold text-amber-400">{previewCert.certificate_number}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-slate-500 uppercase">Chief Examiner</span>
                <span className="font-semibold text-white">{previewCert.examiner_name}</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => handleDownloadCertificate(previewCert)}
                disabled={downloadingCertId === previewCert.id}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs py-2.5 px-5 shadow-lg shadow-orange-500/20"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadingCertId === previewCert.id ? 'Generating High-Res PDF...' : 'Download Official PDF Certificate'}
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                variant="outline"
                className="w-full sm:w-auto text-xs py-2.5 px-4 border-white/20 text-slate-300 hover:text-white hover:bg-white/5"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Certificate
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Discipline *</label>
              <select
                disabled={Boolean(editingBeltRank)}
                value={beltForm.disciplineCode}
                onChange={(e) => setBeltForm({ ...beltForm, disciplineCode: e.target.value })}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Rank Order / Level *</label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={beltForm.rankOrder}
                onChange={(e) => setBeltForm({ ...beltForm, rankOrder: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Rank / Belt Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Yellow Belt (8th Kyu) or Meythari Level 1"
              value={beltForm.rankName}
              onChange={(e) => setBeltForm({ ...beltForm, rankName: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-2 p-3 bg-slate-900/60 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                Belt Color Category *
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomColorInput(!isCustomColorInput)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center gap-1"
                >
                  {isCustomColorInput ? 'Select from Presets' : '+ Type Custom'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManageCategoriesOpen(true)}
                  className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-medium"
                  title="Configure & Manage Academy Belt Categories"
                >
                  <Settings2 className="w-3 h-3 text-amber-400" />
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
                    className="flex-1 bg-[#0F172A] border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
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
                    className="text-[11px] h-8 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 whitespace-nowrap"
                    title="Save this custom name to the persistent category dropdown"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Save Category
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
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
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {Array.from(new Set(customBeltCategories.map((c) => c.group))).map((groupName) => (
                  <optgroup key={groupName} label={groupName} className="bg-[#0A1120] text-slate-300 font-bold">
                    {customBeltCategories
                      .filter((c) => c.group === groupName)
                      .map((cat) => (
                        <option key={cat.id} value={cat.name} className="text-white py-1">
                          {cat.name}
                        </option>
                      ))}
                  </optgroup>
                ))}

                {Array.from(new Set(allRanks.map((r) => r.belt_color).filter(Boolean)))
                  .filter((c) => !customBeltCategories.some((cat) => cat.name.toLowerCase() === c.toLowerCase()))
                  .length > 0 && (
                  <optgroup label="Active In Database Curriculum" className="bg-[#0A1120] text-amber-400 font-bold">
                    {Array.from(new Set(allRanks.map((r) => r.belt_color).filter(Boolean)))
                      .filter((c) => !customBeltCategories.some((cat) => cat.name.toLowerCase() === c.toLowerCase()))
                      .map((c) => (
                        <option key={c} value={c} className="text-white">
                          {c}
                        </option>
                      ))}
                  </optgroup>
                )}

                <option value="__CUSTOM__" className="text-amber-400 font-bold bg-amber-950/40">
                  ➕ Type Custom Belt Color / Category...
                </option>
              </select>
            )}

            {/* Live Visual Badge Preview */}
            <div className="mt-2.5 p-2 rounded-lg bg-slate-950/60 border border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Live Belt Badge Preview:
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border shadow-sm ${getBeltBadgeClass(beltForm.beltColor)}`}>
                {beltForm.beltColor || 'White Belt'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Belt Grade Title / Mastery Description</label>
            <input
              type="text"
              placeholder="e.g. बालशिष्य, Kata & Stances, or Form Mastery"
              value={beltForm.description}
              onChange={(e) => setBeltForm({ ...beltForm, description: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Official Examination Syllabus (Katas, Weapons, Techniques)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. TAIKYOKU SHODAN, TAIKYOKU NIDAN | KATHI CHAUMUKHI or STICK BASICS"
              value={beltForm.syllabus}
              onChange={(e) => setBeltForm({ ...beltForm, syllabus: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Displays on athlete curriculum and grading examination records as per the official academy poster.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
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
          <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/20 rounded-xl text-xs text-slate-300">
            <div className="flex items-center gap-2 text-white font-bold mb-1">
              <Palette className="w-4 h-4 text-amber-400" />
              <span>Full Admin Control Over Belt Colors &amp; Sashes</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Add custom martial arts belts, sashes (Kalari), or dual combinations. These categories will be available across the Academy curriculum, student promotions, and certificate registries.
            </p>
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="p-3.5 bg-slate-900/80 rounded-xl border border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
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
                  className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <select
                  value={newCategoryGroup}
                  onChange={(e) => setNewCategoryGroup(e.target.value)}
                  className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
                <span className="text-[11px] text-slate-400">Live Preview:</span>
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
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Belt / Category Name &amp; Group
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="text-slate-400 hover:text-white p-1 rounded"
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
                    className="w-full bg-[#0F172A] border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <select
                    value={editingCategory.group}
                    onChange={(e) => setEditingCategory({ ...editingCategory, group: e.target.value })}
                    className="w-full bg-[#0F172A] border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
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
                  <span className="text-[11px] text-slate-400">Live Preview:</span>
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {groupName} ({customBeltCategories.filter((c) => c.group === groupName).length})
                  </span>
                  <span className="text-[9px] text-slate-500 flex items-center gap-1">
                    <ArrowUpDown className="w-2.5 h-2.5" /> Kram Badalne Ke Liye Teer (↑/↓) Dabayein
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {customBeltCategories
                    .filter((c) => c.group === groupName)
                    .map((cat, idx, arr) => (
                      <div
                        key={cat.id}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-white/10 flex items-center justify-between gap-2 group hover:border-amber-500/40 transition-all shadow-sm"
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
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded transition-colors disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                            title="Move Up (Kram Upar)"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(cat.id, 'DOWN')}
                            disabled={idx === arr.length - 1}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded transition-colors disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                            title="Move Down (Kram Niche)"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategory({ id: cat.id, name: cat.name, group: cat.group })}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded transition-colors ml-1"
                            title={`Edit "${cat.name}"`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
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

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleResetCategories}
              className="text-[11px] text-slate-400 hover:text-rose-300 underline"
            >
              Reset to Defaults
            </button>
            <Button
              type="button"
              onClick={() => setIsManageCategoriesOpen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
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
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Discipline / Section Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Kung Fu, Taekwondo, Kickboxing, Boxing, Judo"
              value={disciplineForm.name}
              onChange={(e) => setDisciplineForm({ ...disciplineForm, name: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Creates a dedicated belt curriculum section and allows athlete belt assignments.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Description / Tagline (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Traditional Chinese Martial Art, Wushu & Sanda"
              value={disciplineForm.description}
              onChange={(e) => setDisciplineForm({ ...disciplineForm, description: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
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
