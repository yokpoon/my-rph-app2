'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  INITIAL_SCHOOL_CONFIG,
  INITIAL_TEACHERS,
  INITIAL_TIMETABLE,
  INITIAL_RPH_RECORDS,
  INITIAL_ACADEMIC_WEEKS,
  getActiveAcademicWeeks,
  KPM_SYLLABUS_ROLLOUT,
  INITIAL_PENYEMAK_GROUPS,
  generateInitialYearlyRecords,
  calculateTeacherMatrixSummary,
  formatToDayMonth,
  formatToDayMonthYear,
  SchoolConfig,
  TeacherProfile,
  TimetableSlot,
  RphRecord,
  AcademicWeek,
  RphStatus,
  UserRole,
  TeacherJawatan,
  MatrixCellStatus,
  MatrixCellRecord,
  PenyemakGroupDef,
  AuthUserSession,
  SUPERADMIN_PROFILE,
} from '@/lib/mockData';
import {
  generateDeterministicRph,
  buildSingleGeminiPrompt,
  parseSingleGeminiResponse,
  buildWeeklyBatchPrompt,
  parseWeeklyBatchResponse,
  isJawiOrArabicSubject,
} from '@/lib/promptEngine';
import {
  KRMJ_DIMENSIONS,
  NILAI_SIVIK_KPM,
  getKrmjById,
  getSivikById,
} from '@/lib/krmjAndSivikData';
import {
  ARCHIVED_YEARS_LIST,
  PRODUCTION_GAS_SCRIPT_TEMPLATE,
  fetchArchivedRphRecords,
  dumpAnnualRphToGas,
  openPrintableFullYearRphPdf,
} from '@/lib/archiveEngine';
import {
  exportSingleRphToDocx,
  openPrintableRphWindow,
  exportYearlyMatrixToCSV,
  openPrintableYearlyMatrix,
} from '@/lib/exportDocx';
import {
  TakwimExtractionResult,
  KPM_TAKWIM_2027_KUMPULAN_B,
  KPM_TAKWIM_2026_KUMPULAN_B,
  extractTakwimFromFile,
} from '@/lib/takwimExtractor';
import {
  fetchRptJson,
  getEffectiveRpt,
  saveCustomRpt,
  resetCustomRpt,
  isCustomRptModified,
  getTeacherRptAssignments,
  saveTeacherRptAssignments,
  openPrintableRptWindow,
  matchRptWithDskp,
  findMatchingSpsForSk,
  extractSkCode,
  resolveFullSkText,
  resolveFullSpText,
  RptRecord,
  RptMatchResult,
  TeacherRptAssignment,
  DSKP_TO_RPT_CODE_MAP,
} from '@/lib/rptEngine';
import {
  SidebarNavItem,
  LayoutDashboard,
  Sparkles,
  FileEdit,
  CalendarDays,
  BookOpen,
  ShieldCheck,
  LineChart,
  CalendarRange,
  Users,
  Settings,
  LogOut,
  Pin,
  PinOff,
  Menu,
  X,
} from '@/components/SidebarIcons';
import {
  supabase,
  isSupabaseConfigured,
  signInWithGoogleOAuth,
  signOutFromSupabase,
  fetchTeachersFromDb,
  saveTeacherToDb,
  deleteTeacherFromDb,
  fetchRphRecordsFromDb,
  saveRphRecordToDb,
  fetchTimetableFromDb,
  saveTimetableSlotToDb,
  deleteTimetableSlotFromDb,
  deleteRphRecordFromDb,
  whitelistUserInDb,
  fetchSchoolConfigFromDb,
  saveSchoolConfigToDb,
  fetchAcademicWeeksFromDb,
  saveAcademicWeeksToDb,
} from '@/lib/supabaseClient';

interface DskpSubjectMeta {
  name: string;
  slug: string;
  grades: string[];
}

const DEFAULT_DSKP_META: DskpSubjectMeta[] = [
  { name: 'BAHASA CINA SJKC 华校华语', slug: 'bahasa_cina_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'BAHASA MELAYU SJKC 华校国语', slug: 'bahasa_melayu_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'BAHASA INGGERIS SJKC 华校英语', slug: 'bahasa_inggeris_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'MATEMATIK SJKC 华小数学', slug: 'matematik_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'SAINS SJKC 华校科学', slug: 'sains_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'SEJARAH SJKC 华校历史', slug: 'sejarah_sjkc', grades: ['4', '5', '6'] },
  { name: 'RBT SJKC 华校设计与工艺', slug: 'rbt_sjkc', grades: ['4', '5', '6'] },
  { name: 'PENDIDIKAN MORAL SJKC 华校道德教育', slug: 'pendidikan_moral_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'PENDIDIKAN SENI SJKC 华校美术', slug: 'pendidikan_seni_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'PENDIDIKAN MUZIK SJKC 华校音乐', slug: 'pendidikan_muzik_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'PENDIDIKAN JASMANI SJKC 华校体育', slug: 'pendidikan_jasmani_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'PENDIDIKAN KESIHATAN SJKC 华校健康教育', slug: 'pendidikan_kesihatan_sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
  { name: 'TMK SJKC 华校信息与通信技术', slug: 'tmk_sjkc', grades: ['5', '6'] },
  { name: 'PENDIDIKAN ISLAM SJKC', slug: 'sjkc', grades: ['1', '2', '3', '4', '5', '6'] },
];

type SubjectDskpTree = Record<string, Record<string, string[]>>;
type NavTab =
  | 'dashboard'
  | 'rph-builder'
  | 'rph-drafts'
  | 'my-timetable'
  | 'my-rpt'
  | 'admin-review'
  | 'yearly-matrix'
  | 'settings'
  | 'roster';

// Helper to reliably fetch DSKP json on localhost, custom domain, or GitHub Pages
const fetchDskpJson = async (filename: string) => {
  const candidates: string[] = [];
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && !segments[0].includes('.')) {
      candidates.push(`/${segments[0]}/dskp/${filename}`);
    }
  }
  candidates.push(`./dskp/${filename}`);
  candidates.push(`/dskp/${filename}`);
  candidates.push(`dskp/${filename}`);

  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
  }
  return null;
};

export default function ERphColorAdminApp() {
  const [mounted, setMounted] = useState<boolean>(false);
  // Navigation & Active Persona
  const [activeNav, setActiveNav] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);

  // Load active tab and pinned state from localStorage on mount
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('erph_active_nav_tab_v1') as NavTab | null;
      if (savedTab) {
        setActiveNav(savedTab);
      }
      const savedPin = localStorage.getItem('erph_sidebar_pinned');
      if (savedPin !== null) {
        setIsSidebarPinned(savedPin === 'true');
      }
    } catch (e) {}
  }, []);

  // Save activeNav to localStorage on every change
  useEffect(() => {
    if (mounted && activeNav) {
      try {
        localStorage.setItem('erph_active_nav_tab_v1', activeNav);
      } catch (e) {}
    }
  }, [activeNav, mounted]);

  const toggleSidebarPin = () => {
    setIsSidebarPinned((prev) => {
      const nextVal = !prev;
      try {
        localStorage.setItem('erph_sidebar_pinned', String(nextVal));
      } catch (e) {}
      return nextVal;
    });
  };

  const isSidebarExpanded = mobileMenuOpen || isSidebarPinned || isSidebarHovered;

  const navigateTo = (tab: NavTab) => {
    setActiveNav(tab);
    try {
      localStorage.setItem('erph_active_nav_tab_v1', tab);
    } catch (_) {}
    setMobileMenuOpen(false);
  };

  // 4 Management / Pentadbir positions: GB, GPK1, GPK HEM, GPK KK (or GPK KOKO)
  const PENTADBIR_JAWATAN: TeacherJawatan[] = ['GB', 'GPK1', 'GPK HEM', 'GPK KOKO', 'GPK KK'];

  // Hydration Mount State (Prevents Next.js Server-Client text mismatch)
  

  // User Authentication & Session State (Production Mode: Defaults to unauthenticated)
  const [authSession, setAuthSession] = useState<AuthUserSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Account Settings Modal & Google Login States
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [accountActiveTab, setAccountActiveTab] = useState<'profil' | 'keselamatan' | 'sesi'>('profil');
  // Login Form States
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Change Password States in Account Settings
  const [passwordForm, setPasswordForm] = useState<{ current: string; newPass: string; confirmPass: string }>({
    current: '',
    newPass: '',
    confirmPass: '',
  });

  // Persistent App State - Clean Production Start (Populated live by Admin)
  const [school, setSchool] = useState<SchoolConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('erph_school_config_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.name || parsed.code)) return { ...INITIAL_SCHOOL_CONFIG, ...parsed };
        }
      } catch (_) {}
    }
    return INITIAL_SCHOOL_CONFIG;
  });
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [rphRecords, setRphRecords] = useState<RphRecord[]>([]);

  // Academic Weeks Management (Feature 1 & 2: Weeks 1 - 45, Weeks 43-45 hidden unless Friday date set)
  const [academicWeeks, setAcademicWeeks] = useState<AcademicWeek[]>(INITIAL_ACADEMIC_WEEKS);
  const activeAcademicWeeks = useMemo(() => getActiveAcademicWeeks(academicWeeks), [academicWeeks]);

  // Advance Week Working State (Feature 1: Not fixed to current week!)
  const [builderWeek, setBuilderWeek] = useState<number>(INITIAL_SCHOOL_CONFIG.currentWeek);
  const [batchWeek, setBatchWeek] = useState<number>(INITIAL_SCHOOL_CONFIG.currentWeek);
  const [draftWeekFilter, setDraftWeekFilter] = useState<number>(INITIAL_SCHOOL_CONFIG.currentWeek);
  const [adminReviewWeek, setAdminReviewWeek] = useState<number>(INITIAL_SCHOOL_CONFIG.currentWeek);

  // Yearly Matrix State & Configuration
  const [penyemakGroups, setPenyemakGroups] = useState<PenyemakGroupDef[]>(INITIAL_PENYEMAK_GROUPS);
  const [yearlyRecords, setYearlyRecords] = useState<Record<string, Record<number, MatrixCellRecord>>>({});

  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');
  const [matrixStatusFilter, setMatrixStatusFilter] = useState<'ALL' | 'LEWAT' | 'TIDAK_HANTAR'>('ALL');
  const [adminPanelSubTab, setAdminPanelSubTab] = useState<'weekly' | 'yearly'>('weekly');
  const [inspectMatrixCell, setInspectMatrixCell] = useState<{
    teacher: TeacherProfile;
    weekNumber: number;
    cell: MatrixCellRecord;
  } | null>(null);
  const [editCellForm, setEditCellForm] = useState<{
    status: MatrixCellStatus;
    customDate: string;
    notes: string;
    verifiedBy: string;
  }>({
    status: 'TEPAT',
    customDate: '',
    notes: '',
    verifiedBy: '',
  });

  // Hydrate client-side state from localStorage & Supabase safely after initial mount
  useEffect(() => {
    try {
      // 1. Instant local storage hydration for all entities
      try {
        const localSchool = localStorage.getItem('erph_school_config_v1');
        if (localSchool) {
          const parsedSchool = JSON.parse(localSchool);
          if (parsedSchool && parsedSchool.name) setSchool(parsedSchool);
        }
        const localWeeks = localStorage.getItem('erph_academic_weeks_v1');
        if (localWeeks) {
          const parsedWeeks = JSON.parse(localWeeks);
          if (Array.isArray(parsedWeeks) && parsedWeeks.length > 0) setAcademicWeeks(parsedWeeks);
        }
        const localT = localStorage.getItem('erph_live_teachers_v1');
        if (localT) {
          const parsedT = JSON.parse(localT);
          if (Array.isArray(parsedT) && parsedT.length > 0) setTeachers(parsedT);
        }
        const localTime = localStorage.getItem('erph_live_timetable_v1');
        if (localTime) {
          const parsedTime = JSON.parse(localTime);
          if (Array.isArray(parsedTime) && parsedTime.length > 0) setTimetable(parsedTime);
        }
        const localRph = localStorage.getItem('erph_live_rph_records_v1');
        if (localRph) {
          const parsedRph = JSON.parse(localRph);
          if (Array.isArray(parsedRph) && parsedRph.length > 0) setRphRecords(parsedRph);
        }
      } catch (err) {
        console.warn('Local storage early hydration note:', err);
      }

      // 2. Fetch full datasets from Supabase Cloud immediately on mount
      if (isSupabaseConfigured) {
        fetchSchoolConfigFromDb().then((dbSchool) => {
          if (dbSchool && dbSchool.name) {
            setSchool(dbSchool);
            try { localStorage.setItem('erph_school_config_v1', JSON.stringify(dbSchool)); } catch (_) {}
          }
        });

        fetchAcademicWeeksFromDb().then((dbWeeks) => {
          if (dbWeeks && dbWeeks.length > 0) {
            setAcademicWeeks(dbWeeks);
            try { localStorage.setItem('erph_academic_weeks_v1', JSON.stringify(dbWeeks)); } catch (_) {}
          }
        });
        fetchTeachersFromDb().then((dbTeachers) => {
          if (dbTeachers && dbTeachers.length > 0) {
            setTeachers((prev) => {
              const combined = [...prev];
              for (const dt of dbTeachers) {
                const idx = combined.findIndex((t) => t.id === dt.id || t.email.toLowerCase() === dt.email.toLowerCase());
                if (idx >= 0) combined[idx] = { ...combined[idx], ...dt };
                else combined.push(dt);
              }
              try { localStorage.setItem('erph_live_teachers_v1', JSON.stringify(combined)); } catch (_) {}
              return combined;
            });
          }
        });

        fetchTimetableFromDb().then((dbTimetable) => {
          if (dbTimetable && dbTimetable.length > 0) {
            setTimetable((prev) => {
              const combined = [...prev];
              for (const slot of dbTimetable) {
                const idx = combined.findIndex((s) => s.id === slot.id);
                if (idx >= 0) combined[idx] = { ...combined[idx], ...slot };
                else combined.push(slot);
              }
              try { localStorage.setItem('erph_live_timetable_v1', JSON.stringify(combined)); } catch (_) {}
              return combined;
            });
          }
        });

        fetchRphRecordsFromDb().then((dbRphs) => {
          if (dbRphs && dbRphs.length > 0) {
            setRphRecords((prev) => {
              const combined = [...prev];
              for (const r of dbRphs) {
                const idx = combined.findIndex((x) => x.id === r.id);
                if (idx >= 0) combined[idx] = { ...combined[idx], ...r };
                else combined.push(r);
              }
              try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(combined)); } catch (_) {}
              return combined;
            });
          }
        });
      }

      // 3. Hydrate session from localStorage
      const savedSession = localStorage.getItem('erph_auth_session_v1');
      const flag = localStorage.getItem('erph_is_authenticated_v1');
      if (flag === 'true' && savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.userId) {
          setAuthSession(parsed);
          setIsAuthenticated(true);
          setCurrentUserId(parsed.userId);
          setWeeklyTeacherId(parsed.userId);
        }
      }

      // Live Supabase Authentication Listener (Production)
      if (isSupabaseConfigured && supabase) {
        const resolveUserFromSession = async (sessionUser: any) => {
          if (!sessionUser?.email) return;
          const userEmail = sessionUser.email.toLowerCase();

          // 1. Fetch latest teachers from DB first to get correct configured role
          let dbTeacher: any = null;
          try {
            const { data } = await supabase
              .from('teachers')
              .select('*')
              .ilike('email', userEmail)
              .maybeSingle();
            if (data) dbTeacher = data;
          } catch (e) {
            console.warn('Teacher lookup error:', e);
          }

          // 2. Query live whitelisted_users table from Supabase
          let whitelistRole: string | null = null;
          try {
            const { data } = await supabase
              .from('whitelisted_users')
              .select('*')
              .ilike('email', userEmail)
              .maybeSingle();

            if (data?.role) {
              whitelistRole = data.role.toLowerCase().trim();
            }
          } catch (err) {
            console.warn('Whitelist query note:', err);
          }

          // 3. Superadmin check
          if (
            whitelistRole === 'superadmin' ||
            userEmail.includes('sekolah-3908') ||
            userEmail.includes('yokpoon') ||
            userEmail === SUPERADMIN_PROFILE.email.toLowerCase()
          ) {
            const superProfile: TeacherProfile = {
              ...SUPERADMIN_PROFILE,
              id: 'superadmin',
              email: userEmail,
              name: 'SJKC YOK POON',
            };
            setTeachers((prev) => {
              const idx = prev.findIndex((t) => t.id === 'superadmin' || t.email.toLowerCase() === userEmail);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...superProfile };
                return copy;
              }
              return [superProfile, ...prev];
            });
            saveTeacherToDb(superProfile).catch((err) => console.warn('saveTeacherToDb err:', err));
            handlePerformLogin(superProfile, 'google');
            return;
          }

          // 4. Admin / Pentadbir check
          if (whitelistRole === 'admin' || userEmail.includes('g-29021326') || dbTeacher?.role === 'pk_pentadbiran' || dbTeacher?.role === 'guru_besar') {
            const adminProfile: TeacherProfile = {
              id: dbTeacher?.id || sessionUser.id || 'admin_' + Date.now(),
              name: dbTeacher?.name || sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || userEmail.split('@')[0].toUpperCase(),
              chineseName: dbTeacher?.chinese_name || '',
              email: userEmail,
              role: (dbTeacher?.role as UserRole) || 'pk_pentadbiran',
              jawatan: dbTeacher?.jawatan || (dbTeacher?.role === 'guru_besar' ? 'GB' : 'GPK1'),
              panitia: dbTeacher?.panitia || 'Pentadbiran & Kurikulum',
              subjectSlug: dbTeacher?.subject_slug || 'bahasa_melayu_sjkc',
            };
            setTeachers((prev) => {
              const idx = prev.findIndex((t) => t.email.toLowerCase() === userEmail);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...adminProfile };
                return copy;
              }
              return [adminProfile, ...prev];
            });
            saveTeacherToDb(adminProfile).catch((err) => console.warn('saveTeacherToDb err:', err));
            handlePerformLogin(adminProfile, 'google');
            return;
          }

          // 5. Existing teacher record from database or local state
          if (dbTeacher) {
            const existingProfile: TeacherProfile = {
              id: dbTeacher.id,
              name: dbTeacher.name,
              chineseName: dbTeacher.chinese_name || '',
              email: userEmail,
              role: (dbTeacher.role as UserRole) || 'guru',
              jawatan: dbTeacher.jawatan || 'GAB',
              panitia: dbTeacher.panitia || 'Bahasa Cina',
              subjectSlug: dbTeacher.subject_slug || 'bahasa_cina_sjkc',
            };
            setTeachers((prev) => {
              const idx = prev.findIndex((t) => t.email.toLowerCase() === userEmail);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...existingProfile };
                return copy;
              }
              return [existingProfile, ...prev];
            });
            handlePerformLogin(existingProfile, 'google');
            return;
          }

          // 6. Whitelist enforcement check: Reject any user not explicitly whitelisted
          if (!whitelistRole && !dbTeacher) {
            try {
              await supabase.auth.signOut();
            } catch (_) {}
            setIsAuthenticated(false);
            setAuthSession(null);
            localStorage.removeItem('erph_is_authenticated_v1');
            localStorage.removeItem('erph_auth_session_v1');
            setLoginError(`Akaun e-mel (${userEmail}) tiada dalam Senarai Putih (Whitelist) sistem. Sila hubungi Pentadbir Sekolah untuk kebenaran akses.`);
            return;
          }

          // 7. Whitelisted new user: allow login and initialize profile
          const googleName =
            sessionUser.user_metadata?.full_name ||
            sessionUser.user_metadata?.name ||
            userEmail.split('@')[0].toUpperCase();

          const newProfile: TeacherProfile = {
            id: sessionUser.id || 'usr_' + Date.now(),
            name: googleName,
            chineseName: '',
            email: userEmail,
            role: (whitelistRole as UserRole) || 'guru',
            panitia: 'Umum',
            subjectSlug: 'bahasa_melayu_sjkc',
          };

          setTeachers((prev) => {
            const idx = prev.findIndex((t) => t.email.toLowerCase() === userEmail);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...newProfile };
              return copy;
            }
            return [newProfile, ...prev];
          });
          saveTeacherToDb(newProfile).catch((err) => console.warn('saveTeacherToDb err:', err));

          handlePerformLogin(newProfile, 'google');
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            resolveUserFromSession(session.user);
            if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            resolveUserFromSession(session.user);
            if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        });
      }

      const savedMatrix = localStorage.getItem('erph_yearly_matrix_records_v2');
      if (savedMatrix) {
        const parsed = JSON.parse(savedMatrix);
        if (parsed) setYearlyRecords(parsed);
      }
      const savedGas = localStorage.getItem('erph_gas_webapp_url');
      if (savedGas) {
        setGasWebAppUrl(savedGas);
      }


    } catch (e) {
      console.error('Error hydrating session from localStorage:', e);
    } finally {
      setMounted(true);
    }
  }, []);

  // Save yearly matrix to localStorage (only after component is mounted)
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      try {
        localStorage.setItem('erph_yearly_matrix_records_v2', JSON.stringify(yearlyRecords));
      } catch (e) {
        console.error('Error saving yearly matrix:', e);
      }
    }
  }, [yearlyRecords, mounted]);

  // Auto-sync working weeks whenever current school week changes or hydrates
  useEffect(() => {
    if (school && school.currentWeek) {
      setAdminReviewWeek(school.currentWeek);
      setBuilderWeek(school.currentWeek);
      setBatchWeek(school.currentWeek);
      setDraftWeekFilter(school.currentWeek);
    }
  }, [school.currentWeek]);

  // Persist school config to localStorage whenever updated
  useEffect(() => {
    if (mounted && typeof window !== 'undefined' && school.name) {
      try {
        localStorage.setItem('erph_school_config_v1', JSON.stringify(school));
      } catch (e) {}
    }
  }, [school, mounted]);

  // Persist academic weeks to localStorage & Supabase whenever updated
  useEffect(() => {
    if (mounted && typeof window !== 'undefined' && academicWeeks.length > 0) {
      try {
        localStorage.setItem('erph_academic_weeks_v1', JSON.stringify(academicWeeks));
      } catch (e) {}
      saveAcademicWeeksToDb(academicWeeks).catch((err) => console.warn('saveAcademicWeeksToDb err:', err));
    }
  }, [academicWeeks, mounted]);

  // Persist teachers to localStorage whenever updated
  useEffect(() => {
    if (mounted && typeof window !== 'undefined' && teachers.length > 0) {
      try {
        localStorage.setItem('erph_live_teachers_v1', JSON.stringify(teachers));
      } catch (e) {}
    }
  }, [teachers, mounted]);

  // Persist timetable to localStorage whenever updated
  useEffect(() => {
    if (mounted && typeof window !== 'undefined' && timetable.length > 0) {
      try {
        localStorage.setItem('erph_live_timetable_v1', JSON.stringify(timetable));
      } catch (e) {}
    }
  }, [timetable, mounted]);

  // Persist rphRecords to localStorage whenever updated
  useEffect(() => {
    if (mounted && typeof window !== 'undefined' && rphRecords.length > 0) {
      try {
        localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(rphRecords));
      } catch (e) {}
    }
  }, [rphRecords, mounted]);

  // Takwim Sub-tab
  const [takwimTab, setTakwimTab] = useState<'mingguan' | 'profil'>('mingguan');

  // Teacher Profile Editing State (Feature 3)
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);


  // Notification Drawer in Header
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // DSKP Static JSON State (Non-cantum only)
  const [dskpMeta, setDskpMeta] = useState<DskpSubjectMeta[]>(DEFAULT_DSKP_META);
  const [subjectData, setSubjectData] = useState<SubjectDskpTree | null>(null);
  const [loadingSubject, setLoadingSubject] = useState(false);
  const [rptRecords, setRptRecords] = useState<RptRecord[]>([]);
  const [matchedRptInfo, setMatchedRptInfo] = useState<RptMatchResult | null>(null);
  const [loadingRpt, setLoadingRpt] = useState(false);

  // Teacher RPT Management State (Viewing, Editing, Adding custom RPT per subject)
  const [teacherRptAssignments, setTeacherRptAssignments] = useState<TeacherRptAssignment[]>([]);
  const [selectedRptAssignId, setSelectedRptAssignId] = useState<string>('');
  const [activeRptList, setActiveRptList] = useState<RptRecord[]>([]);
  const [loadingActiveRpt, setLoadingActiveRpt] = useState<boolean>(false);
  const [rptSearchQuery, setRptSearchQuery] = useState<string>('');
  const [rptFilterWeek, setRptFilterWeek] = useState<number | 'ALL'>('ALL');
  const [editingRptRecord, setEditingRptRecord] = useState<RptRecord | null>(null);
  const [editingRptOriginalIndex, setEditingRptOriginalIndex] = useState<number>(-1);
  const [isEditingRptModalOpen, setIsEditingRptModalOpen] = useState<boolean>(false);
  const [isAddRptSubjectModalOpen, setIsAddRptSubjectModalOpen] = useState<boolean>(false);
  const [newRptSubjectSlug, setNewRptSubjectSlug] = useState<string>('bahasa_cina_sjkc');
  const [newRptGrade, setNewRptGrade] = useState<string>('4');
  const [newRptClassName, setNewRptClassName] = useState<string>('');
  const [customRptModifiedMap, setCustomRptModifiedMap] = useState<Record<string, boolean>>({});
  const [showFullRptText, setShowFullRptText] = useState<boolean>(true);
  const [activeRptDskpTree, setActiveRptDskpTree] = useState<Record<string, string[]> | null>(null);

  // RPH Builder State (Single & Weekly Batch)
  const [rphMode, setRphMode] = useState<'single' | 'weekly-batch'>('single');
  const [selectedDay, setSelectedDay] = useState<'ISNIN' | 'SELASA' | 'RABU' | 'KHAMIS' | 'JUMAAT'>('ISNIN');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('4');
  const [selectedClassName, setSelectedClassName] = useState<string>('4 Merah (四红班)');
  const [selectedTimeStart, setSelectedTimeStart] = useState<string>('08:00');
  const [selectedTimeEnd, setSelectedTimeEnd] = useState<string>('09:00');
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string>('bahasa_cina_sjkc');
  const [selectedSk, setSelectedSk] = useState<string>('');
  const [selectedSps, setSelectedSps] = useState<string[]>([]);
  const [pedagogy, setPedagogy] = useState<string>('PAK-21 Think-Pair-Share (思考-配对-分享)');
  const [pastedGeminiText, setPastedGeminiText] = useState<string>('');
  const [previewRph, setPreviewRph] = useState<RphRecord | null>(null);

  // Inline Edit Mode for Live RPH Preview
  const [isEditingRph, setIsEditingRph] = useState<boolean>(false);
  const [editBuffer, setEditBuffer] = useState<{
    sk: string;
    sps: string;
    objectives: string;
    criteria: string;
    induction: string;
    activities: string;
    closure: string;
    emk: string;
    bbm: string;
    reflection: string;
  }>({
    sk: "",
    sps: "",
    objectives: "",
    criteria: "",
    induction: "",
    activities: "",
    closure: "",
    emk: "",
    bbm: "",
    reflection: "",
  });

  // Weekly Batch Import State
  const [weeklyTeacherId, setWeeklyTeacherId] = useState<string>('t1');
  const [weeklyPasteText, setWeeklyPasteText] = useState<string>('');

  // Drafts Review & Edit Page State
  const [draftDayFilter, setDraftDayFilter] = useState<string>('ALL');
  const [editingDraftRecord, setEditingDraftRecord] = useState<RphRecord | null>(null);

  // Admin Review Drawer State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MENUNGGU' | 'DISAHKAN' | 'BELUM'>('ALL');
  const [inspectTeacher, setInspectTeacher] = useState<TeacherProfile | null>(null);
  const [adminFeedback, setAdminFeedback] = useState<string>(
    'Tahniah, perancangan PdP mematuhi standard DSKP SJK(C) & menerapkan aktiviti PAK-21 dengan jelas.'
  );
  const [selectedVerifier, setSelectedVerifier] = useState<'PK Pentadbiran' | 'Guru Besar'>('PK Pentadbiran');

  // Teacher Personal Timetable State (Diselaraskan terus dengan e-RPH)
  const [myTimetableDayFilter, setMyTimetableDayFilter] = useState<string>('ALL');
  const [myNewDay, setMyNewDay] = useState<'ISNIN' | 'SELASA' | 'RABU' | 'KHAMIS' | 'JUMAAT'>('ISNIN');
  const [myNewPeriod, setMyNewPeriod] = useState<number>(1);
  const [myNewTimeStart, setMyNewTimeStart] = useState<string>('07:30');
  const [myNewTimeEnd, setMyNewTimeEnd] = useState<string>('08:30');
  const [myNewGrade, setMyNewGrade] = useState<string>('4');
  const [myNewClassName, setMyNewClassName] = useState<string>('4 Merah (四红班)');
  const [myNewStudentCount, setMyNewStudentCount] = useState<number>(30);
  const [editingTimetableSlotId, setEditingTimetableSlotId] = useState<string | null>(null);
  const [myNewSubjectSlug, setMyNewSubjectSlug] = useState<string>('bahasa_cina_sjkc');
  const [myNewSk, setMyNewSk] = useState<string>('');

  // e-RPH Builder Selected Class Student Count
  const [selectedStudentCount, setSelectedStudentCount] = useState<number>(30);

  // Takwim Extraction Modal State
  const [builderRightTab, setBuilderRightTab] = useState<'DAY' | 'WEEK'>('DAY');

  // Additional Prompt Criteria State (KrMJ JPNJ & Pendidikan Sivik KPM)
  const [includeKrmj, setIncludeKrmj] = useState<boolean>(false);
  const [selectedKrmjId, setSelectedKrmjId] = useState<string>('KRMJ-01');
  const [includeSivik, setIncludeSivik] = useState<boolean>(false);
  const [selectedSivikCoreId, setSelectedSivikCoreId] = useState<string>('KS');
  const [selectedSivikSubId, setSelectedSivikSubId] = useState<string>('KS_01');

  // Annual Archive (Google Sheets GAS) & Past Year RPH Reuse State
  const [selectedArchiveYear, setSelectedArchiveYear] = useState<string>('SEMASA');
  const [archivedRecords, setArchivedRecords] = useState<RphRecord[]>([]);
  const [archiveSource, setArchiveSource] = useState<'GAS_CLOUD' | 'LOCAL_ARCHIVE'>('LOCAL_ARCHIVE');
  const [isLoadingArchive, setIsLoadingArchive] = useState<boolean>(false);
  const [gasWebAppUrl, setGasWebAppUrl] = useState<string>('');
  const [showGasCodeModal, setShowGasCodeModal] = useState<boolean>(false);
  const [isExportingArchive, setIsExportingArchive] = useState<boolean>(false);
  const archiveFileInputRef = useRef<HTMLInputElement>(null);
  const [showTakwimModal, setShowTakwimModal] = useState<boolean>(false);

  // Purge Drafts Confirmation Modal State
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);

  // Global Delete / Action Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    confirmText?: string;
    confirmColor?: "rose" | "amber" | "indigo";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const requestConfirmation = ({
    title,
    message,
    detail,
    confirmText = "Ya, Teruskan Padam",
    confirmColor = "rose",
    onConfirm,
  }: {
    title: string;
    message: string;
    detail?: string;
    confirmText?: string;
    confirmColor?: "rose" | "amber" | "indigo";
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      detail,
      confirmText,
      confirmColor,
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onConfirm();
      },
    });
  };

  // Archive Import Modal State & Payload
  const [showArchiveImportModal, setShowArchiveImportModal] = useState<boolean>(false);
  const [importedArchiveData, setImportedArchiveData] = useState<{
    fileName: string;
    academicYear: string;
    records: RphRecord[];
    timetable?: TimetableSlot[];
    teachers?: TeacherProfile[];
  } | null>(null);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState<string>('');
  const [takwimPreview, setTakwimPreview] = useState<TakwimExtractionResult | null>(null);
  const [isExtractingTakwim, setIsExtractingTakwim] = useState<boolean>(false);
  const takwimFileInputRef = useRef<HTMLInputElement>(null);

  // Settings New Teacher Form
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherChinese, setNewTeacherChinese] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPanitia, setNewTeacherPanitia] = useState('Bahasa Cina');
  const [newTeacherRole, setNewTeacherRole] = useState<UserRole>('guru');

  const currentUser: TeacherProfile = useMemo(() => {
    if (authSession) {
      const matched = teachers.find(
        (t) => t.id === authSession.userId || (authSession.email && t.email.toLowerCase() === authSession.email.toLowerCase())
      );
      if (matched) return matched;
      return {
        id: authSession.userId || 'admin1',
        name: authSession.name,
        chineseName: authSession.chineseName || '',
        email: authSession.email,
        role: authSession.role,
        jawatan: authSession.jawatan,
        panitia: authSession.panitia || 'Pentadbiran & Kurikulum',
        subjectSlug: 'bahasa_melayu_sjkc',
      };
    }
    if (currentUserId === 'superadmin' || currentUserId === 'YokPoon') {
      return SUPERADMIN_PROFILE;
    }
    return (
      teachers.find((t) => t.id === currentUserId) ||
      teachers[0] ||
      SUPERADMIN_PROFILE
    );
  }, [teachers, currentUserId, authSession]);

  // Role booleans: Superadmin has top-level privileges; 4 management positions (GB, GPK1, GPK HEM, GPK KK) are Pentadbir by default
  const isSuperadmin = currentUser.role === 'superadmin' || currentUser.id === 'superadmin';
  const isPentadbir =
    isSuperadmin ||
    currentUser.role === 'pk_pentadbiran' ||
    currentUser.role === 'guru_besar' ||
    (currentUser.jawatan && PENTADBIR_JAWATAN.includes(currentUser.jawatan));
  const isIct = isSuperadmin || currentUser.role === 'guru_ict_data';
  const isGuru = !isSuperadmin && !isPentadbir && !isIct;

  // Regular teachers list excluding superadmin (for matrix, roster, and general selection)
  const regularTeachers = useMemo(() => {
    return teachers.filter((t) => t.id !== 'superadmin' && t.role !== 'superadmin');
  }, [teachers]);


  // Load DSKP meta.json on mount (Strictly Non-Cantum via fetchDskpJson)
  useEffect(() => {
    fetchDskpJson('meta.json').then((data: DskpSubjectMeta[] | null) => {
      if (data && Array.isArray(data)) {
        const clean = data.filter(
          (s) => !s.slug.includes('bercantum') && !s.name.toLowerCase().includes('bercantum')
        );
        setDskpMeta(clean);
      }
    });
  }, []);

  // Filter available subjects (Tahun 1 - 6 only, No Bercantum)
  const availableSubjects = useMemo(() => {
    return dskpMeta.filter(
      (s) => !s.slug.includes('bercantum') && s.grades.includes(selectedGrade)
    );
  }, [dskpMeta, selectedGrade]);

  // Check if current grade is phased into Kurikulum 2027 (Starting from Tahun 1)
  const isSelectedGradeNewSyllabus = useMemo(() => {
    return selectedGrade === '1';
  }, [selectedGrade]);

  // Load selected subject DSKP & RPT JSON on demand, auto-matching with builderWeek
  useEffect(() => {
    if (!selectedSubjectSlug) return;
    let isMounted = true;
    setLoadingSubject(true);
    setLoadingRpt(true);

    Promise.all([
      fetchDskpJson(`${selectedSubjectSlug}.json`),
      getEffectiveRpt(currentUser.id, selectedSubjectSlug, selectedGrade),
    ])
      .then(([tree, rptList]: [SubjectDskpTree | null, RptRecord[]]) => {
        if (!isMounted) return;
        if (tree) {
          setSubjectData(tree);
        }
        setRptRecords(rptList || []);

        const gradeTree = tree && tree[selectedGrade] ? tree[selectedGrade] : null;
        const matchResult = matchRptWithDskp(rptList || [], builderWeek, gradeTree);
        setMatchedRptInfo(matchResult);

        // Check if an existing saved/submitted RPH already exists for this slot & week
        const existing = rphRecords.find(
          (r) =>
            r.teacherId === currentUser.id &&
            r.weekNumber === builderWeek &&
            r.day === selectedDay &&
            selectedSlotId &&
            !selectedSlotId.startsWith('custom_') &&
            r.slotId === selectedSlotId
        );

        if (existing) {
          setPreviewRph(existing);
          setSelectedSk(existing.sk);
          setSelectedSps(existing.sps);
        } else {
          setPreviewRph(null);
          if (matchResult.isMatched && matchResult.selectedSk) {
            setSelectedSk(matchResult.selectedSk);
            setSelectedSps(matchResult.matchedSps);
          } else if (gradeTree) {
            const skList = Object.keys(gradeTree);
            if (skList.length > 0) {
              setSelectedSk(skList[0]);
              setSelectedSps(gradeTree[skList[0]]?.slice(0, 1) || []);
            } else {
              setSelectedSk('');
              setSelectedSps([]);
            }
          } else {
            setSelectedSk('');
            setSelectedSps([]);
          }
        }
      })
      .catch((err) => console.error('Failed to load DSKP / RPT json', err))
      .finally(() => {
        if (isMounted) {
          setLoadingSubject(false);
          setLoadingRpt(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSubjectSlug, selectedGrade, builderWeek, selectedSlotId, selectedDay, currentUser.id]);

  // Handler to manually re-apply RPT recommendation for current week
  const handleApplyRptSuggestion = () => {
    if (matchedRptInfo && matchedRptInfo.selectedSk) {
      setSelectedSk(matchedRptInfo.selectedSk);
      setSelectedSps(matchedRptInfo.matchedSps);
      showToast(
        `✨ SK & SP dikemaskini mengikut RPT Minggu ${builderWeek} (${matchedRptInfo.theme || matchedRptInfo.selectedSk.slice(0, 30)})`
      );
    } else {
      showToast(`ℹ️ Tiada padanan khusus RPT untuk Minggu ${builderWeek}.`);
    }
  };

  // Day selection sync
  const handleSelectDay = (day: 'ISNIN' | 'SELASA' | 'RABU' | 'KHAMIS' | 'JUMAAT') => {
    setSelectedDay(day);
    const daySlots = timetable.filter((s) => s.teacherId === currentUser.id && s.day === day);
    if (daySlots.length > 0) {
      handleSelectDaySlot(daySlots[0], day);
    } else {
      setSelectedSlotId(null);
      const existing = rphRecords.find(
        (r) => r.teacherId === currentUser.id && r.weekNumber === builderWeek && r.day === day
      );
      setPreviewRph(existing || null);
      setIsEditingRph(false);
    }
  };

  // Slot selection sync
  const handleSelectDaySlot = (
    slot: TimetableSlot,
    targetDay?: 'ISNIN' | 'SELASA' | 'RABU' | 'KHAMIS' | 'JUMAAT'
  ) => {
    const day = targetDay || slot.day;
    setSelectedDay(day);
    setSelectedSlotId(slot.id);
    setSelectedGrade(slot.grade);
    setSelectedClassName(slot.className);
    setSelectedStudentCount(slot.studentCount || 30);
    setSelectedTimeStart(slot.timeStart);
    setSelectedTimeEnd(slot.timeEnd);
    setSelectedSubjectSlug(slot.subjectSlug);

    // Look for existing saved/submitted RPH for this slot and week
    const existing = rphRecords.find(
      (r) =>
        r.teacherId === currentUser.id &&
        r.weekNumber === builderWeek &&
        r.day === day &&
        r.slotId === slot.id
    );
    if (existing) {
      setPreviewRph(existing);
      setSelectedSk(existing.sk);
      setSelectedSps(existing.sps);
      setIsEditingRph(false);
      showToast(`ℹ️ Memaparkan rekod e-RPH sedia ada bagi ${day} (${slot.timeStart} – ${slot.timeEnd}) • Status: ${existing.status}`);
    } else {
      setPreviewRph(null);
      setIsEditingRph(false);
      showToast(`✅ Sesi ${slot.timeStart} – ${slot.timeEnd} dipilih: ${slot.className} • ${slot.subjectName}`);
    }
  };

  // Add a new / additional session for the day without overwriting existing
  const handleAddNewSessionForDay = () => {
    const newCustomSlotId = `custom_${Date.now()}`;
    setSelectedSlotId(newCustomSlotId);
    setSelectedTimeStart('10:30');
    setSelectedTimeEnd('11:30');
    setSelectedClassName('');
    setSelectedStudentCount(30);
    setPreviewRph(null);
    setIsEditingRph(false);
    showToast(`✨ Mod Sesi Baharu diaktifkan bagi hari ${selectedDay}. Sila pilih subjek & klik "Jana RPH Serta-Merta".`);
  };

  // ---------------------------------------------------------------------------
  // Teacher RPT Management Lifecycle & Handlers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser?.id) return;
    const assignments = getTeacherRptAssignments(currentUser.id, timetable);
    setTeacherRptAssignments(assignments);
    if (assignments.length > 0 && !selectedRptAssignId) {
      setSelectedRptAssignId(assignments[0].id);
    }
  }, [currentUser.id, timetable]);

  const activeRptAssignment = useMemo(() => {
    return (
      teacherRptAssignments.find((a) => a.id === selectedRptAssignId) ||
      teacherRptAssignments[0] ||
      null
    );
  }, [teacherRptAssignments, selectedRptAssignId]);

  useEffect(() => {
    if (!activeRptAssignment || !currentUser?.id) return;
    setLoadingActiveRpt(true);
    Promise.all([
      getEffectiveRpt(currentUser.id, activeRptAssignment.subjectSlug, activeRptAssignment.grade),
      fetchDskpJson(`${activeRptAssignment.subjectSlug}.json`),
    ])
      .then(([records, dskpTree]) => {
        setActiveRptList(records);
        if (dskpTree && dskpTree[activeRptAssignment.grade]) {
          setActiveRptDskpTree(dskpTree[activeRptAssignment.grade]);
        } else {
          setActiveRptDskpTree(null);
        }
        const isMod = isCustomRptModified(
          currentUser.id,
          activeRptAssignment.subjectSlug,
          activeRptAssignment.grade
        );
        setCustomRptModifiedMap((prev) => ({
          ...prev,
          [`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`]: isMod,
        }));
      })
      .catch((err) => console.error('Failed to load active RPT', err))
      .finally(() => setLoadingActiveRpt(false));
  }, [activeRptAssignment, currentUser?.id]);

  const handleOpenEditRptModal = (record: RptRecord, index: number) => {
    setEditingRptRecord({ ...record });
    setEditingRptOriginalIndex(index);
    setIsEditingRptModalOpen(true);
  };

  const handleOpenAddNewRptWeek = () => {
    if (!activeRptAssignment) return;
    const nextWeekNum = activeRptList.length > 0
      ? Math.max(...activeRptList.map((r) => r.week_number)) + 1
      : 1;

    const newRecord: RptRecord = {
      subject_code: DSKP_TO_RPT_CODE_MAP[activeRptAssignment.subjectSlug] || 'RPT',
      subject_name: activeRptAssignment.subjectName,
      grade: Number(activeRptAssignment.grade) || 4,
      academic_year: Number(school.academicYear.split('/')[0]) || 2026,
      week_number: nextWeekNum,
      week_label: `Minggu ${nextWeekNum}`,
      theme: '',
      sk_codes: [],
      sp_codes: [],
      remarks: '',
    };

    setEditingRptRecord(newRecord);
    setEditingRptOriginalIndex(-1); // -1 indicates new row
    setIsEditingRptModalOpen(true);
  };

  const handleSaveEditedRptRecord = (updated: RptRecord) => {
    if (!activeRptAssignment) return;
    let nextList = [...activeRptList];
    if (editingRptOriginalIndex >= 0 && editingRptOriginalIndex < nextList.length) {
      nextList[editingRptOriginalIndex] = updated;
    } else {
      nextList.push(updated);
    }
    nextList.sort((a, b) => a.week_number - b.week_number);
    setActiveRptList(nextList);
    saveCustomRpt(
      currentUser.id,
      activeRptAssignment.subjectSlug,
      activeRptAssignment.grade,
      nextList
    );
    setCustomRptModifiedMap((prev) => ({
      ...prev,
      [`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`]: true,
    }));
    setIsEditingRptModalOpen(false);
    setEditingRptRecord(null);
    showToast(`💾 RPT ${updated.week_label || `Minggu ${updated.week_number}`} berjaya dikemaskini & disimpan!`);
  };

  const handleDeleteRptRecord = (index: number) => {
    if (!activeRptAssignment) return;
    const target = activeRptList[index];
    const nextList = activeRptList.filter((_, i) => i !== index);
    setActiveRptList(nextList);
    saveCustomRpt(
      currentUser.id,
      activeRptAssignment.subjectSlug,
      activeRptAssignment.grade,
      nextList
    );
    setCustomRptModifiedMap((prev) => ({
      ...prev,
      [`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`]: true,
    }));
    showToast(`🗑️ Baris ${target.week_label || `Minggu ${target.week_number}`} telah dipadamkan.`);
  };

  const handleResetToDefaultRpt = async () => {
    if (!activeRptAssignment) return;
    resetCustomRpt(currentUser.id, activeRptAssignment.subjectSlug, activeRptAssignment.grade);
    const defaultData = await fetchRptJson(
      activeRptAssignment.subjectSlug,
      activeRptAssignment.grade
    );
    setActiveRptList(defaultData);
    setCustomRptModifiedMap((prev) => ({
      ...prev,
      [`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`]: false,
    }));
    showToast(`♻️ RPT ${activeRptAssignment.subjectName} dipulihkan ke versi asal KPM.`);
  };

  const handleAddTeacherRptSubject = () => {
    const meta = dskpMeta.find((m) => m.slug === newRptSubjectSlug);
    const subjectName = meta?.name || newRptSubjectSlug;
    const newAssign: TeacherRptAssignment = {
      id: `rpt_assign_${currentUser.id}_${Date.now()}`,
      teacherId: currentUser.id,
      subjectSlug: newRptSubjectSlug,
      grade: newRptGrade,
      subjectName,
      className: newRptClassName.trim() || `Tahun ${newRptGrade}`,
      updatedAt: new Date().toISOString(),
    };

    const nextAssignments = [...teacherRptAssignments, newAssign];
    setTeacherRptAssignments(nextAssignments);
    saveTeacherRptAssignments(currentUser.id, nextAssignments);
    setSelectedRptAssignId(newAssign.id);
    setIsAddRptSubjectModalOpen(false);
    setNewRptClassName('');
    showToast(`📚 Subjek ${subjectName} (Tahun ${newRptGrade}) ditambah ke senarai RPT mengajar!`);
  };

  const handleRemoveTeacherRptSubject = (assignId: string) => {
    if (teacherRptAssignments.length <= 1) {
      showToast('⚠️ Sekurang-kurangnya satu subjek RPT mesti dikekalkan.');
      return;
    }
    const target = teacherRptAssignments.find((a) => a.id === assignId);
    const nextAssignments = teacherRptAssignments.filter((a) => a.id !== assignId);
    setTeacherRptAssignments(nextAssignments);
    saveTeacherRptAssignments(currentUser.id, nextAssignments);
    if (selectedRptAssignId === assignId && nextAssignments.length > 0) {
      setSelectedRptAssignId(nextAssignments[0].id);
    }
    showToast(`🗑️ Subjek ${target?.subjectName || ''} dipadamkan daripada senarai.`);
  };

  const handlePrintFullRpt = () => {
    if (!activeRptAssignment) return;
    openPrintableRptWindow(
      activeRptAssignment.subjectName,
      activeRptAssignment.grade,
      currentUser.name,
      school.name,
      activeRptList,
      activeRptDskpTree
    );
  };

  // Generation Handlers (Using builderWeek for Advance Preparation + KrMJ & Sivik Criteria)
  const handleGenerate0Api = () => {
    const subjMeta = dskpMeta.find((m) => m.slug === selectedSubjectSlug);
    const subjectName = subjMeta?.name || selectedSubjectSlug;
    const generated = generateDeterministicRph({
      grade: selectedGrade,
      className: selectedClassName,
      subjectName,
      sk: selectedSk,
      sps: selectedSps,
      pedagogy,
      includeKrmj,
      krmjId: selectedKrmjId,
      includeSivik,
      sivikCoreId: selectedSivikCoreId,
      sivikSubId: selectedSivikSubId,
    });

    const existingForSlot = rphRecords.find(
      (r) =>
        r.teacherId === currentUser.id &&
        r.weekNumber === builderWeek &&
        r.day === selectedDay &&
        selectedSlotId &&
        !selectedSlotId.startsWith('custom_') &&
        r.slotId === selectedSlotId
    );
    const newRecId = existingForSlot ? existingForSlot.id : `rph_auto_${Date.now()}`;
    const newSlotId = selectedSlotId || `custom_${Date.now()}`;
    const preservedStatus = existingForSlot?.status === 'DISAHKAN' ? 'DISAHKAN' : 'DRAF';

    const krmjNote = includeKrmj
      ? ` Murid turut mempamerkan sahsiah ${getKrmjById(selectedKrmjId).contoh_catatan_rph}.`
      : '';

    const newRec: RphRecord = {
      id: newRecId,
      slotId: newSlotId,
      teacherId: currentUser.id,
      weekNumber: builderWeek,
      date: new Date().toISOString().slice(0, 10),
      day: selectedDay,
      timeStart: selectedTimeStart,
      timeEnd: selectedTimeEnd,
      grade: selectedGrade,
      className: selectedClassName,
      studentCount: selectedStudentCount || 30,
      subjectSlug: selectedSubjectSlug,
      subjectName,
      sk: selectedSk,
      sps: selectedSps,
      objectives: generated.objectives,
      criteria: generated.criteria,
      induction: generated.induction,
      activities: generated.activities,
      closure: generated.closure,
      emk: generated.emk,
      bbm: generated.bbm,
      assessment: generated.assessment,
      reflection: `___ / ${selectedStudentCount || 30} orang murid dapat mencapai objektif pembelajaran.${krmjNote}`,
      status: preservedStatus,
      verifiedBy: existingForSlot?.verifiedBy,
      verifiedAt: existingForSlot?.verifiedAt,
      verifierFeedback: existingForSlot?.verifierFeedback,
      updatedAt: new Date().toISOString(),
    };

    setPreviewRph(newRec);
    setIsEditingRph(false);
    const badgeMsg = [
      includeKrmj ? `KrMJ (${selectedKrmjId})` : '',
      includeSivik ? `Sivik (${selectedSivikCoreId})` : '',
    ]
      .filter(Boolean)
      .join(' + ');
    showToast(
      `✨ RPH SJK(C) siap dijana${badgeMsg ? ` dengan integrasi ${badgeMsg}` : ''}!`
    );
  };

  const handleCopySinglePrompt = async () => {
    const subjMeta = dskpMeta.find((m) => m.slug === selectedSubjectSlug);
    const prompt = buildSingleGeminiPrompt({
      grade: selectedGrade,
      className: selectedClassName,
      subjectName: subjMeta?.name || selectedSubjectSlug,
      sk: selectedSk,
      sps: selectedSps,
      pedagogy,
      includeKrmj,
      krmjId: selectedKrmjId,
      includeSivik,
      sivikCoreId: selectedSivikCoreId,
      sivikSubId: selectedSivikSubId,
    });
    await navigator.clipboard.writeText(prompt);
    showToast(
      `📋 Prompt Gemini/ChatGPT disalin${includeKrmj || includeSivik ? ' (Termasuk kriteria KrMJ/Sivik)' : ''}!`
    );
  };

  const handleParsePastedSingle = () => {
    if (!pastedGeminiText.trim()) return;
    const subjMeta = dskpMeta.find((m) => m.slug === selectedSubjectSlug);
    const subjectName = subjMeta?.name || selectedSubjectSlug;
    const parsed = parseSingleGeminiResponse(pastedGeminiText, {
      grade: selectedGrade,
      className: selectedClassName,
      subjectName,
      sk: selectedSk,
      sps: selectedSps,
      pedagogy,
      includeKrmj,
      krmjId: selectedKrmjId,
      includeSivik,
      sivikCoreId: selectedSivikCoreId,
      sivikSubId: selectedSivikSubId,
    });

    const newRec: RphRecord = {
      id: previewRph?.id || `rph_paste_${Date.now()}`,
      slotId: selectedSlotId || `custom_${Date.now()}`,
      teacherId: currentUser.id,
      weekNumber: builderWeek,
      date: new Date().toISOString().slice(0, 10),
      day: selectedDay,
      timeStart: selectedTimeStart,
      timeEnd: selectedTimeEnd,
      grade: selectedGrade,
      className: selectedClassName,
      studentCount: selectedStudentCount || 30,
      subjectSlug: selectedSubjectSlug,
      subjectName,
      sk: selectedSk,
      sps: selectedSps,
      objectives: parsed.objectives,
      criteria: parsed.criteria,
      induction: parsed.induction,
      activities: parsed.activities,
      closure: parsed.closure,
      emk: parsed.emk,
      bbm: parsed.bbm,
      assessment: parsed.assessment,
      reflection: `___ / ${selectedStudentCount || 30} orang murid mencapai objektif PdP.`,
      status: previewRph?.status === 'DISAHKAN' ? 'DISAHKAN' : 'DRAF',
      verifiedBy: previewRph?.verifiedBy,
      verifiedAt: previewRph?.verifiedAt,
      verifierFeedback: previewRph?.verifierFeedback,
      updatedAt: new Date().toISOString(),
    };

    setPreviewRph(newRec);
    setIsEditingRph(false);
    showToast('✅ Respons Gemini/ChatGPT berjaya diproses ke dalam jadual e-RPH!');
  };

  const handleSaveSingleToWeekly = (
    submitImmediately: boolean,
    preserveVerifiedStatus: boolean = false
  ) => {
    if (!previewRph) return;

    // If currently editing, apply changes from editBuffer before saving
    let currentRecord = previewRph;
    if (isEditingRph) {
      currentRecord = {
        ...previewRph,
        sk: editBuffer.sk,
        sps: editBuffer.sps.split("\\n").filter((x) => x.trim()),
        objectives: editBuffer.objectives.split("\\n").filter((x) => x.trim()),
        criteria: editBuffer.criteria.split("\\n").filter((x) => x.trim()),
        induction: editBuffer.induction,
        activities: editBuffer.activities.split("\\n").filter((x) => x.trim()),
        closure: editBuffer.closure,
        emk: editBuffer.emk.split(",").map((x) => x.trim()).filter(Boolean),
        bbm: editBuffer.bbm.split(",").map((x) => x.trim()).filter(Boolean),
        reflection: editBuffer.reflection,
      };
      setPreviewRph(currentRecord);
      setIsEditingRph(false);
    }
    const finalSlotId = selectedSlotId || previewRph.slotId || `custom_${Date.now()}`;
    const isAlreadyVerified = previewRph.status === 'DISAHKAN';
    const nextStatus: RphStatus =
      preserveVerifiedStatus && isAlreadyVerified
        ? 'DISAHKAN'
        : submitImmediately
        ? 'DIHANTAR'
        : 'DRAF';

    const recordToSave: RphRecord = {
      ...currentRecord,
      id: previewRph.id || `rph_${Date.now()}`,
      day: selectedDay,
      slotId: finalSlotId,
      weekNumber: builderWeek,
      studentCount: previewRph.studentCount || selectedStudentCount || 30,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    setRphRecords((prev) => {
      const updated = [
        recordToSave,
        ...prev.filter((r) => {
          if (r.id === recordToSave.id) return false;
          if (
            recordToSave.slotId &&
            !recordToSave.slotId.startsWith('custom_') &&
            r.slotId === recordToSave.slotId &&
            r.weekNumber === recordToSave.weekNumber &&
            r.day === recordToSave.day &&
            r.teacherId === recordToSave.teacherId
          ) {
            return false;
          }
          return true;
        }),
      ];
      try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    saveRphRecordToDb(recordToSave).catch((err) => console.warn('saveRphRecordToDb err:', err));
    setPreviewRph(recordToSave);
    setDraftWeekFilter(builderWeek);
    setDraftDayFilter('ALL');
    showToast(
      nextStatus === 'DISAHKAN'
        ? `✅ Kemaskini e-RPH ${recordToSave.day} (${recordToSave.className}) disimpan! Status DISAHKAN dikekalkan.`
        : submitImmediately
        ? `🚀 e-RPH ${recordToSave.day} (${recordToSave.className}) Minggu ${builderWeek} telah dihantar kepada Pentadbir!`
        : `💾 e-RPH ${recordToSave.day} (${recordToSave.className}) Minggu ${builderWeek} disimpan ke dalam Draf.`
    );
  };

  // Weekly Batch Handlers
  const activeWeeklySlots = useMemo(
    () => timetable.filter((s) => s.teacherId === currentUser.id),
    [timetable, currentUser.id]
  );

  const handleCopyWeeklyBatchPrompt = async () => {
    const prompt = buildWeeklyBatchPrompt(
      builderWeek,
      currentUser.name,
      activeWeeklySlots,
      {
        includeKrmj,
        krmjId: selectedKrmjId,
        includeSivik,
        sivikCoreId: selectedSivikCoreId,
        sivikSubId: selectedSivikSubId,
      }
    );
    await navigator.clipboard.writeText(prompt);
    showToast(`📋 Prompt Mingguan Minggu ${builderWeek} (${activeWeeklySlots.length} sesi) telah disalin!`);
  };

  const handleAutoPopulateDemoWeeklyText = () => {
    const blocks = activeWeeklySlots.map((slot) => {
      const gen = generateDeterministicRph({
        grade: slot.grade,
        className: slot.className,
        subjectName: slot.subjectName,
        sk: slot.defaultSk,
        sps: slot.defaultSps,
      });
      return `[SLOT:${slot.id}]
[OBJEKTIF]
${gen.objectives.map((o) => `• ${o}`).join('\n')}
[KRITERIA]
${gen.criteria.map((c) => `• ${c}`).join('\n')}
[INDUKSI]
• ${gen.induction}
[LANGKAH]
${gen.activities.map((a, i) => `${i + 1}. ${a}`).join('\n')}
[PENUTUP]
• ${gen.closure}
[EMK]
${gen.emk.join(', ')}
[BBM]
${gen.bbm.join(', ')}
[PENTAKSIRAN]
${gen.assessment}`;
    });
    setWeeklyPasteText(blocks.join('\n\n---\n\n'));
    showToast('✨ Contoh jawapan AI Gemini untuk seluruh minggu telah dimasukkan!');
  };

  const handleProcessWeeklyBatch = () => {
    if (!weeklyPasteText.trim()) return;
    const parsedList = parseWeeklyBatchResponse(weeklyPasteText);
    const parsedMap = new Map(parsedList.map((item) => [item.slotId, item]));
    const newRecords: RphRecord[] = [];

    activeWeeklySlots.forEach((slot) => {
      const content = parsedMap.get(slot.id);
      if (content) {
        newRecords.push({
          id: `rph_week_${builderWeek}_${slot.id}`,
          slotId: slot.id,
          teacherId: currentUser.id,
          weekNumber: builderWeek,
          date: new Date().toISOString().slice(0, 10),
          day: slot.day,
          timeStart: slot.timeStart,
          timeEnd: slot.timeEnd,
          grade: slot.grade,
          className: slot.className,
          subjectSlug: slot.subjectSlug,
          subjectName: slot.subjectName,
          sk: slot.defaultSk,
          sps: slot.defaultSps,
          objectives: content.objectives,
          criteria: content.criteria,
          induction: content.induction,
          activities: content.activities,
          closure: content.closure,
          emk: ['Pendidikan Sivik', 'Kreativiti & Inovasi'],
          bbm: ['Buku Teks SJK(C)', 'Bahan Edaran', 'Papan Putih Mini'],
          assessment: 'Penilaian Bilik Darjah (PBD)',
          reflection: '___ / ___ orang murid mencapai objektif PdP.',
          status: 'DIHANTAR',
          updatedAt: new Date().toISOString(),
        });
      }
    });

    setRphRecords((prev) => {
      const updated = [
        ...newRecords,
        ...prev.filter(
          (r) =>
            !(
              r.teacherId === currentUser.id &&
              r.weekNumber === builderWeek &&
              activeWeeklySlots.some((s) => s.id === r.slotId)
            )
        ),
      ];
      try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    newRecords.forEach((rec) => {
      saveRphRecordToDb(rec).catch((err) => console.warn('saveRphRecordToDb err:', err));
    });

    setDraftWeekFilter(builderWeek);
    setDraftDayFilter('ALL');
    showToast(`🎉 ${newRecords.length} sesi e-RPH Minggu ${builderWeek} telah berjaya diimport serentak!`);
    setActiveNav('rph-drafts');
  };

  // Draft Status Update & Batch Submit Handlers
  const handleUpdateRphStatus = (rphId: string, newStatus: RphStatus) => {
    let targetMod: RphRecord | null = null;
    setRphRecords((prev) => {
      const updated = prev.map((r) => {
        if (r.id === rphId) {
          const mod = {
            ...r,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          };
          targetMod = mod;
          return mod;
        }
        return r;
      });
      try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    if (targetMod) {
      saveRphRecordToDb(targetMod).catch((err) => console.warn('saveRphRecordToDb err:', err));
    }
    showToast(
      newStatus === 'DIHANTAR'
        ? '🚀 e-RPH telah dihantar kepada Pentadbir untuk semakan.'
        : '💾 e-RPH telah dikembalikan ke status Draf.'
    );
  };

  // Drafts Filtered by Day & Week
  const myDraftsForWeek = useMemo(() => {
    return rphRecords.filter((r) => {
      if (r.teacherId !== currentUser.id) return false;
      if (r.weekNumber !== draftWeekFilter) return false;
      if (draftDayFilter !== 'ALL' && r.day !== draftDayFilter) return false;
      return true;
    });
  }, [rphRecords, currentUser.id, draftWeekFilter, draftDayFilter]);

  const unsubmittedCountForWeek = useMemo(() => {
    return myDraftsForWeek.filter(
      (r) => r.status === 'DRAF' || r.status === 'PEMBETULAN'
    ).length;
  }, [myDraftsForWeek]);

  const handleBatchSubmitWeekDrafts = () => {
    const unsubmitted = myDraftsForWeek.filter(
      (r) => r.status === 'DRAF' || r.status === 'PEMBETULAN'
    );
    if (unsubmitted.length === 0) {
      showToast('ℹ️ Tiada draf e-RPH belum dihantar bagi minggu ini.');
      return;
    }
    const unsubmittedIds = new Set(unsubmitted.map((r) => r.id));

    const submittedToSave: RphRecord[] = [];
    setRphRecords((prev) => {
      const updated = prev.map((r) => {
        if (unsubmittedIds.has(r.id)) {
          const mod = {
            ...r,
            status: 'DIHANTAR' as RphStatus,
            updatedAt: new Date().toISOString(),
          };
          submittedToSave.push(mod);
          return mod;
        }
        return r;
      });
      try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    submittedToSave.forEach((mod) => {
      saveRphRecordToDb(mod).catch((err) => console.warn('saveRphRecordToDb err:', err));
    });
    showToast(
      `🚀 Semua ${unsubmitted.length} sesi e-RPH Minggu ${draftWeekFilter} telah berjaya dihantar kepada Pentadbir!`
    );
  };

  // e-RPH for Selected Day (Builder View)
  const myRphsForSelectedDay = useMemo(() => {
    return rphRecords.filter(
      (r) =>
        r.teacherId === currentUser.id &&
        r.weekNumber === builderWeek &&
        r.day === selectedDay
    );
  }, [rphRecords, currentUser.id, builderWeek, selectedDay]);

  // e-RPH for Selected Week (Builder View)
  const myRphsForSelectedWeek = useMemo(() => {
    return rphRecords.filter(
      (r) =>
        r.teacherId === currentUser.id &&
        r.weekNumber === builderWeek
    );
  }, [rphRecords, currentUser.id, builderWeek]);

  const handleDeleteRph = (rphId: string) => {
    const targetRecord = rphRecords.find((r) => r.id === rphId);
    const lessonInfo = targetRecord
      ? `${targetRecord.day} • ${targetRecord.className} (${targetRecord.subjectName || 'Subjek'})`
      : "sesi pengajaran ini";

    requestConfirmation({
      title: "Padam Sesi e-RPH",
      message: `Adakah anda pasti mahu memadam rekod "${lessonInfo}" secara kekal?`,
      detail: "Tindakan ini akan memadam rekod PdP ini secara langsung daripada pangkalan data Supabase dan storan tempatan.",
      confirmText: "Ya, Padam e-RPH",
      confirmColor: "rose",
      onConfirm: () => {
        const remainingRecords = rphRecords.filter((r) => r.id !== rphId);
        setRphRecords(remainingRecords);
        try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(remainingRecords)); } catch (_) {}

        if (previewRph?.id === rphId) {
          setPreviewRph(null);
        }

        deleteRphRecordFromDb(rphId).catch((err) => console.warn('deleteRphRecordFromDb err:', err));

        if (targetRecord) {
          const hasOtherInWeek = remainingRecords.some(
            (r) => r.teacherId === targetRecord.teacherId && r.weekNumber === targetRecord.weekNumber
          );
          if (!hasOtherInWeek) {
            setYearlyRecords((prev) => {
              const tCells = { ...(prev[targetRecord.teacherId] || {}) };
              delete tCells[targetRecord.weekNumber];
              const nextMap = {
                ...prev,
                [targetRecord.teacherId]: tCells,
              };
              try { localStorage.setItem('erph_yearly_matrix_records_v2', JSON.stringify(nextMap)); } catch (_) {}
              return nextMap;
            });
          }
        }

        showToast('🗑️ e-RPH telah dipadam secara kekal dari pangkalan data.');
      },
    });
  };

  // Load GAS URL from localStorage on mount
  useEffect(() => {
    const savedGas = localStorage.getItem('erph_gas_webapp_url');
    if (savedGas) setGasWebAppUrl(savedGas);
  }, []);

  // Load Archived RPHs when user selects a past academic year
  const handleSelectArchiveYear = async (yearVal: string) => {
    setSelectedArchiveYear(yearVal);
    if (yearVal === 'SEMASA') return;
    setIsLoadingArchive(true);
    try {
      const res = await fetchArchivedRphRecords(
        gasWebAppUrl,
        yearVal,
        currentUser.id,
        currentUser.name
      );
      setArchivedRecords(res.records);
      setArchiveSource(res.source);
      showToast(
        `📂 Memaparkan ${res.records.length} rekod e-RPH Arkib Sesi ${yearVal} (${
          res.source === 'GAS_CLOUD' ? 'Google Sheets Cloud' : 'Storan Arkib Tempatan'
        }).`
      );
    } finally {
      setIsLoadingArchive(false);
    }
  };

  // Reuse an archived past-year RPH into current active week
  const handleReuseArchivedRph = (arch: RphRecord) => {
    const reusedRecord: RphRecord = {
      ...arch,
      id: `rph_reused_${Date.now()}`,
      slotId: `custom_${Date.now()}`,
      teacherId: currentUser.id,
      weekNumber: builderWeek,
      date: new Date().toISOString().slice(0, 10),
      status: 'DRAF',
      verifiedBy: undefined,
      verifiedAt: undefined,
      verifierFeedback: undefined,
      updatedAt: new Date().toISOString(),
    };
    setRphRecords((prev) => [reusedRecord, ...prev]);
    setPreviewRph(reusedRecord);
    setSelectedDay(reusedRecord.day as any);
    setSelectedGrade(reusedRecord.grade);
    setSelectedClassName(reusedRecord.className);
    setSelectedSubjectSlug(reusedRecord.subjectSlug);
    setSelectedSk(reusedRecord.sk);
    setSelectedSps(reusedRecord.sps);
    setDraftWeekFilter(builderWeek);
    setSelectedArchiveYear('SEMASA');
    showToast(
      `♻️ Rekod arkib (${arch.className} • ${arch.subjectName}) berjaya diguna semula ke Minggu ${builderWeek} (Status: DRAF)!`
    );
  };

  // Download Full Year RPH as Printable PDF Book
  const handleDownloadFullYearPdf = (yearMode: string) => {
    const targetYearLabel = yearMode === 'SEMASA' ? school.academicYear : yearMode;
    const listToPrint =
      yearMode === 'SEMASA'
        ? rphRecords.filter((r) => r.teacherId === currentUser.id)
        : archivedRecords;

    if (listToPrint.length === 0) {
      showToast('⚠️ Tiada rekod e-RPH ditemui untuk dicetak bagi sesi ini.');
      return;
    }
    openPrintableFullYearRphPdf(listToPrint, school.name, currentUser.name, targetYearLabel);
    showToast(`🖨️ Membuka Buku PDF e-RPH Setahun Penuh (${listToPrint.length} rekod • Sesi ${targetYearLabel})...`);
  };

  // Admin: Export all current year records to Google Sheets / JSON (December Annual Archive)
  const handleAdminAnnualExport = async () => {
    setIsExportingArchive(true);
    try {
      const res = await dumpAnnualRphToGas(gasWebAppUrl, school.academicYear, rphRecords);
      showToast(`📦 ${res.message}`);
    } finally {
      setIsExportingArchive(false);
    }
  };

  // Trigger file picker for importing Archive JSON (reliable fallback across all tabs)
  const handleTriggerArchiveImport = () => {
    if (archiveFileInputRef.current) {
      archiveFileInputRef.current.click();
    } else {
      const el = document.getElementById('global-archive-json-input') as HTMLInputElement;
      el?.click();
    }
  };

  // Import Archive JSON file (for teachers & admin to temporarily view and reuse past year RPH records)
  const handleImportArchiveJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        let records: RphRecord[] = [];
        let detectedYear = 'Arkib Import (.JSON)';
        let parsedTimetable: TimetableSlot[] = [];
        let parsedTeachers: TeacherProfile[] = [];

        if (Array.isArray(parsed)) {
          records = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.academicYear) {
            detectedYear = `Arkib ${parsed.academicYear} (Fail JSON)`;
          }
          if (Array.isArray(parsed.records)) {
            records = parsed.records;
          } else if (Array.isArray(parsed.rphRecords)) {
            records = parsed.rphRecords;
          } else if (Array.isArray(parsed.data)) {
            records = parsed.data;
          }
          if (Array.isArray(parsed.timetable)) {
            parsedTimetable = parsed.timetable;
          }
          if (Array.isArray(parsed.teachers)) {
            parsedTeachers = parsed.teachers;
          }
        }

        if (records.length === 0) {
          showToast('⚠️ Fail JSON tidak mengandungi senarai rekod e-RPH yang sah.');
          return;
        }

        setArchivedRecords(records);
        setSelectedArchiveYear(detectedYear);
        setImportedArchiveData({
          fileName: file.name,
          academicYear: detectedYear,
          records,
          timetable: parsedTimetable,
          teachers: parsedTeachers,
        });
        setShowArchiveImportModal(true);
        showToast(
          `📂 Berjaya memuat naik fail arkib "${file.name}" (${records.length} rekod)! Pop-up paparan dibuka untuk semakan segera.`
        );
      } catch (err) {
        console.error('Error parsing JSON archive:', err);
        showToast('❌ Ralat membaca fail JSON. Sila pastikan format fail JSON adalah sah.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Admin: Open Purge Drafts Warning Modal
  const handleOpenPurgeModal = () => {
    const draftCount = rphRecords.filter((r) => r.status === 'DRAF').length;
    if (draftCount === 0) {
      showToast('ℹ️ Tiada draf lama berstatus DRAF untuk dibersihkan. Pangkalan data sudah optimum!');
      return;
    }
    setShowPurgeModal(true);
  };

  // Admin: Confirm Purging unverified drafts (status DRAF only)
  const handleConfirmPurgeDrafts = () => {
    const draftCount = rphRecords.filter((r) => r.status === 'DRAF').length;
    setRphRecords((prev) => prev.filter((r) => r.status !== 'DRAF'));
    setShowPurgeModal(false);
    showToast(`🧹 ${draftCount} draf lama telah dibersihkan! Semua rekod DISAHKAN kekal selamat.`);
  };

  // Timetable Filtered by Day for active teacher
  const teacherDaySlots = useMemo(() => {
    return timetable.filter((s) => s.teacherId === currentUser.id && s.day === selectedDay);
  }, [timetable, currentUser.id, selectedDay]);

  // Dashboard & Admin Metrics (e-RPH Fokus Sepenuhnya)
  const metrics = useMemo(() => {
    const thisWeekRphs = rphRecords.filter((r) => r.weekNumber === school.currentWeek);
    const verifiedCount = new Set(
      thisWeekRphs.filter((r) => r.status === 'DISAHKAN').map((r) => r.teacherId)
    ).size;
    const submittedCount = new Set(
      thisWeekRphs.filter((r) => r.status === 'DIHANTAR').map((r) => r.teacherId)
    ).size;
    const totalGuru = teachers.filter((t) => t.role !== 'superadmin').length;
    const percentSubmitted = Math.round((submittedCount / (totalGuru || 1)) * 100);

    return {
      totalGuru,
      submittedCount,
      verifiedCount,
      waitingReview: submittedCount - verifiedCount > 0 ? submittedCount - verifiedCount : 0,
      percentSubmitted,
    };
  }, [teachers, rphRecords, school.currentWeek]);

  const teacherSummaries = useMemo(() => {
    return regularTeachers.map((teacher) => {
      const records = rphRecords.filter(
        (r) => r.teacherId === teacher.id && r.weekNumber === adminReviewWeek
      );
      const slots = timetable.filter((s) => s.teacherId === teacher.id);
      let status: RphStatus = 'BELUM_HANTAR';
      if (records.length > 0) {
        if (records.every((r) => r.status === 'DISAHKAN')) status = 'DISAHKAN';
        else if (records.some((r) => r.status === 'PEMBETULAN')) status = 'PEMBETULAN';
        else if (records.some((r) => r.status === 'DIHANTAR')) status = 'DIHANTAR';
        else status = 'DRAF';
      }
      return { teacher, filledCount: records.length, totalSlots: slots.length, status, records };
    });
  }, [regularTeachers, rphRecords, adminReviewWeek, timetable]);

  // Helper: Retrieve weekly RPH lessons for inspection (real data only, no mock fallback)
  const getTeacherWeekRphs = useCallback(
    (teacherId: string, weekNum: number): RphRecord[] => {
      return rphRecords.filter(
        (r) => r.teacherId === teacherId && r.weekNumber === weekNum
      );
    },
    [rphRecords]
  );

  const renderInspectRphCard = (r: RphRecord, teacherName: string) => {
    return (
      <div
        key={r.id}
        className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 hover:border-blue-300 transition shadow-sm text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded text-[11px]">
              {r.day}
            </span>
            <span className="font-mono font-bold text-slate-700 text-xs">
              ⏰ {r.timeStart} - {r.timeEnd}
            </span>
            <span className="bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px]">
              Tahun {r.grade} • {r.className}
            </span>
            <span className="font-extrabold text-blue-900 text-xs">
              📚 {r.subjectName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                r.status === 'DISAHKAN'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : r.status === 'DIHANTAR'
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : r.status === 'PEMBETULAN'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {r.status === 'DISAHKAN'
                ? '✅ Disahkan'
                : r.status === 'DIHANTAR'
                ? '📤 Dihantar'
                : r.status === 'PEMBETULAN'
                ? '⚠️ Pembetulan'
                : '📝 Draf'}
            </span>

            <button
              type="button"
              onClick={() => openPrintableRphWindow(r, school.name, teacherName)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition"
              title="Cetak format A4 rasmi untuk sesi e-RPH ini"
            >
              <span>🖨️</span>
              <span>Cetak A4</span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteRph(r.id)}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] shadow-sm transition"
              title="Padam sesi e-RPH ini secara kekal dari pangkalan data"
            >
              🗑️ Padam
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <span className="font-bold text-slate-800">Standard Kandungan (SK): </span>
            <span className="text-slate-700 font-medium">{r.sk}</span>
          </div>

          <div>
            <span className="font-bold text-slate-800">Standard Pembelajaran (SP):</span>
            <ul className="list-disc list-inside mt-0.5 text-slate-600 pl-1 space-y-0.5">
              {r.sps.map((sp, idx) => (
                <li key={idx}>{sp}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
            <div>
              <span className="font-bold text-emerald-800 block mb-0.5">🎯 Objektif Pembelajaran:</span>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                {r.objectives.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="font-bold text-blue-800 block mb-0.5">⭐ Kriteria Kejayaan:</span>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                {r.criteria.map((crit, idx) => (
                  <li key={idx}>{crit}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <span className="font-bold text-slate-800">Aktiviti Pengajaran & Pembelajaran (PdP):</span>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 mt-1 text-slate-700">
              {r.induction && (
                <p>
                  <span className="font-bold text-slate-800">Set Induksi: </span>
                  {r.induction}
                </p>
              )}
              {r.activities && r.activities.length > 0 && (
                <div>
                  <span className="font-bold text-slate-800">Langkah Utama:</span>
                  <ul className="list-decimal list-inside pl-1 space-y-0.5">
                    {r.activities.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}
              {r.closure && (
                <p>
                  <span className="font-bold text-slate-800">Penutup: </span>
                  {r.closure}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div>
              <span className="font-bold text-slate-800">BBM: </span>
              {r.bbm && r.bbm.length > 0 ? r.bbm.join(', ') : '—'}
            </div>
            <div>
              <span className="font-bold text-slate-800">EMK / Nilai: </span>
              {r.emk && r.emk.length > 0 ? r.emk.join(', ') : '—'}
            </div>
          </div>

          {r.reflection && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900">
              <span className="font-bold">📝 Refleksi Guru: </span>
              <span>{r.reflection}</span>
            </div>
          )}

          {r.verifierFeedback && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-900">
              <span className="font-bold">💬 Ulasan Pentadbir ({r.verifiedBy || 'Pengesah'}): </span>
              <span>{r.verifierFeedback}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Admin Review Handlers
  const handleVerifyRph = (teacherId: string, newStatus: 'DISAHKAN' | 'PEMBETULAN') => {
    const teacher = teachers.find((t) => t.id === teacherId);
    const roleLabel =
      currentUser.role === 'superadmin'
        ? 'Pentadbir Utama'
        : currentUser.role === 'guru_besar'
        ? 'Guru Besar'
        : currentUser.role === 'pk_pentadbiran'
        ? 'PK Pentadbiran'
        : currentUser.jawatan || 'Pentadbir';

    const verifierName = currentUser.name || "SJKC YOK POON";
    const verifierTitle = `${verifierName} (${roleLabel})`;

    const verifiedToSave: RphRecord[] = [];
    setRphRecords((prev) => {
      const hasRecords = prev.some(
        (r) => r.teacherId === teacherId && r.weekNumber === adminReviewWeek
      );
      let baseList = prev;
      if (!hasRecords) {
        const synthRecords = getTeacherWeekRphs(teacherId, adminReviewWeek);
        baseList = [...prev, ...synthRecords];
      }
      const updated = baseList.map((r) => {
        if (r.teacherId === teacherId && r.weekNumber === adminReviewWeek) {
          const mod = {
            ...r,
            status: newStatus,
            verifiedBy: verifierTitle,
            verifierFeedback: adminFeedback,
            verifiedAt: new Date().toISOString(),
          };
          verifiedToSave.push(mod);
          return mod;
        }
        return r;
      });
      try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    verifiedToSave.forEach((mod) => {
      saveRphRecordToDb(mod).catch((err) => console.warn('saveRphRecordToDb err:', err));
    });

    // Automatically update Yearly Matrix when verified or marked revision
    const targetWeek = academicWeeks.find((w) => w.weekNumber === adminReviewWeek);
    const rawDue = targetWeek?.dueDateFriday || '';
    const dm = rawDue ? formatToDayMonth(rawDue) : '';
    setYearlyRecords((prev) => {
      const teacherCells = prev[teacherId] || {};
      const newMatrixStatus = newStatus === 'DISAHKAN' ? 'TEPAT' : 'LEWAT';
      const updatedMatrix: MatrixCellRecord = {
        weekNumber: adminReviewWeek,
        dueDate: rawDue ? formatToDayMonthYear(rawDue) : '',
        submittedDateFormatted: dm,
        status: newMatrixStatus,
        statusLabel: newStatus === 'DISAHKAN' ? (dm + ' tepat') : (dm + ' lewat'),
        verifiedBy: verifierTitle,
        notes: adminFeedback || ('Disahkan oleh ' + verifierTitle),
      };
      const nextMap = {
        ...prev,
        [teacherId]: {
          ...teacherCells,
          [adminReviewWeek]: updatedMatrix,
        },
      };
      try { localStorage.setItem('erph_yearly_matrix_records_v2', JSON.stringify(nextMap)); } catch (_) {}
      return nextMap;
    });

    setInspectTeacher(null);
    showToast(
      newStatus === 'DISAHKAN'
        ? `✅ RPH Minggu ${adminReviewWeek} untuk ${teacher?.name} telah DISAHKAN & dicop oleh ${verifierTitle}!`
        : `⚠️ Notis pembetulan telah dihantar kepada ${teacher?.name}.`
    );
  };

  const handleBulkVerifyAllSubmitted = () => {
    const roleLabel =
      currentUser.role === 'superadmin'
        ? 'Pentadbir Utama'
        : currentUser.role === 'guru_besar'
        ? 'Guru Besar'
        : currentUser.role === 'pk_pentadbiran'
        ? 'PK Pentadbiran'
        : currentUser.jawatan || 'Pentadbir';

    const verifierName = currentUser.name || "SJKC YOK POON";
    const verifierTitle = `${verifierName} (${roleLabel})`;

    const bulkVerifiedToSave: RphRecord[] = [];
    setRphRecords((prev) => {
      const updated = prev.map((r) => {
        if (r.weekNumber === adminReviewWeek && r.status === 'DIHANTAR') {
          const mod = {
            ...r,
            status: 'DISAHKAN' as RphStatus,
            verifiedBy: verifierTitle,
            verifierFeedback: `Disahkan secara pukal oleh ${verifierTitle}.`,
            verifiedAt: new Date().toISOString(),
          };
          bulkVerifiedToSave.push(mod);
          return mod;
        }
        return r;
      });
      try { localStorage.setItem('erph_live_rph_records_v1', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    bulkVerifiedToSave.forEach((mod) => {
      saveRphRecordToDb(mod).catch((err) => console.warn('saveRphRecordToDb err:', err));
    });

    // Update yearly matrix for all verified teachers in bulk
    const targetWeek = academicWeeks.find((w) => w.weekNumber === adminReviewWeek);
    const rawDue = targetWeek?.dueDateFriday || "";
    const dm = rawDue ? formatToDayMonth(rawDue) : "";
    setYearlyRecords((prev) => {
      const nextMap = { ...prev };
      const verifiedTeacherIds = Array.from(new Set(bulkVerifiedToSave.map((r) => r.teacherId)));
      verifiedTeacherIds.forEach((tId) => {
        const tCells = nextMap[tId] || {};
        nextMap[tId] = {
          ...tCells,
          [adminReviewWeek]: {
            weekNumber: adminReviewWeek,
            dueDate: rawDue ? formatToDayMonthYear(rawDue) : "",
            submittedDateFormatted: dm,
            status: "TEPAT",
            statusLabel: dm + " tepat",
            verifiedBy: verifierTitle,
            notes: "Disahkan secara pukal oleh " + verifierTitle,
          },
        };
      });
      try { localStorage.setItem("erph_yearly_matrix_records_v2", JSON.stringify(nextMap)); } catch (_) {}
      return nextMap;
    });

    showToast(`⚡ Semua RPH berstatus 'DIHANTAR' untuk Minggu ${adminReviewWeek} telah DISAHKAN oleh ${verifierTitle}!`);
  };

  // Teacher Timetable Management
  const teacherOwnSlots = useMemo(() => {
    return timetable.filter((s) => s.teacherId === currentUser.id);
  }, [timetable, currentUser.id]);

  const handleStartEditTimetableSlot = (slot: TimetableSlot) => {
    setEditingTimetableSlotId(slot.id);
    setMyNewDay(slot.day);
    setMyNewTimeStart(slot.timeStart);
    setMyNewTimeEnd(slot.timeEnd);
    setMyNewGrade(slot.grade);
    setMyNewClassName(slot.className);
    setMyNewStudentCount(slot.studentCount || 30);
    setMyNewSubjectSlug(slot.subjectSlug);
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  const handleCancelEditTimetableSlot = () => {
    setEditingTimetableSlotId(null);
    setMyNewClassName('4 Merah (四红班)');
    setMyNewStudentCount(30);
  };

  const handleSaveTeacherOwnSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const subj = dskpMeta.find((m) => m.slug === myNewSubjectSlug);
    if (editingTimetableSlotId) {
      let updatedSlot: TimetableSlot | null = null;
      setTimetable((prev) => {
        const updated = prev.map((s) => {
          if (s.id === editingTimetableSlotId) {
            const mod = {
              ...s,
              day: myNewDay,
              timeStart: myNewTimeStart,
              timeEnd: myNewTimeEnd,
              grade: myNewGrade,
              className: myNewClassName,
              studentCount: Number(myNewStudentCount) || 30,
              subjectSlug: myNewSubjectSlug,
              subjectName: subj?.name || s.subjectName,
            };
            updatedSlot = mod;
            return mod;
          }
          return s;
        });
        try { localStorage.setItem('erph_live_timetable_v1', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
      if (updatedSlot) {
        saveTimetableSlotToDb(updatedSlot).catch((err) => console.warn('saveTimetableSlotToDb err:', err));
      }
      setEditingTimetableSlotId(null);
      showToast(`✅ Jadual ${myNewDay} (${myNewClassName}) berjaya dikemaskini!`);
    } else {
      const newSlot: TimetableSlot = {
        id: `slot_user_${Date.now()}`,
        teacherId: currentUser.id,
        day: myNewDay,
        period: 1,
        timeStart: myNewTimeStart,
        timeEnd: myNewTimeEnd,
        grade: myNewGrade,
        className: myNewClassName,
        studentCount: Number(myNewStudentCount) || 30,
        subjectSlug: myNewSubjectSlug,
        subjectName: subj?.name || 'Mata Pelajaran',
        defaultSk: myNewSk || '1.1 Kemahiran Asas Bahasa & Komunikasi',
        defaultSps: ['1.1.1 Mendengar dan memahami arahan guru.'],
      };
      setTimetable((prev) => {
        const updated = [...prev, newSlot];
        try { localStorage.setItem('erph_live_timetable_v1', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
      saveTimetableSlotToDb(newSlot).catch((err) => console.warn('saveTimetableSlotToDb err:', err));
      showToast(`✅ Jadual ${newSlot.day} (${newSlot.className}) berjaya ditambah!`);
    }
  };

  const handleDeleteSlot = (slotId: string) => {
    const targetSlot = timetable.find((s) => s.id === slotId);
    requestConfirmation({
      title: "Padam Slot Jadual Mengajar",
      message: `Padam slot ${targetSlot?.day || ""} ${targetSlot?.timeStart || ""}-${targetSlot?.timeEnd || ""} (${targetSlot?.className || ""})?`,
      detail: "Slot jadual ini akan dipadamkan daripada jadual peribadi anda dan pangkalan data.",
      confirmText: "Ya, Padam Slot",
      confirmColor: "rose",
      onConfirm: () => {
        if (editingTimetableSlotId === slotId) {
          setEditingTimetableSlotId(null);
        }
        setTimetable((prev) => {
          const updated = prev.filter((s) => s.id !== slotId);
          try { localStorage.setItem('erph_live_timetable_v1', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
        deleteTimetableSlotFromDb(slotId).catch((err) => console.warn('deleteTimetableSlotFromDb err:', err));
        showToast('Slot jadual telah dipadam.');
      },
    });
  };


  // Helper to get Malaysian day name for a date string (YYYY-MM-DD)
  const getMalaysianDayName = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return '';
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      return days[d.getDay()] || '';
    } catch {
      return '';
    }
  };

  // Helper to calculate Friday date for any given date
  const getFridayForDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const day = d.getDay(); // 0: Sun, 1: Mon, ... 5: Fri, 6: Sat
      let diff = 5 - day;
      if (day === 0) diff = -2; // Sunday: snap to previous Friday or upcoming
      if (day === 6) diff = -1; // Saturday: snap to Friday
      const fri = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
      const yyyy = fri.getFullYear();
      const mm = String(fri.getMonth() + 1).padStart(2, '0');
      const dd = String(fri.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return dateStr;
    }
  };

  // ==========================================
  // TAKWIM & ACADEMIC WEEKS HANDLERS (Feature 2)
  // ==========================================
  const handleUpdateWeekDueDate = (weekNum: number, newDueDate: string, snapToFriday: boolean = false) => {
    let finalDate = newDueDate;
    if (newDueDate && snapToFriday) {
      finalDate = getFridayForDate(newDueDate);
    }
    setAcademicWeeks((prev) =>
      prev.map((w) => (w.weekNumber === weekNum ? { ...w, dueDateFriday: finalDate } : w))
    );
    showToast(`Tarikh akhir Minggu ${weekNum} dikemaskini: ${finalDate || 'Disembunyikan'}`);
  };

  const handleUpdateWeekTheme = (weekNum: number, newTheme: string) => {
    setAcademicWeeks((prev) =>
      prev.map((w) => (w.weekNumber === weekNum ? { ...w, theme: newTheme } : w))
    );
  };

  const handleTakwimFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingTakwim(true);
    try {
      const result = await extractTakwimFromFile(file);
      setTakwimPreview(result);
      setShowTakwimModal(true);
      showToast(`📄 Fail "${file.name}" berjaya dibaca! Kalendar Akademik KPM diekstrak.`);
    } catch (err) {
      console.error('Failed to extract takwim', err);
      showToast('⚠️ Ralat membaca fail takwim. Sila pastikan fail sah.');
    } finally {
      setIsExtractingTakwim(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleApplyExtractedTakwim = () => {
    if (!takwimPreview) return;
    const newWeeks = takwimPreview.generatedWeeks;
    setAcademicWeeks(newWeeks);
    setSchool((prev) => ({
      ...prev,
      academicYear: takwimPreview.academicYear,
    }));

    // Register all new weeks in yearlyRecords for all teachers
    setYearlyRecords((prev) => {
      const updated = { ...prev };
      teachers.forEach((t) => {
        if (!updated[t.id]) updated[t.id] = {};
        newWeeks.forEach((w) => {
          if (!updated[t.id][w.weekNumber]) {
            updated[t.id][w.weekNumber] = {
              weekNumber: w.weekNumber,
              dueDate: w.dueDateFriday || '',
              status: 'BELUM',
            };
          }
        });
      });
      return updated;
    });

    setShowTakwimModal(false);
    showToast(
      `🎉 Takwim Sesi ${takwimPreview.academicYear} berjaya diterapkan! ${newWeeks.length} minggu persekolahan rasmi dikemas kini.`
    );
  };

  const handleAddAcademicWeek = () => {
    const nextWeekNum = academicWeeks.length + 1;
    let nextStart = '2026-11-23';
    let nextDue = '2026-11-27';
    if (academicWeeks.length > 0) {
      const last = academicWeeks[academicWeeks.length - 1];
      if (last.dueDateFriday) {
        const lastFri = new Date(last.dueDateFriday);
        const nextMon = new Date(lastFri.getTime() + 3 * 24 * 60 * 60 * 1000);
        const nextFri = new Date(lastFri.getTime() + 7 * 24 * 60 * 60 * 1000);
        nextStart = nextMon.toISOString().split('T')[0];
        nextDue = nextFri.toISOString().split('T')[0];
      }
    }
    const newWeek: AcademicWeek = {
      weekNumber: nextWeekNum,
      startDate: nextStart,
      dueDateFriday: nextDue,
      theme: `Minggu Akademik Tambahan (Minggu ${nextWeekNum})`,
    };
    setAcademicWeeks((prev) => [...prev, newWeek]);

    // Also register this new week in yearlyRecords for all teachers
    setYearlyRecords((prev) => {
      const updated = { ...prev };
      teachers.forEach((t) => {
        const tCells = updated[t.id] || {};
        updated[t.id] = {
          ...tCells,
          [nextWeekNum]: {
            weekNumber: nextWeekNum,
            dueDate: formatToDayMonthYear(nextDue),
            status: 'BELUM',
            notes: 'Minggu baharu ditambah oleh pentadbir',
          },
        };
      });
      return updated;
    });

    showToast(`➕ Minggu ${nextWeekNum} berjaya ditambah ke dalam takwim persekolahan (${nextDue})!`);
  };

  const handleDeleteAcademicWeek = (weekNum: number) => {
    if (weekNum <= 42) {
      showToast('⚠️ Minggu 1 hingga 42 adalah takwim asas persekolahan KPM dan tidak boleh dipadam.');
      return;
    }
    requestConfirmation({
      title: "Padam Minggu Takwim",
      message: `Padam Minggu ${weekNum} daripada takwim persekolahan?`,
      detail: "Minggu tambahan ini akan dikeluarkan daripada takwim dan matriks semakan e-RPH sekolah.",
      confirmText: `Ya, Padam Minggu ${weekNum}`,
      confirmColor: "rose",
      onConfirm: () => {
        setAcademicWeeks((prev) => prev.filter((w) => w.weekNumber !== weekNum));
        showToast(`🗑️ Minggu ${weekNum} telah dipadamkan daripada takwim.`);
      },
    });
  };

  const handleSetCurrentWeek = (weekNum: number) => {
    const updated = { ...school, currentWeek: weekNum };
    setSchool(updated);
    try {
      localStorage.setItem('erph_school_config_v1', JSON.stringify(updated));
    } catch (_) {}
    if (isSuperadmin || isPentadbir || isIct) {
      saveSchoolConfigToDb(updated).catch((err) => console.warn('saveSchoolConfigToDb err:', err));
    }
    setBuilderWeek(weekNum);
    setBatchWeek(weekNum);
    setDraftWeekFilter(weekNum);
    setAdminReviewWeek(weekNum);
    showToast("⭐ Minggu " + weekNum + " kini ditetapkan sebagai Minggu Akademik Semasa.");
  };

  // ==========================================
  // TEACHER PROFILE EDIT HANDLERS (Feature 3)
  // ==========================================
  const handleOpenEditTeacher = (teacher: TeacherProfile) => {
    setEditingTeacher({ ...teacher });
  };

  const handleSaveEditTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setTeachers((prev) => {
      const updated = prev.map((t) => (t.id === editingTeacher.id ? editingTeacher : t));
      try { localStorage.setItem('erph_live_teachers_v1', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    saveTeacherToDb(editingTeacher).catch((err) => console.warn('saveTeacherToDb err:', err));
    setEditingTeacher(null);
    showToast(`✅ Maklumat profil ${editingTeacher.name} berjaya dikemaskini!`);
  };

  const handleDeleteTeacher = (teacherId: string) => {
    if (teacherId === 'superadmin') {
      showToast('⚠️ Akaun Superadmin keselamatan dilindungi dan tidak boleh dipadam.');
      return;
    }
    const teacher = teachers.find((t) => t.id === teacherId);
    requestConfirmation({
      title: "Padam Profil Guru",
      message: `Adakah anda pasti untuk memadam rekod guru "${teacher?.name}"?`,
      detail: "Tip: Jika guru ini hanya bercuti atau bertukar sekolah sementara, anda boleh memilih untuk menukar status guru kepada 'Cuti' atau 'Pindah' tanpa memadamkan data rekod.",
      confirmText: "Ya, Padam Profil Guru",
      confirmColor: "rose",
      onConfirm: () => {
        setTeachers((prev) => {
          const updated = prev.filter((t) => t.id !== teacherId);
          try { localStorage.setItem('erph_live_teachers_v1', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
        deleteTeacherFromDb(teacherId).catch((err) => console.warn('deleteTeacherFromDb err:', err));
        showToast(`Rekod guru ${teacher?.name} telah dipadam.`);
      },
    });
  };

  const handleRenewAcademicYear = () => {
    const nextYear = `${Number(school.academicYear.split('/')[0]) + 1}/${Number(school.academicYear.split('/')[0]) + 2}`;
    setSchool((prev) => ({ ...prev, academicYear: nextYear, currentWeek: 1 }));
    setBuilderWeek(1);
    setBatchWeek(1);
    setDraftWeekFilter(1);
    setAdminReviewWeek(1);
    showToast(`🎉 Sesi Kalendar Baharu ${nextYear} dibuka! Semua ${teachers.length} rekod guru dikekalkan secara utuh.`);
  };

  // ==========================================
  // YEARLY MATRIX SUBMISSION HANDLERS & COMPUTED
  // ==========================================
  const handleOpenCellModal = (teacher: TeacherProfile, weekNumber: number) => {
    const teacherCells = yearlyRecords[teacher.id] || {};
    const weekDef = academicWeeks.find((w) => w.weekNumber === weekNumber);
    const existing = teacherCells[weekNumber] || {
      weekNumber,
      dueDate: weekDef?.dueDateFriday ? formatToDayMonthYear(weekDef.dueDateFriday) : '',
      status: 'BELUM' as MatrixCellStatus,
    };

    setInspectMatrixCell({ teacher, weekNumber, cell: existing });
    setEditCellForm({
      status: existing.status,
      customDate: existing.submittedDateFormatted || (weekDef?.dueDateFriday ? formatToDayMonth(weekDef.dueDateFriday) : ''),
      notes: existing.notes || '',
      verifiedBy: existing.verifiedBy || currentUser.name,
    });
  };

  const handleSaveMatrixCell = () => {
    if (!inspectMatrixCell) return;
    const { teacher, weekNumber } = inspectMatrixCell;
    const weekDef = academicWeeks.find((w) => w.weekNumber === weekNumber);
    const rawDue = weekDef?.dueDateFriday || '';
    const dm = editCellForm.customDate || (rawDue ? formatToDayMonth(rawDue) : '');

    let statusLabel = '';
    if (editCellForm.status === 'TEPAT') {
      statusLabel = `${dm} tepat`;
    } else if (editCellForm.status === 'LEWAT') {
      statusLabel = `${dm} lewat`;
    } else if (editCellForm.status === 'TIDAK_HANTAR') {
      statusLabel = 'X';
    } else if (editCellForm.status === 'CUTI') {
      statusLabel = 'cuti';
    } else {
      statusLabel = '-';
    }

    setYearlyRecords((prev) => {
      const currentTeacherCells = prev[teacher.id] || {};
      return {
        ...prev,
        [teacher.id]: {
          ...currentTeacherCells,
          [weekNumber]: {
            weekNumber,
            dueDate: rawDue ? formatToDayMonthYear(rawDue) : '',
            status: editCellForm.status,
            submittedDateFormatted: dm,
            statusLabel,
            notes: editCellForm.notes,
            verifiedBy: editCellForm.verifiedBy || currentUser.name,
            verifiedAt: new Date().toISOString(),
          },
        },
      };
    });

    setInspectMatrixCell(null);
    showToast(`✅ Rekod e-RPH Minggu ${weekNumber} (${teacher.name}) telah dikemas kini!`);
  };

  const handleBulkVerifyCurrentWeekMatrix = () => {
    const curWeek = school.currentWeek;
    const weekDef = academicWeeks.find((w) => w.weekNumber === curWeek);
    const rawDue = weekDef?.dueDateFriday || '';
    const dm = rawDue ? formatToDayMonth(rawDue) : '';

    setYearlyRecords((prev) => {
      const updated = { ...prev };
      teachers.forEach((t) => {
        const curCells = updated[t.id] || {};
        const cell = curCells[curWeek];
        if (!cell || cell.status === 'BELUM' || cell.status === 'TEPAT') {
          updated[t.id] = {
            ...curCells,
            [curWeek]: {
              weekNumber: curWeek,
              dueDate: rawDue ? formatToDayMonthYear(rawDue) : '',
              status: 'TEPAT',
              submittedDateFormatted: dm,
              statusLabel: `${dm} tepat`,
              verifiedBy: currentUser.name,
              verifiedAt: new Date().toISOString(),
              notes: 'Disahkan secara pukal oleh Pentadbir',
            },
          };
        }
      });
      return updated;
    });

    showToast(`⚡ Semua guru telah disahkan dan dicop untuk Minggu ${curWeek} (${rawDue})!`);
  };

  const filteredMatrixTeachers = useMemo(() => {
    return regularTeachers.filter((t) => {
      // 1. Search Query (Name, IC, Jawatan, Panitia)
      if (matrixSearchQuery.trim()) {
        const q = matrixSearchQuery.toLowerCase();
        const matchName = t.name.toLowerCase().includes(q);
        const matchChinese = (t.chineseName || '').toLowerCase().includes(q);
        const matchIc = (t.icNo || '').toLowerCase().includes(q);
        const matchJawatan = (t.jawatan || '').toLowerCase().includes(q);
        const matchPanitia = (t.panitia || '').toLowerCase().includes(q);
        if (!matchName && !matchChinese && !matchIc && !matchJawatan && !matchPanitia) return false;
      }
      // 2. Status Filter (has late or has missed)
      if (matrixStatusFilter !== 'ALL') {
        const tCells = yearlyRecords[t.id] || {};
        const activeCount = activeAcademicWeeks.length;
        let hasLate = false;
        let hasMissed = false;
        for (let w = 1; w <= activeCount; w++) {
          if (tCells[w]?.status === 'LEWAT') hasLate = true;
          if (tCells[w]?.status === 'TIDAK_HANTAR') hasMissed = true;
        }
        if (matrixStatusFilter === 'LEWAT' && !hasLate) return false;
        if (matrixStatusFilter === 'TIDAK_HANTAR' && !hasMissed) return false;
      }
      return true;
    });
  }, [regularTeachers, matrixSearchQuery, matrixStatusFilter, yearlyRecords, activeAcademicWeeks.length]);

  const matrixStats = useMemo(() => {
    let totalCells = 0;
    let onTimeCells = 0;
    let lateCells = 0;
    let missedCells = 0;
    const curWeek = school.currentWeek;
    let curWeekSubmitted = 0;
    const activeCount = activeAcademicWeeks.length;

    regularTeachers.forEach((t) => {
      const cells = yearlyRecords[t.id] || {};
      for (let w = 1; w <= activeCount; w++) {
        const c = cells[w];
        if (!c) continue;
        if (c.status === 'TEPAT') {
          totalCells++;
          onTimeCells++;
        } else if (c.status === 'LEWAT') {
          totalCells++;
          lateCells++;
        } else if (c.status === 'TIDAK_HANTAR') {
          missedCells++;
        }
      }
      if (cells[curWeek]?.status === 'TEPAT' || cells[curWeek]?.status === 'LEWAT') {
        curWeekSubmitted++;
      }
    });

    const denom = onTimeCells + lateCells + missedCells;
    const overallRate = denom > 0 ? Math.round((onTimeCells / denom) * 1000) / 10 : 0;

    return {
      totalTeachers: regularTeachers.length,
      overallRate,
      onTimeCells,
      lateCells,
      missedCells,
      curWeekSubmitted,
      curWeekPending: regularTeachers.length - curWeekSubmitted,
    };
  }, [regularTeachers, yearlyRecords, school.currentWeek, activeAcademicWeeks.length]);

  // Authentication & Session Handlers
  const handlePerformLogin = (targetTeacher?: TeacherProfile, provider: 'email' | 'google' = 'email') => {
    setLoginError(null);
    let teacher = targetTeacher;
    const qRaw = loginEmail.trim();
    const q = qRaw.toLowerCase();
    const isSuperadminTarget =
      q === 'yokpoon' ||
      q === 'yokpoon@moe-dl.edu.my' ||
      (targetTeacher && (targetTeacher.id === 'superadmin' || targetTeacher.role === 'superadmin'));

    if (isSuperadminTarget) {
      if (provider === 'email') {
        if (loginPassword.trim() !== 'Admin@JBC3019') {
          setLoginError('Kata laluan Superadmin tidak tepat. Sila gunakan kata laluan rasmi Superadmin (Admin@JBC3019).');
          return;
        }
      }
      teacher = SUPERADMIN_PROFILE;
    } else if (!teacher) {
      teacher = teachers.find(
        (t) =>
          t.email.toLowerCase() === q ||
          t.name.toLowerCase() === q ||
          t.id.toLowerCase() === q ||
          (t.icNo && t.icNo.trim() === qRaw)
      );
    }

    if (!teacher) {
      setLoginError('Akaun guru tidak dijumpai. Sila semak e-mel rasmi DELIMa atau klik mana-mana akaun demo pantas.');
      return;
    }

    if (!isSuperadminTarget && provider === 'email') {
      if (!loginPassword.trim()) {
        setLoginError('Sila masukkan kata laluan DELIMa / Sistem anda.');
        return;
      }
      // Demo validation: accept standard MOE defaults, IC number, or custom password set by admin/superadmin
      const accepted = ['delima123', '123456', teacher.icNo || '', 'admin', 'erph2026', 'password'];
      if (teacher.password) {
        accepted.unshift(teacher.password);
      }
      if (!accepted.includes(loginPassword.trim())) {
        setLoginError('Kata laluan tidak tepat. (Kata laluan lalai: delima123, No. Kad Pengenalan, atau kata laluan yang ditetapkan oleh Pentadbir).');
        return;
      }
    }

    const session: AuthUserSession = {
      userId: teacher.id,
      name: teacher.name,
      chineseName: teacher.chineseName,
      email: teacher.email,
      role: teacher.role,
      jawatan: teacher.jawatan,
      panitia: teacher.panitia,
      provider,
      loginAt: new Date().toISOString(),
      isGoogleLinked: true,
    };

    setAuthSession(session);
    setCurrentUserId(teacher.id);
    setWeeklyTeacherId(teacher.id);
    setSelectedSubjectSlug(teacher.subjectSlug || 'bahasa_cina_sjkc');
    setIsAuthenticated(true);

    if (rememberMe && typeof window !== 'undefined') {
      try {
        localStorage.setItem('erph_auth_session_v1', JSON.stringify(session));
        localStorage.setItem('erph_is_authenticated_v1', 'true');
      } catch (e) {}
    }

    showToast(`✅ Log masuk berjaya! Selamat datang ${teacher.name} (${provider === 'google' ? 'Google DELIMa SSO' : 'E-mel Rasmi'})`);
  };

  const handleGoogleSignIn = async () => {
    if (isSupabaseConfigured) {
      try {
        await signInWithGoogleOAuth();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Ralat semasa log masuk dengan Google.';
        alert(`⚠️ ${msg}`);
      }
    } else {
      alert('⚠️ Supabase belum diaktifkan sepenuhnya pada Netlify. Sila pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY telah dimasukkan ke dalam Netlify Environment Variables dan lakukan "Clear cache and deploy site".');
    }
  };

  const handlePerformLogout = async () => {
    setIsAuthenticated(false);
    setAuthSession(null);
    setCurrentUserId('');
    setShowAccountModal(false);
    await signOutFromSupabase();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('erph_auth_session_v1');
        localStorage.removeItem('erph_is_authenticated_v1');
      } catch (e) {}
    }
    showToast('👋 Anda telah log keluar dari sistem e-RPH.');
  };

  const handleSavePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.newPass || passwordForm.newPass.length < 6) {
      alert('Kata laluan baharu mestilah sekurang-kurangnya 6 aksara.');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirmPass) {
      alert('Pengesahan kata laluan baharu tidak sepadan!');
      return;
    }
    setPasswordForm({ current: '', newPass: '', confirmPass: '' });
    showToast('🔐 Kata laluan akaun anda berjaya dikemaskini!');
  };

  const renderLoginPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-[#0c141f] via-[#152233] to-[#0d1726] flex items-center justify-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 grid grid-cols-1 lg:grid-cols-12 animate-fade-in">
        {/* Left Branding Panel (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-cyan-500/20 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-white font-black text-xl shadow-lg border border-cyan-300/30">
                R
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">e-RPH SJK(C)</h1>
                <p className="text-xs text-cyan-300 font-semibold">{school.name}</p>
              </div>
            </div>

            <div className="pt-6">
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                Sesi Akademik {school.academicYear}
              </span>
              <h2 className="text-2xl font-black text-white mt-3 leading-snug">
                Sistem Pengurusan e-RPH & Jadual Guru
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Portal digital bersepadu Rancangan Pengajaran Harian SJK(C) berasaskan DSKP KPM, dilengkapi pengesahan pentadbir, dan matriks penghantaran tahunan rasmi.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-slate-700/60 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">{school.chineseName}</p>
            <p>{school.ppd}</p>
            <p className="text-[10px] text-slate-500 pt-1">KOD SEKOLAH: <b>{school.code}</b></p>
          </div>
        </div>

        {/* Right Form Panel (7 cols) */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                  Log Masuk DELIMa KPM
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-2">Selamat Datang</h3>
              <p className="text-xs text-slate-500">
                Sila log masuk menggunakan akaun DELIMa rasmi atau Google Workspace anda.
              </p>
            </div>

            {loginError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                <span>⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            {/* Email & Password Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePerformLogin();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mel Rasmi DELIMa MOE / No. KP
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                    ✉️
                  </span>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="cth: g-760728@moe-dl.edu.my"
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kata Laluan</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                    🔒
                  </span>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata laluan"
                    className="w-full pl-9 pr-10 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-semibold"
                  >
                    {showLoginPassword ? 'Sembunyi' : 'Lihat'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ingat sesi saya</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Log Masuk Rasmi</span>
                <span>→</span>
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[10px] font-extrabold uppercase text-slate-400 shrink-0">
                ATAU LOG MASUK GOOGLE
              </span>
              <div className="border-t border-slate-200 w-full"></div>
            </div>

            {/* Google Authentication Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-300 shadow-sm transition flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Log Masuk dengan Google DELIMa MOE</span>
            </button>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Sistem e-RPH Versi Pengeluaran 1.0
              </span>
              <span>KPM SJK(C)</span>
            </div>
          </div>

          <div className="pt-4 text-center text-[10px] text-slate-400">
            Sistem Rancangan Pengajaran Harian Digital Bersepadu KPM
          </div>
        </div>
      </div>
    </div>
  );

  const renderAccountSettingsModal = () => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden text-xs animate-fade-in flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 text-lg font-bold">
              ⚙️
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Tetapan Profil & Keselamatan Akaun</h3>
              <p className="text-[11px] text-slate-300">
                {currentUser.name} • {currentUser.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAccountModal(false)}
            className="text-slate-400 hover:text-white font-bold p-1 rounded-lg text-base"
          >
            ✕
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAccountActiveTab('profil')}
            className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
              accountActiveTab === 'profil'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            👤 Maklumat Profil
          </button>
          <button
            type="button"
            onClick={() => setAccountActiveTab('keselamatan')}
            className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
              accountActiveTab === 'keselamatan'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🔐 Google DELIMa & Kata Laluan
          </button>
          <button
            type="button"
            onClick={() => setAccountActiveTab('sesi')}
            className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
              accountActiveTab === 'sesi'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ⏱️ Status Sesi
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {accountActiveTab === 'profil' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-md shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-slate-900">{currentUser.name}</h4>
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      {currentUser.jawatan || 'GAB'}
                    </span>
                  </div>
                  <p className="text-slate-500 font-medium">{currentUser.chineseName}</p>
                  <p className="text-[11px] font-mono text-cyan-700 mt-0.5">{currentUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. JAWATAN SEKOLAH (Read-Only) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Jawatan Sekolah</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{currentUser.jawatan || 'GAB'}</p>
                  <p className="text-[11px] text-slate-500">
                    {['GB', 'GPK1', 'GPK HEM', 'GPK KK', 'GPK KOKO'].includes(currentUser.jawatan || '')
                      ? 'Kumpulan Pentadbir Sekolah (Pengesahan e-RPH)'
                      : 'Kumpulan Guru Akademik'}
                  </p>
                </div>

                {/* 2. PERANAN SISTEM (Kekal / Dikunci: Hanya Superadmin boleh ubah di sini) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Peranan Sistem</span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      🔒 Dikawal Pentadbir
                    </span>
                  </div>
                  <div className="mt-1">
                    {isSuperadmin ? (
                      <select
                        value={currentUser.role}
                        onChange={(e) => {
                          const newRole = e.target.value as UserRole;
                          const newJawatan = newRole === 'guru_besar' ? 'GB' : newRole === 'pk_pentadbiran' ? 'GPK1' : 'GAB';
                          const updatedUser: TeacherProfile = {
                            ...currentUser,
                            role: newRole,
                            jawatan: newJawatan,
                          };
                          setTeachers((prev) => {
                            const list = prev.map((t) => (t.id === currentUser.id ? updatedUser : t));
                            try { localStorage.setItem('erph_live_teachers_v1', JSON.stringify(list)); } catch (_) {}
                            return list;
                          });
                          setAuthSession((prev) => prev ? { ...prev, role: newRole, jawatan: newJawatan } : prev);
                          try {
                            const curSession = localStorage.getItem('erph_auth_session_v1');
                            if (curSession) {
                              const p = JSON.parse(curSession);
                              p.role = newRole;
                              p.jawatan = newJawatan;
                              localStorage.setItem('erph_auth_session_v1', JSON.stringify(p));
                            }
                          } catch (_) {}
                          saveTeacherToDb(updatedUser).catch((err) => console.warn('saveTeacherToDb err:', err));
                          showToast("✅ Peranan berjaya dikemaskini!");
                        }}
                        className="w-full border rounded-lg p-1.5 bg-slate-50 font-bold text-xs text-slate-800"
                      >
                        <option value="guru">👩‍🏫 Guru Subjek</option>
                        <option value="pk_pentadbiran">🛡️ PK Pentadbiran</option>
                        <option value="guru_besar">🎖️ Guru Besar</option>
                        <option value="guru_ict_data">💻 Guru ICT / Data</option>
                        <option value="superadmin">👑 Superadmin</option>
                      </select>
                    ) : (
                      <div className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>
                          {currentUser.role === 'guru_besar'
                            ? '🎖️ Guru Besar'
                            : currentUser.role === 'pk_pentadbiran'
                            ? '🛡️ PK Pentadbiran'
                            : currentUser.role === 'guru_ict_data'
                            ? '💻 Guru ICT / Data'
                            : currentUser.role === 'superadmin'
                            ? '👑 Superadmin'
                            : '👩‍🏫 Guru Subjek'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">(Kekal)</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isSuperadmin ? 'Disimpan terus ke Supabase & sesi log masuk' : 'Peranan hanya boleh ditukar oleh Pentadbir Sekolah di menu Pengurusan Guru.'}
                  </p>
                </div>

                {/* 3. PANITIA UTAMA (Boleh Disunting oleh Guru) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Panitia Utama</span>
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Boleh Disunting</span>
                  </div>
                  <div className="mt-1">
                    <select
                      value={currentUser.panitia || 'Bahasa Cina'}
                      onChange={(e) => {
                        const newPanitia = e.target.value;
                        const updatedUser: TeacherProfile = {
                          ...currentUser,
                          panitia: newPanitia,
                        };
                        setTeachers((prev) => {
                          const list = prev.map((t) => (t.id === currentUser.id ? updatedUser : t));
                          try { localStorage.setItem('erph_live_teachers_v1', JSON.stringify(list)); } catch (_) {}
                          return list;
                        });
                        setAuthSession((prev) => prev ? { ...prev, panitia: newPanitia } : prev);
                        try {
                          const curSession = localStorage.getItem('erph_auth_session_v1');
                          if (curSession) {
                            const p = JSON.parse(curSession);
                            p.panitia = newPanitia;
                            localStorage.setItem('erph_auth_session_v1', JSON.stringify(p));
                          }
                        } catch (_) {}
                        saveTeacherToDb(updatedUser).catch((err) => console.warn('saveTeacherToDb err:', err));
                        showToast("✅ Panitia utama berjaya dikemaskini!");
                      }}
                      className="w-full border rounded-lg p-1.5 bg-slate-50 font-bold text-xs text-slate-800"
                    >
                      <option value="Bahasa Cina">Bahasa Cina</option>
                      <option value="Bahasa Melayu">Bahasa Melayu</option>
                      <option value="Bahasa Inggeris">Bahasa Inggeris</option>
                      <option value="Matematik">Matematik</option>
                      <option value="Sains">Sains</option>
                      <option value="Pendidikan Moral">Pendidikan Moral</option>
                      <option value="Sejarah">Sejarah</option>
                      <option value="RBT">RBT / TMK</option>
                      <option value="Pendidikan Jasmani & Kesihatan">Pendidikan Jasmani & Kesihatan (PJK)</option>
                      <option value="Pendidikan Seni Visual">Pendidikan Seni Visual (PSV)</option>
                      <option value="Pendidikan Muzik">Pendidikan Muzik</option>
                      <option value="Pentadbiran / Kepimpinan">Pentadbiran / Kepimpinan</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Subjek Utama e-RPH anda</p>
                </div>

                {/* 4. NO KAD PENGENALAN (Boleh Disunting oleh Guru) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">No. Kad Pengenalan</span>
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Boleh Disunting</span>
                  </div>
                  <div className="mt-1">
                    <input
                      type="text"
                      placeholder="cth: 900101011234"
                      defaultValue={currentUser.icNo || ''}
                      onBlur={(e) => {
                        const newIc = e.target.value.trim();
                        if (newIc === (currentUser.icNo || '')) return;
                        const updatedUser: TeacherProfile = {
                          ...currentUser,
                          icNo: newIc,
                        };
                        setTeachers((prev) => {
                          const list = prev.map((t) => (t.id === currentUser.id ? updatedUser : t));
                          try { localStorage.setItem('erph_live_teachers_v1', JSON.stringify(list)); } catch (_) {}
                          return list;
                        });
                        setAuthSession((prev) => prev ? { ...prev, icNo: newIc } : prev);
                        try {
                          const curSession = localStorage.getItem('erph_auth_session_v1');
                          if (curSession) {
                            const p = JSON.parse(curSession);
                            p.icNo = newIc;
                            localStorage.setItem('erph_auth_session_v1', JSON.stringify(p));
                          }
                        } catch (_) {}
                        saveTeacherToDb(updatedUser).catch((err) => console.warn('saveTeacherToDb err:', err));
                        showToast("✅ No. Kad Pengenalan berjaya disimpan!");
                      }}
                      className="w-full border rounded-lg p-1.5 bg-slate-50 font-mono font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Digunakan sebagai pengenalan rasmi & kata laluan lalai log masuk</p>
                </div>
              </div>
            </div>
          )}

          {accountActiveTab === 'keselamatan' && (
            <div className="space-y-5">
              {/* Google Workspace DELIMa Linked Status */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs border border-blue-100 shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-800">Google Workspace DELIMa (KPM)</h4>
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        Dihubungkan ✓
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{currentUser.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 shadow-xs transition"
                >
                  Tukar Akaun Google
                </button>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handleSavePasswordChange} className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                <h4 className="font-extrabold text-slate-800 text-xs">Tukar Kata Laluan Akaun</h4>
                <p className="text-[11px] text-slate-500">
                  Kemaskini kata laluan untuk log masuk melalui e-mel dan kata laluan.
                </p>

                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Kata Laluan Semasa</label>
                    <input
                      type="password"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      placeholder="Masukkan kata laluan semasa"
                      className="w-full border rounded-xl p-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Kata Laluan Baharu</label>
                      <input
                        type="password"
                        required
                        value={passwordForm.newPass}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                        placeholder="Sekurang-kurangnya 6 aksara"
                        className="w-full border rounded-xl p-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Sahkan Kata Laluan Baharu</label>
                      <input
                        type="password"
                        required
                        value={passwordForm.confirmPass}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPass: e.target.value })}
                        placeholder="Ulang kata laluan baharu"
                        className="w-full border rounded-xl p-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition"
                  >
                    Simpan Kata Laluan Baharu
                  </button>
                </div>
              </form>
            </div>
          )}

          {accountActiveTab === 'sesi' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800">Sesi Log Masuk Semasa</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                </div>
                <p className="text-slate-600">
                  Kaedah Pengesahan: <b>{authSession?.provider === 'google' ? 'Google DELIMa SSO (OAuth 2.0)' : 'E-mel & Kata Laluan'}</b>
                </p>
                <p className="text-slate-500 text-[11px]">
                  Masa Log Masuk: {authSession?.loginAt ? new Date(authSession.loginAt).toLocaleString('ms-MY') : 'Sesi Semasa'}
                </p>
                <p className="text-slate-500 text-[11px]">
                  ID Pengguna: <code className="font-mono bg-white px-1.5 py-0.5 rounded border">{currentUser.id}</code>
                </p>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-rose-900">Tamatkan Sesi Log Masuk</h4>
                  <p className="text-rose-700 text-[11px]">
                    Log keluar dari komputer ini dan kembali ke skrin log masuk e-RPH.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePerformLogout}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition shrink-0"
                >
                  Log Keluar Sekarang 🚪
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handlePerformLogout}
            className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1.5"
          >
            <span>🚪</span>
            <span>Log Keluar</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAccountModal(false)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  const renderYearlyMatrix = () => (
    <div className="space-y-6">
      {/* 1. Header Banner matching SJKC Yok Poon master spreadsheet */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md border border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left Dark Blue Banner */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
              🏫
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {school.name}
                </span>
                <span className="text-xs text-blue-200">Kod: {school.code}</span>
              </div>
              <h1 className="text-base sm:text-xl font-black tracking-tight text-white mt-1">
                REKOD PENGHANTARAN E-RPH SESI {school.academicYear}
              </h1>
              <p className="text-[11px] text-blue-200/90 font-medium">
                TARIKH AKHIR HANTAR: <b>SETIAP KHAMIS (KUMP A) / SETIAP JUMAAT (KUMP B)</b> • {school.ppd}
              </p>
            </div>
          </div>

          {/* Right Tarikh Semasa Badge & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-amber-600 border border-amber-400/40 px-3 py-1.5 rounded-xl text-center shadow shrink-0">
              <div className="text-[8px] font-bold text-amber-100 uppercase tracking-widest">TARIKH SEMASA</div>
              <div className="text-xs sm:text-sm font-extrabold text-white" suppressHydrationWarning>
                {new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\s/g, '-')}
              </div>
            </div>

            <button
              onClick={() =>
                exportYearlyMatrixToCSV(
                  school.name,
                  school.academicYear,
                  filteredMatrixTeachers,
                  academicWeeks,
                  yearlyRecords
                )
              }
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
              title="Eksport data matriks tahunan ke fail CSV / Excel"
            >
              <span>📥</span>
              <span>Excel / CSV</span>
            </button>

            <button
              onClick={() =>
                openPrintableYearlyMatrix(
                  school.name,
                  school.code,
                  school.ppd,
                  school.academicYear,
                  teachers,
                  academicWeeks,
                  yearlyRecords,
                  penyemakGroups,
                  'SEMUA GURU'
                )
              }
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 border border-slate-600"
              title="Cetak format landskap rasmi A4 untuk simpanan pentadbir / PPD"
            >
              <span>🖨️</span>
              <span>Cetak A4</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Legend & KPI Stats Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-extrabold text-slate-700 mr-1">PETUNJUK:</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>[/] TEPAT MASA (Hijau)</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 text-cyan-800 border border-cyan-300 rounded-lg font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
            <span>[/] LEWAT HANTAR (Sian)</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300 rounded-lg font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>[X] TIDAK HANTAR (Merah)</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>[Cuti] PERISTIWA / SEKOLAH</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg font-semibold text-[11px]">
            <span>[-] Belum Tiba</span>
          </span>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
          <div>
            Kepatuhan Sekolah:{' '}
            <span className="text-emerald-600 font-extrabold text-sm">{matrixStats.overallRate}%</span>
          </div>
          <div className="h-4 w-px bg-slate-200"></div>
          <div>
            Hantar M.{school.currentWeek}:{' '}
            <span className="text-blue-600 font-extrabold text-sm">
              {matrixStats.curWeekSubmitted} / {matrixStats.totalTeachers}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={matrixSearchQuery}
              onChange={(e) => setMatrixSearchQuery(e.target.value)}
              placeholder="Cari nama guru, No KP, jawatan..."
              className="w-full text-xs font-medium pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
            {matrixSearchQuery && (
              <button
                type="button"
                onClick={() => setMatrixSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={matrixStatusFilter}
            onChange={(e) => setMatrixStatusFilter(e.target.value as any)}
            className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Semua Rekod Guru</option>
            <option value="LEWAT">⚠️ Ada Lewat Hantar Sahaja</option>
            <option value="TIDAK_HANTAR">❌ Ada Tidak Hantar Sahaja</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBulkVerifyCurrentWeekMatrix}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
          >
            <span>⚡</span>
            <span>Sahkan & Cop Pukal Minggu {school.currentWeek}</span>
          </button>
        </div>
      </div>

      {/* 4. The Master Matrix Grid Table with Freeze Pane (Dual Header) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[72vh] relative">
          <table className="w-full border-collapse text-xs select-none">
            <thead className="bg-slate-100 sticky top-0 z-30 shadow-sm text-slate-800">
              {/* Header Row 1: Friday Due Dates */}
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-40 bg-slate-100 border-r border-b border-slate-300 p-2.5 text-center font-extrabold w-12 min-w-[48px]"
                >
                  BIL
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[48px] top-0 z-40 bg-slate-100 border-r border-b border-slate-300 p-2.5 text-left font-extrabold w-32 min-w-[128px]"
                >
                  NO KP / PENGENALAN
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[176px] top-0 z-40 bg-slate-100 border-r border-b border-slate-300 p-2.5 text-left font-extrabold min-w-[190px]"
                >
                  NAMA GURU
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[366px] top-0 z-40 bg-slate-100 border-r border-b border-slate-300 p-2.5 text-center font-extrabold w-20 min-w-[80px]"
                >
                  JAWATAN
                </th>

                {/* Weeks (All active academic weeks): Top Row shows Friday Due Date */}
                {activeAcademicWeeks.map((w) => {
                  const parts = (w.dueDateFriday || '').split('-');
                  const dmYear = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}` : '';
                  return (
                    <th
                      key={w.weekNumber}
                      className="border-r border-b border-slate-300 px-2 py-1.5 text-center font-extrabold text-[11px] bg-slate-200/90 text-slate-800 min-w-[95px] whitespace-nowrap"
                    >
                      {dmYear}
                    </th>
                  );
                })}

                <th
                  rowSpan={2}
                  className="sticky right-[150px] top-0 z-40 bg-slate-100 border-l border-r border-slate-300 p-2.5 text-center font-extrabold min-w-[80px]"
                >
                  JUM HANTAR
                </th>
                <th
                  rowSpan={2}
                  className="sticky right-[75px] top-0 z-40 bg-slate-100 border-r border-b border-slate-300 p-2.5 text-center font-extrabold min-w-[75px]"
                >
                  % TEPAT
                </th>
                <th
                  rowSpan={2}
                  className="sticky right-0 top-0 z-40 bg-slate-100 border-b border-slate-300 p-2.5 text-center font-extrabold min-w-[75px]"
                >
                  TINDAKAN
                </th>
              </tr>

              {/* Header Row 2: Week Numbers */}
              <tr>
                {activeAcademicWeeks.map((w) => {
                  const isCurrent = w.weekNumber === school.currentWeek;
                  return (
                    <th
                      key={w.weekNumber}
                      className={`border-r border-b border-slate-300 px-2 py-1 text-center font-black text-xs ${
                        isCurrent
                          ? 'bg-amber-300 text-slate-950 font-black'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      M{w.weekNumber}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredMatrixTeachers.map((teacher, idx) => {
                const teacherCells = yearlyRecords[teacher.id] || {};
                const summary = calculateTeacherMatrixSummary(teacherCells, activeAcademicWeeks.length);

                // Jawatan badge styling
                const jawatan = teacher.jawatan || 'GAB';
                let jawatanStyle = 'bg-slate-100 text-slate-700 border-slate-300';
                if (jawatan === 'GB') jawatanStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
                else if (jawatan === 'GPK1') jawatanStyle = 'bg-sky-100 text-sky-900 border-sky-300 font-black';
                else if (jawatan === 'GPK HEM') jawatanStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black';
                else if (jawatan === 'GPK KOKO') jawatanStyle = 'bg-orange-100 text-orange-900 border-orange-300 font-black';
                else if (jawatan === 'G GANTI') jawatanStyle = 'bg-purple-100 text-purple-900 border-purple-300 font-black';

                return (
                  <tr key={teacher.id} className="hover:bg-blue-50/40 transition group">
                    {/* Sticky Col 1: BIL */}
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50/70 border-r border-slate-200 p-2.5 text-center font-bold text-slate-600">
                      {idx + 1}
                    </td>

                    {/* Sticky Col 2: NO KP / PENGENALAN */}
                    <td className="sticky left-[48px] z-20 bg-white group-hover:bg-blue-50/70 border-r border-slate-200 p-2.5 font-mono text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                      {teacher.icNo || '—'}
                    </td>

                    {/* Sticky Col 3: NAMA GURU */}
                    <td className="sticky left-[176px] z-20 bg-white group-hover:bg-blue-50/70 border-r border-slate-200 p-2.5 whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 text-xs">{teacher.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{teacher.chineseName}</div>
                    </td>

                    {/* Sticky Col 4: JAWATAN */}
                    <td className="sticky left-[366px] z-20 bg-white group-hover:bg-blue-50/70 border-r border-slate-200 p-2 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${jawatanStyle}`}>
                        {jawatan}
                      </span>
                    </td>

                    {/* WEEKS (All Active Weeks) */}
                    {activeAcademicWeeks.map((w) => {
                      const cell = teacherCells[w.weekNumber];
                      const status = cell?.status || 'BELUM';
                      const parts = (w.dueDateFriday || '').split('-');
                      const dm = parts.length === 3 ? `${parts[2]}-${parts[1]}` : '';

                      let cellStyle = 'bg-slate-50 text-slate-400 hover:bg-slate-100 border-slate-100';
                      let label = '-';

                      if (status === 'TEPAT') {
                        cellStyle =
                          'bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#166534] border-[#86efac] font-bold';
                        label = `✓ ${cell?.statusLabel || `${dm} tepat`}`;
                      } else if (status === 'LEWAT') {
                        cellStyle =
                          'bg-[#cffafe] hover:bg-[#a5f3fc] text-[#155e75] border-[#67e8f9] font-bold';
                        label = `✓ ${cell?.statusLabel || `${dm} lewat`}`;
                      } else if (status === 'TIDAK_HANTAR') {
                        cellStyle =
                          'bg-[#fee2e2] hover:bg-[#fca5a5] text-[#991b1b] border-[#fca5a5] font-extrabold';
                        label = '✗ X';
                      } else if (status === 'CUTI') {
                        cellStyle =
                          'bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] border-[#fde68a] font-bold';
                        label = '🌴 Cuti';
                      }

                      return (
                        <td
                          key={w.weekNumber}
                          className="border-r border-slate-200 p-1 text-center whitespace-nowrap"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenCellModal(teacher, w.weekNumber)}
                            className={`w-full py-1.5 px-1 rounded border text-[10px] transition cursor-pointer ${cellStyle}`}
                            title={`Minggu ${w.weekNumber} (${w.dueDateFriday}): Klik untuk ubah / semak status`}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}

                    {/* Sticky Right 1: JUM HANTAR */}
                    <td className="sticky right-[150px] z-20 bg-white group-hover:bg-blue-50/70 border-l border-r border-slate-200 p-2 text-center font-bold text-slate-800 whitespace-nowrap">
                      {summary.totalSubmitted} / {activeAcademicWeeks.length}
                    </td>

                    {/* Sticky Right 2: % TEPAT */}
                    <td className="sticky right-[75px] z-20 bg-white group-hover:bg-blue-50/70 border-r border-slate-200 p-2 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-black text-[11px] ${
                          summary.complianceRate >= 90
                            ? 'bg-emerald-100 text-emerald-800'
                            : summary.complianceRate >= 75
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {summary.complianceRate}%
                      </span>
                    </td>

                    {/* Sticky Right 3: TINDAKAN */}
                    <td className="sticky right-0 z-20 bg-white group-hover:bg-blue-50/70 border-slate-200 p-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenCellModal(teacher, school.currentWeek)}
                        className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-bold border border-blue-200 transition"
                      >
                        Periksa ✍️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );



  // Hydration guard: ensures identical output between SSR and client initial paint
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0f141a] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Memuatkan Sistem e-RPH SJK(C)...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, display the full Login Page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-800 antialiased">
        {toast && (
          <div className="fixed top-5 right-5 z-50 bg-slate-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 backdrop-blur-md animate-fade-in">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white font-bold ml-2">
              ✕
            </button>
          </div>
        )}
        {renderLoginPage()}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f4f6f9] text-slate-800 antialiased overflow-hidden">
      {/* TOAST POPUP */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 backdrop-blur-md animate-fade-in">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* SIDEBAR (Dark Color Admin Style) */}
      {/* MOBILE BACKDROP */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* SIDEBAR (Responsive Off-Canvas on Mobile, Collapsible Mini + Hover Expand on Desktop) */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 bg-[#1a2229] text-[#a8b2bc] flex flex-col border-r border-[#12181d] select-none transition-all duration-300 ease-in-out shrink-0 ${
          mobileMenuOpen
            ? 'translate-x-0 w-72 sm:w-80 shadow-2xl z-50'
            : '-translate-x-full lg:translate-x-0'
        } ${
          isSidebarExpanded
            ? 'lg:w-72 lg:shadow-2xl lg:shadow-black/60'
            : 'lg:w-[72px]'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div
          className={`h-16 flex items-center border-b border-[#242e38] bg-[#151c22] shrink-0 transition-all ${
            isSidebarExpanded ? 'justify-between px-3.5' : 'justify-center px-0'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-cyan-500/20 shrink-0">
              R
            </div>
            {isSidebarExpanded && (
              <div className="leading-tight overflow-hidden whitespace-nowrap animate-fade-in">
                <h1 className="text-white font-black tracking-wide text-sm">
                  e-RPH
                </h1>
                <p className="text-[10px] text-[#788896] truncate max-w-[130px]">{school.name}</p>
              </div>
            )}
          </div>

          {/* Action buttons (Pin on Desktop, Close on Mobile) */}
          {isSidebarExpanded && (
            <div className="flex items-center gap-1 shrink-0 animate-fade-in">
              {/* Desktop Pin Toggle Button */}
              <button
                type="button"
                onClick={toggleSidebarPin}
                className={`hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition ${
                  isSidebarPinned
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-[#252f38]'
                }`}
                title={isSidebarPinned ? 'Nyah-pin Sidebar (Auto-Sembunyi)' : 'Pin Sidebar Sentiasa Terbuka'}
              >
                {isSidebarPinned ? (
                  <Pin className="w-4 h-4 fill-cyan-400" />
                ) : (
                  <PinOff className="w-4 h-4" />
                )}
              </button>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg transition"
                title="Tutup Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Current Active Persona Card */}
        <div className="p-2.5 border-b border-[#242e38] bg-[#1a2229] shrink-0">
          {!isSidebarExpanded ? (
            <div className="flex items-center justify-center">
              <div
                suppressHydrationWarning
                title={`${currentUser.name} (${currentUser.jawatan || currentUser.role})`}
                className={`w-10 h-10 rounded-xl ${
                  isSuperadmin
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-600 shadow-amber-500/20'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20'
                } flex items-center justify-center text-white font-bold text-sm shadow cursor-pointer transition-transform hover:scale-105`}
              >
                {isSuperadmin ? '👑' : currentUser.name.charAt(0)}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-[#222c36] p-2.5 rounded-xl border border-[#2b3744]">
              <div
                suppressHydrationWarning
                className={`w-9 h-9 rounded-xl ${
                  isSuperadmin
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-600'
                    : 'bg-gradient-to-br from-indigo-500 to-cyan-500'
                } flex items-center justify-center text-white font-bold text-xs shrink-0 shadow`}
              >
                {isSuperadmin ? '👑' : currentUser.name.charAt(0)}
              </div>
              <div className="overflow-hidden leading-tight flex-1">
                <p className="text-white text-xs font-bold truncate">{currentUser.name}</p>
                <p className="text-[11px] text-[#869ab0] truncate">{currentUser.chineseName}</p>
                <p className="text-[10px] font-bold text-cyan-400 uppercase mt-0.5 tracking-wider truncate" suppressHydrationWarning>
                  {isSuperadmin
                    ? '👑 Superadmin Sistem'
                    : currentUser.jawatan === 'GB' || currentUser.role === 'guru_besar'
                    ? 'Guru Besar (Pentadbir)'
                    : currentUser.jawatan === 'GPK1'
                    ? 'PK Pentadbiran (Pentadbir)'
                    : currentUser.jawatan === 'GPK HEM'
                    ? 'GPK HEM (Pentadbir)'
                    : currentUser.jawatan === 'GPK KK' || currentUser.jawatan === 'GPK KOKO'
                    ? 'GPK Kokurikulum (Pentadbir)'
                    : currentUser.role === 'guru_ict_data'
                    ? 'Guru ICT / Data'
                    : 'Guru Subjek'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ROLE-SPECIFIC SIDEBAR NAVIGATION */}
        <nav className="px-2.5 space-y-1.5 text-xs font-medium flex-1 overflow-y-auto py-3">
          {/* 1. GURU NAVIGATION */}
          {isGuru && (
            <>
              {isSidebarExpanded ? (
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#546270]">
                  Menu Guru Subjek
                </p>
              ) : (
                <div className="my-2 border-t border-[#242e38] mx-2" />
              )}
              <SidebarNavItem
                icon={<LayoutDashboard className="w-5 h-5 shrink-0" />}
                label="Dashboard Guru"
                active={activeNav === 'dashboard'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('dashboard')}
              />
              <SidebarNavItem
                icon={<Sparkles className="w-5 h-5 shrink-0" />}
                label="Bina e-RPH Mengikut Hari"
                badge={
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                    0-API
                  </span>
                }
                active={activeNav === 'rph-builder'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('rph-builder')}
              />
              <SidebarNavItem
                icon={<FileEdit className="w-5 h-5 shrink-0" />}
                label="Semak & Edit Draf"
                badge={
                  <span className="text-[10px] font-mono text-cyan-400">
                    {rphRecords.filter((r) => r.teacherId === currentUser.id && r.weekNumber === draftWeekFilter).length} Sesi
                  </span>
                }
                active={activeNav === 'rph-drafts'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('rph-drafts')}
              />
              <SidebarNavItem
                icon={<CalendarDays className="w-5 h-5 shrink-0" />}
                label="Jadual Mengajar Saya"
                badge={
                  <span className="text-[10px] font-mono text-cyan-400">
                    {teacherOwnSlots.length} Sesi
                  </span>
                }
                active={activeNav === 'my-timetable'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('my-timetable')}
              />
              <SidebarNavItem
                icon={<BookOpen className="w-5 h-5 shrink-0" />}
                label="RPT Mengajar Saya"
                badge={
                  <span className="text-[10px] font-mono text-cyan-400">
                    {teacherRptAssignments.length} Subjek
                  </span>
                }
                active={activeNav === 'my-rpt'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('my-rpt')}
              />
            </>
          )}

          {/* 2. SUPERADMIN NAVIGATION */}
          {isSuperadmin && (
            <>
              {isSidebarExpanded ? (
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>👑</span>
                  <span>Pengurusan Superadmin</span>
                </p>
              ) : (
                <div className="my-2 border-t border-[#242e38] mx-2" />
              )}
              <SidebarNavItem
                icon={<LayoutDashboard className="w-5 h-5 shrink-0" />}
                label="Dashboard Sekolah"
                colorScheme="amber"
                active={activeNav === 'dashboard'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('dashboard')}
              />
              <SidebarNavItem
                icon={<ShieldCheck className="w-5 h-5 shrink-0" />}
                label="Semakan & Cop Pentadbir"
                colorScheme="amber"
                badge={
                  metrics.waitingReview > 0 ? (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {metrics.waitingReview}
                    </span>
                  ) : undefined
                }
                active={activeNav === 'admin-review'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('admin-review')}
              />
              <SidebarNavItem
                icon={<LineChart className="w-5 h-5 shrink-0" />}
                label="Matriks Tahunan"
                colorScheme="amber"
                badge={
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    REKOD
                  </span>
                }
                active={activeNav === 'yearly-matrix'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('yearly-matrix')}
              />
              <SidebarNavItem
                icon={<CalendarRange className="w-5 h-5 shrink-0" />}
                label="Takwim & Minggu Persekolahan"
                colorScheme="amber"
                badge={
                  <span className="text-[10px] font-mono text-amber-300">
                    {activeAcademicWeeks.length} M
                  </span>
                }
                active={activeNav === 'settings'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('settings')}
              />
              <SidebarNavItem
                icon={<Users className="w-5 h-5 shrink-0" />}
                label="Pengurusan Guru & Peranan"
                colorScheme="amber"
                badge={
                  <span className="text-[10px] font-mono text-amber-300">
                    {teachers.length} Guru
                  </span>
                }
                active={activeNav === 'roster'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('roster')}
              />
            </>
          )}

          {/* 3. PENTADBIR NAVIGATION (PK Pentadbiran & Guru Besar) */}
          {isPentadbir && !isSuperadmin && (
            <>
              {isSidebarExpanded ? (
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#546270]">
                  Pengurusan Pentadbiran
                </p>
              ) : (
                <div className="my-2 border-t border-[#242e38] mx-2" />
              )}
              <SidebarNavItem
                icon={<LayoutDashboard className="w-5 h-5 shrink-0" />}
                label="Dashboard Sekolah"
                active={activeNav === 'dashboard'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('dashboard')}
              />
              <SidebarNavItem
                icon={<ShieldCheck className="w-5 h-5 shrink-0" />}
                label="Semakan & Cop Pentadbir"
                badge={
                  metrics.waitingReview > 0 ? (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {metrics.waitingReview}
                    </span>
                  ) : undefined
                }
                active={activeNav === 'admin-review'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('admin-review')}
              />
              <SidebarNavItem
                icon={<CalendarRange className="w-5 h-5 shrink-0" />}
                label="Takwim & Minggu Persekolahan"
                badge={
                  <span className="text-[10px] font-mono text-cyan-400">
                    {activeAcademicWeeks.length} Minggu
                  </span>
                }
                active={activeNav === 'settings'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('settings')}
              />
              <SidebarNavItem
                icon={<Users className="w-5 h-5 shrink-0" />}
                label="Pengurusan Guru & Peranan"
                badge={
                  <span className="text-[10px] font-mono text-cyan-400">
                    {teachers.length}
                  </span>
                }
                active={activeNav === 'roster'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('roster')}
              />

              {isSidebarExpanded ? (
                <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#546270]">
                  Kelas Mengajar Pentadbir
                </p>
              ) : (
                <div className="my-2 border-t border-[#242e38] mx-2" />
              )}
              <SidebarNavItem
                icon={<Sparkles className="w-5 h-5 shrink-0" />}
                label="Bina e-RPH Saya"
                active={activeNav === 'rph-builder'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('rph-builder')}
              />
              <SidebarNavItem
                icon={<FileEdit className="w-5 h-5 shrink-0" />}
                label="Draf Pengajaran Saya"
                active={activeNav === 'rph-drafts'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('rph-drafts')}
              />
              <SidebarNavItem
                icon={<CalendarDays className="w-5 h-5 shrink-0" />}
                label="Jadual Waktu Mengajar Saya"
                badge={
                  <span className="text-[10px] font-mono text-cyan-400">
                    {teacherOwnSlots.length} Sesi
                  </span>
                }
                active={activeNav === 'my-timetable'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('my-timetable')}
              />
              <SidebarNavItem
                icon={<BookOpen className="w-5 h-5 shrink-0" />}
                label="RPT Mengajar Saya"
                badge={
                  <span className="text-[10px] font-mono text-cyan-400">
                    {teacherRptAssignments.length} Subjek
                  </span>
                }
                active={activeNav === 'my-rpt'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('my-rpt')}
              />
            </>
          )}

          {/* 4. GURU ICT / DATA NAVIGATION */}
          {isIct && !isSuperadmin && (
            <>
              {isSidebarExpanded ? (
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#546270]">
                  Sistem & Data Sekolah
                </p>
              ) : (
                <div className="my-2 border-t border-[#242e38] mx-2" />
              )}
              <SidebarNavItem
                icon={<LayoutDashboard className="w-5 h-5 shrink-0" />}
                label="Dashboard Sistem"
                colorScheme="purple"
                active={activeNav === 'dashboard'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('dashboard')}
              />
              <SidebarNavItem
                icon={<LineChart className="w-5 h-5 shrink-0" />}
                label="Matriks Tahunan"
                colorScheme="purple"
                badge={
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    REKOD
                  </span>
                }
                active={activeNav === 'yearly-matrix'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('yearly-matrix')}
              />
              <SidebarNavItem
                icon={<CalendarRange className="w-5 h-5 shrink-0" />}
                label="Takwim & Minggu Persekolahan"
                colorScheme="purple"
                badge={
                  <span className="text-[10px] font-mono text-purple-300">
                    {activeAcademicWeeks.length} Minggu
                  </span>
                }
                active={activeNav === 'settings'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('settings')}
              />
              <SidebarNavItem
                icon={<Users className="w-5 h-5 shrink-0" />}
                label="Pengurusan Guru & Peranan"
                colorScheme="purple"
                badge={
                  <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded">
                    {teachers.length}
                  </span>
                }
                active={activeNav === 'roster'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('roster')}
              />

              {isSidebarExpanded ? (
                <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#546270]">
                  Kelas Mengajar Guru ICT
                </p>
              ) : (
                <div className="my-2 border-t border-[#242e38] mx-2" />
              )}
              <SidebarNavItem
                icon={<Sparkles className="w-5 h-5 shrink-0" />}
                label="Bina e-RPH Saya"
                colorScheme="purple"
                active={activeNav === 'rph-builder'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('rph-builder')}
              />
              <SidebarNavItem
                icon={<FileEdit className="w-5 h-5 shrink-0" />}
                label="Draf Pengajaran Saya"
                colorScheme="purple"
                active={activeNav === 'rph-drafts'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('rph-drafts')}
              />
              <SidebarNavItem
                icon={<CalendarDays className="w-5 h-5 shrink-0" />}
                label="Jadual Waktu Mengajar Saya"
                colorScheme="purple"
                active={activeNav === 'my-timetable'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('my-timetable')}
              />
              <SidebarNavItem
                icon={<BookOpen className="w-5 h-5 shrink-0" />}
                label="RPT Mengajar Saya"
                colorScheme="purple"
                badge={
                  <span className="text-[10px] font-mono text-purple-300">
                    {teacherRptAssignments.length} Subjek
                  </span>
                }
                active={activeNav === 'my-rpt'}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo('my-rpt')}
              />
            </>
          )}
        </nav>

        {/* Sidebar User Settings & Logout Footer */}
        <div className="p-2.5 border-t border-[#242e38] bg-[#151c22] space-y-2 shrink-0">
          {!isSidebarExpanded ? (
            <div className="flex flex-col items-center gap-2">
              {/* User Settings Icon Button */}
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-11 h-11 rounded-xl bg-[#1e2730] hover:bg-[#25313d] border border-[#2b3744] text-cyan-400 hover:text-cyan-300 flex items-center justify-center transition group shadow-sm"
                title={`Tetapan Akaun (${currentUser.name})`}
              >
                <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
              </button>

              {/* Logout Icon Button */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handlePerformLogout();
                }}
                className="w-11 h-11 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 flex items-center justify-center transition"
                title="Log Keluar dari Sistem"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              {/* User Settings Button */}
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#1e2730] hover:bg-[#25313d] border border-[#2b3744] text-left transition group shadow-sm"
                title="Buka Tetapan Akaun Pengguna"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center text-white font-extrabold text-xs shadow-xs shrink-0">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="text-xs font-bold text-white truncate max-w-[130px] group-hover:text-cyan-400 transition">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      <span>Tetapan Akaun</span>
                    </p>
                  </div>
                </div>
                <Settings className="w-4 h-4 text-[#6b7b8a] group-hover:text-cyan-400 group-hover:rotate-45 transition-all duration-300" />
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handlePerformLogout();
                }}
                className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 group"
                title="Log Keluar dari Sistem"
              >
                <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>Log Keluar</span>
              </button>

              <div className="text-[10px] text-[#546270] text-center pt-0.5">
                KPM SJK(C) • {school.academicYear}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div
        className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
          isSidebarPinned ? 'lg:pl-72' : 'lg:pl-[72px]'
        }`}
      >
        {/* TOP HEADER BAR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 focus:outline-none shrink-0"
              aria-label="Buka Menu Navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1 overflow-hidden">
              <h2 className="text-xs sm:text-base font-extrabold text-slate-800 truncate" title="Halaman Semasa">
                {activeNav === 'dashboard' && (isGuru ? 'Dashboard Guru Subjek' : isIct ? 'Dashboard Guru ICT / Data' : 'Dashboard Pentadbir')}
                {activeNav === 'rph-builder' && 'Penjana & Import e-RPH'}
                {activeNav === 'rph-drafts' && 'Buku Draf e-RPH Saya'}
                {activeNav === 'my-timetable' && 'Jadual Waktu Mengajar'}
                {activeNav === 'my-rpt' && 'Rancangan Pengajaran Tahunan (RPT) Mengajar Saya'}
                {activeNav === 'admin-review' && 'Pusat Semakan Pentadbir'}
                {activeNav === 'yearly-matrix' && 'Rekod Matriks Tahunan'}
                {activeNav === 'settings' && 'Pengurusan Takwim Sekolah'}
                {activeNav === 'roster' && 'Senarai Guru & Peranan'}
              </h2>
              <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 text-[9px] px-1.5 py-0.2 rounded font-bold inline-block sm:hidden">
                M.{school.currentWeek}
              </span>
            </div>

            <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 text-xs px-2.5 py-0.5 rounded-full font-bold hidden sm:inline-block shrink-0">
              Minggu Semasa: {school.currentWeek}
            </span>
          </div>

          {/* Right Header: Role Switcher & Notification Bell */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Notification Bell (Pemberitahuan e-RPH) */}
            {(() => {
              const currentTeacherRphs = rphRecords.filter(
                (r) => r.teacherId === currentUser.id && r.weekNumber === school.currentWeek
              );
              const isSubmittedOrVerified = currentTeacherRphs.some(
                (r) => r.status === 'DIHANTAR' || r.status === 'DISAHKAN'
              );
              const hasGuruAlert = isGuru && !isSubmittedOrVerified;
              const hasAdminAlert = !isGuru && metrics.waitingReview > 0;
              const hasAlert = hasGuruAlert || hasAdminAlert;

              return (
                <div className="relative">
                  <button
                    onClick={() => setShowNotificationMenu(!showNotificationMenu)}
                    className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition ${
                      hasAlert
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                    title="Pemberitahuan Status e-RPH"
                  >
                    <span>🔔</span>
                    {hasAlert && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white">
                        {hasGuruAlert ? '!' : metrics.waitingReview}
                      </span>
                    )}
                  </button>

                  {/* Notification Drawer */}
                  {showNotificationMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 text-xs space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-extrabold text-slate-800">Pemberitahuan e-RPH</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">
                          Minggu {school.currentWeek}
                        </span>
                      </div>

                      {isGuru ? (
                        <div className="space-y-2">
                          {isSubmittedOrVerified ? (
                            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-1">
                              <span className="bg-emerald-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded">
                                SELESAI
                              </span>
                              <p className="font-bold text-slate-800 mt-1">
                                e-RPH Minggu {school.currentWeek} telah dihantar/disahkan.
                              </p>
                              <p className="text-slate-600 text-[11px]">
                                Terima kasih atas komitmen dan penghantaran tepat pada masanya.
                              </p>
                            </div>
                          ) : (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-2">
                              <span className="bg-amber-500 text-slate-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded">
                                PERINGATAN PENGHANTARAN
                              </span>
                              <p className="font-bold text-slate-800">
                                e-RPH Minggu {school.currentWeek} Belum Dihantar
                              </p>
                              <p className="text-slate-600 text-[11px]">
                                Anda mempunyai {currentTeacherRphs.length} rekod PdP draf bagi minggu ini. Sila hantar sebelum tarikh akhir Jumaat.
                              </p>
                              <button
                                onClick={() => {
                                  navigateTo('rph-drafts');
                                  setShowNotificationMenu(false);
                                }}
                                className="w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition"
                              >
                                Semak & Hantar Draf Sekarang →
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {metrics.waitingReview > 0 ? (
                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl space-y-2">
                              <span className="bg-blue-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded">
                                SEMAKAN PENTADBIR
                              </span>
                              <p className="font-bold text-slate-800">
                                {metrics.waitingReview} Guru Menunggu Semakan
                              </p>
                              <p className="text-slate-600 text-[11px]">
                                Guru telah menghantar e-RPH Minggu {school.currentWeek} untuk disemak dan diberi pengesahan cop rasmi.
                              </p>
                              <button
                                onClick={() => {
                                  navigateTo('admin-review');
                                  setShowNotificationMenu(false);
                                }}
                                className="w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition"
                              >
                                Buka Pusat Semakan Pentadbir →
                              </button>
                            </div>
                          ) : (
                            <div className="py-6 text-center text-slate-400">
                              <p>✨ Tiada e-RPH baharu menunggu semakan pada masa ini.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Authenticated User Identity Pill (Production Mode) */}
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 transition text-left shrink-0 cursor-pointer"
              title="Buka Tetapan Profil Akaun"
            >
              <div
                suppressHydrationWarning
                className={`w-5 h-5 rounded-full ${
                  isSuperadmin ? 'bg-amber-500' : 'bg-cyan-600'
                } text-white font-black text-[10px] flex items-center justify-center shrink-0`}
              >
                {isSuperadmin ? '👑' : currentUser.name.charAt(0)}
              </div>
              <span className="text-xs font-bold text-slate-800 truncate max-w-[130px] sm:max-w-[180px]">
                {currentUser.name}
              </span>
              <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 uppercase hidden sm:inline-block shrink-0">
                {isSuperadmin ? 'Superadmin' : currentUser.jawatan || currentUser.role}
              </span>
            </button>
          </div>
        </header>

        {/* MAIN BODY CONTAINER */}
        <main className="p-3 sm:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto min-w-0">


          {/* =====================================================================
              VIEW: DASHBOARD (Guru, Guru ICT, Pentadbir)
             ===================================================================== */}
          {activeNav === 'dashboard' && (
            <div className="space-y-6">
              {/* 1. GURU DASHBOARD */}
              {isGuru && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Jadual Waktu Mengajar
                      </span>
                      <h3 className="text-3xl font-extrabold text-slate-800 mt-2">
                        {teacherOwnSlots.length} Sesi
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Minggu ini ({school.academicYear})</p>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                        Draf e-RPH Disediakan
                      </span>
                      <h3 className="text-3xl font-extrabold text-blue-600 mt-2">
                        {rphRecords.filter((r) => r.teacherId === currentUser.id && r.weekNumber === school.currentWeek).length} Sesi
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Minggu {school.currentWeek}</p>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                        Status Pengesahan
                      </span>
                      <h3 className="text-2xl font-extrabold text-emerald-600 mt-2">
                        {rphRecords.some(
                          (r) => r.teacherId === currentUser.id && r.weekNumber === school.currentWeek && r.status === 'DISAHKAN'
                        )
                          ? 'Disahkan ✅'
                          : rphRecords.some(
                              (r) => r.teacherId === currentUser.id && r.weekNumber === school.currentWeek && r.status === 'DIHANTAR'
                            )
                          ? 'Dihantar ⏳'
                          : 'Belum Hantar ⚠️'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Oleh PK Pentadbiran / GB</p>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                        Takwim Persekolahan
                      </span>
                      <h3 className="text-3xl font-extrabold text-purple-600 mt-2">
                        Minggu {school.currentWeek}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Sesi Persekolahan KPM</p>
                    </div>
                  </div>

                  {/* Quick Action Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg space-y-3">
                      <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        Persediaan PdP Fleksibel
                      </span>
                      <h3 className="text-xl font-black">Bina & Rancang e-RPH Lebih Awal</h3>
                      <p className="text-xs text-blue-100 leading-relaxed">
                        Anda kini boleh menyediakan e-RPH untuk minggu-minggu berikutnya lebih awal (contohnya Minggu {school.currentWeek + 1} atau {school.currentWeek + 2}) tanpa dihadkan kepada minggu semasa sahaja.
                      </p>
                      <button
                        onClick={() => setActiveNav('rph-builder')}
                        className="px-4 py-2 bg-white text-blue-700 font-extrabold text-xs rounded-xl shadow hover:bg-blue-50 transition"
                      >
                        Buka Penjana e-RPH →
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                      <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        Buku Rekod Mengajar Digital
                      </span>
                      <h3 className="text-xl font-black text-slate-800">Semak & Edit Draf Harian</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Susun dan semak draf RPH mengikut hari persekolahan (Isnin hingga Jumaat). Anda boleh menyunting teks, mencetak, atau mengeksport format rasmi .DOCX KPM.
                      </p>
                      <button
                        onClick={() => setActiveNav('rph-drafts')}
                        className="px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow hover:bg-slate-800 transition"
                      >
                        Lihat Draf Pengajaran →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PENTADBIR & ICT DASHBOARD */}
              {!isGuru && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                      onClick={() => setActiveNav('admin-review')}
                      className="cursor-pointer relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white p-5 shadow-lg shadow-emerald-500/20 hover:scale-[1.01] transition"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start">
                          <span className="text-xs uppercase font-bold tracking-wider text-emerald-200">
                            Penghantaran e-RPH
                          </span>
                          <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                            Minggu {school.currentWeek}
                          </span>
                        </div>
                        <h3 className="text-3xl font-extrabold mt-2">{metrics.percentSubmitted}%</h3>
                        <p className="text-xs text-emerald-100 mt-1">
                          {metrics.submittedCount} daripada {metrics.totalGuru} guru telah menghantar
                        </p>
                        <div className="w-full bg-black/20 h-1.5 rounded-full mt-4 overflow-hidden">
                          <div
                            className="bg-white h-full rounded-full transition-all"
                            style={{ width: `${metrics.percentSubmitted}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveNav('admin-review')}
                      className="cursor-pointer relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white p-5 shadow-lg shadow-purple-500/20 hover:scale-[1.01] transition"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start">
                          <span className="text-xs uppercase font-bold tracking-wider text-purple-200">
                            Pengesahan Rasmi
                          </span>
                          <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                            Minggu {school.currentWeek}
                          </span>
                        </div>
                        <h3 className="text-3xl font-extrabold mt-2">
                          {metrics.verifiedCount} / {metrics.totalGuru}
                        </h3>
                        <p className="text-xs text-purple-100 mt-1">
                          Guru telah disahkan & dicop rasmi
                        </p>
                        <div className="w-full bg-black/20 h-1.5 rounded-full mt-4 overflow-hidden">
                          <div
                            className="bg-white h-full rounded-full transition-all"
                            style={{
                              width: `${
                                metrics.totalGuru > 0
                                  ? (metrics.verifiedCount / metrics.totalGuru) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveNav('admin-review')}
                      className="cursor-pointer relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06b6d4] to-[#2563eb] text-white p-5 shadow-lg shadow-cyan-500/20 hover:scale-[1.01] transition"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start">
                          <span className="text-xs uppercase font-bold tracking-wider text-cyan-200">
                            Menunggu Semakan
                          </span>
                          <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                            Tindakan
                          </span>
                        </div>
                        <h3 className="text-3xl font-extrabold mt-2">{metrics.waitingReview} Guru</h3>
                        <p className="text-xs text-cyan-100 mt-1">
                          {metrics.verifiedCount} guru telah disahkan minggu ini
                        </p>
                        <div className="w-full bg-black/20 h-1.5 rounded-full mt-4 overflow-hidden">
                          <div
                            className="bg-white h-full rounded-full transition-all"
                            style={{
                              width: `${
                                metrics.totalGuru > 0
                                  ? (metrics.verifiedCount / metrics.totalGuru) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveNav('settings')}
                      className="cursor-pointer relative overflow-hidden rounded-2xl bg-[#1e293b] text-white p-5 shadow-lg shadow-slate-900/20 border border-slate-700 hover:scale-[1.01] transition"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start">
                          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                            Takwim Persekolahan
                          </span>
                          <span className="text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-semibold">
                            {activeAcademicWeeks.length} / 45 Minggu
                          </span>
                        </div>
                        <h3 className="text-3xl font-extrabold mt-2">Minggu {school.currentWeek}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Sesi Akademik {school.academicYear}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* School Submission Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          Status Penghantaran e-RPH Sekolah (Minggu {school.currentWeek})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Disemak oleh PK Pentadbiran atau Guru Besar yang bertugas
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveNav('admin-review')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow"
                      >
                        Buka Panel Pengesahan Penuh →
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b">
                          <tr>
                            <th className="py-3 px-4">Nama Guru</th>
                            <th className="py-3 px-4">Panitia</th>
                            <th className="py-3 px-4">Sesi Diisi</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Tindakan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {teacherSummaries.map((item) => (
                            <tr key={item.teacher.id} className="hover:bg-slate-50">
                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                {item.teacher.name} <span className="text-slate-400 font-normal">({item.teacher.chineseName})</span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">{item.teacher.panitia}</td>
                              <td className="py-3.5 px-4 font-semibold text-slate-700">
                                {item.filledCount} / {item.totalSlots} Sesi
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                    item.status === 'DISAHKAN'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.status === 'DIHANTAR'
                                      ? 'bg-blue-100 text-blue-800'
                                      : item.status === 'PEMBETULAN'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {item.status === 'DISAHKAN'
                                    ? 'Disahkan ✅'
                                    : item.status === 'DIHANTAR'
                                    ? 'Dihantar ⏳'
                                    : item.status === 'PEMBETULAN'
                                    ? 'Perlu Pembetulan ⚠️'
                                    : 'Belum Dihantar 📝'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => {
                                    setInspectTeacher(item.teacher);
                                    setActiveNav('admin-review');
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg text-slate-700 font-bold transition"
                                >
                                  Semak & Cop →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              VIEW: PENJANA e-RPH MENGIKUT HARI (Feature 1: Advance Week & Timetable Sync)
             ===================================================================== */}
          {activeNav === 'rph-builder' && (
            <div className="space-y-6">
              {/* Mode Switcher & Dynamic Week Selection Banner (Feature 1) */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setRphMode('single')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      rphMode === 'single'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ 1. Penjana RPH Mengikut Hari (Satu Sesi)
                  </button>
                  <button
                    onClick={() => setRphMode('weekly-batch')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      rphMode === 'weekly-batch'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    📦 2. Import RPH Seminggu Sekaligus (Batch Gemini)
                  </button>
                </div>

                {/* UNIFIED WEEK SELECTOR & NAVIGATOR (Item 8) */}
                <div className="flex flex-wrap items-center gap-2 bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                    <span>📅</span>
                    <span>Minggu:</span>
                  </span>

                  <button
                    type="button"
                    disabled={builderWeek <= 1}
                    onClick={() => {
                      const prev = builderWeek - 1;
                      setBuilderWeek(prev);
                      setBatchWeek(prev);
                    }}
                    className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-black disabled:opacity-40 disabled:pointer-events-none transition"
                    title="Minggu Sebelumnya"
                  >
                    ◀ M.{builderWeek - 1}
                  </button>

                  <select
                    value={builderWeek}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBuilderWeek(val);
                      setBatchWeek(val);
                    }}
                    className="text-xs font-black bg-white border border-blue-300 rounded-lg px-2.5 py-1 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {activeAcademicWeeks.map((w) => {
                      const isCur = w.weekNumber === school.currentWeek;
                      const isAdv = w.weekNumber > school.currentWeek;
                      return (
                        <option key={w.weekNumber} value={w.weekNumber}>
                          Minggu {w.weekNumber} ({w.dueDateFriday}) {isCur ? '★ [Semasa]' : isAdv ? `⏩ [+${w.weekNumber - school.currentWeek} Hadapan]` : `📁 [Arkib M.${w.weekNumber}]`}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    disabled={builderWeek >= activeAcademicWeeks.length}
                    onClick={() => {
                      const next = builderWeek + 1;
                      setBuilderWeek(next);
                      setBatchWeek(next);
                    }}
                    className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-black disabled:opacity-40 disabled:pointer-events-none transition"
                    title="Minggu Seterusnya"
                  >
                    M.{builderWeek + 1} ▶
                  </button>

                  {builderWeek !== school.currentWeek && (
                    <button
                      type="button"
                      onClick={() => {
                        setBuilderWeek(school.currentWeek);
                        setBatchWeek(school.currentWeek);
                      }}
                      className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-black transition"
                      title="Kembali ke Minggu Semasa"
                    >
                      ★ M.{school.currentWeek}
                    </button>
                  )}

                  {builderWeek === school.currentWeek ? (
                    <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                      Minggu Semasa
                    </span>
                  ) : builderWeek > school.currentWeek ? (
                    <span className="text-[10px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                      +{builderWeek - school.currentWeek} Hadapan
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-500 text-white font-extrabold px-2 py-0.5 rounded-full">
                      Arkib
                    </span>
                  )}
                </div>
              </div>

              {rphMode === 'single' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left 6 cols: Day Selection & Timetable Auto-Sync */}
                  <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-800">
                          Langkah 1: Pilih Hari & Sesi Mengajar Anda (Minggu {builderWeek})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Klik pada hari untuk melihat kelas anda. Kelas, masa, dan subjek diselaraskan secara automatik.
                        </p>
                      </div>
                      {isSelectedGradeNewSyllabus ? (
                        <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-sm">
                          ✨ Silibus 2027 (KPM)
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-1 rounded border border-slate-200">
                          📘 KSSR Semakan
                        </span>
                      )}
                    </div>

                    {/* 1. Pilih Hari */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        1. Pilih Hari Persekolahan:
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'] as const).map((d) => {
                          const countForDay = rphRecords.filter(
                            (r) =>
                              r.teacherId === currentUser.id &&
                              r.weekNumber === builderWeek &&
                              r.day === d
                          ).length;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => handleSelectDay(d)}
                              className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border transition text-center truncate relative ${
                                selectedDay === d
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/30'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div>{d}</div>
                              {countForDay > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full mt-0.5 inline-block ${
                                  selectedDay === d ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  ✓ {countForDay} RPH
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Pilih Sesi Kelas Dari Jadual Waktu Mengajar */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          2. Kelas Mengajar Anda Pada Hari {selectedDay}:
                        </label>
                        <span className="text-[11px] text-cyan-600 font-semibold">
                          {teacherDaySlots.length} Sesi Dijumpai
                        </span>
                      </div>

                      {teacherDaySlots.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                          <p>Tiada kelas mengajar berjadual pada hari <b>{selectedDay}</b>.</p>
                          <button
                            type="button"
                            onClick={handleAddNewSessionForDay}
                            className="font-bold underline text-blue-700 block"
                          >
                            + Tambah Sesi / Subjek Mengajar Baharu
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {teacherDaySlots.map((slot) => {
                            const isSelected = selectedSlotId === slot.id;
                            const slotRph = rphRecords.find(
                              (r) =>
                                r.teacherId === currentUser.id &&
                                r.weekNumber === builderWeek &&
                                r.day === selectedDay &&
                                r.slotId === slot.id
                            );
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => handleSelectDaySlot(slot)}
                                className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between text-xs ${
                                  isSelected
                                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/30 font-bold text-blue-900'
                                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{slot.className}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-600 font-medium">{slot.subjectName}</span>
                                    {slot.studentCount && (
                                      <span className="text-[10px] text-slate-500 font-semibold">({slot.studentCount} Murid)</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500">
                                    Masa: <b>{slot.timeStart} – {slot.timeEnd}</b>
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {slotRph ? (
                                    <span
                                      className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                        slotRph.status === 'DISAHKAN'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : slotRph.status === 'DIHANTAR'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      ✓ {slotRph.status}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      + Belum Jana
                                    </span>
                                  )}
                                  <span className="text-[10px] text-blue-600 font-bold ml-1">
                                    {isSelected ? '● Dipilih' : 'Pilih →'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}

                          {/* Button to add an additional / ad-hoc class session */}
                          <button
                            type="button"
                            onClick={handleAddNewSessionForDay}
                            className={`w-full p-2 rounded-xl border border-dashed transition text-center text-xs font-bold ${
                              selectedSlotId?.startsWith('custom_')
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-400/20'
                                : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600'
                            }`}
                          >
                            ➕ Tambah Sesi / Subjek Baharu Bagi Hari {selectedDay}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Auto-synced Fields & Grade Selection */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Tahun Persekolahan:</label>
                        <select
                          value={selectedGrade}
                          onChange={(e) => setSelectedGrade(e.target.value)}
                          className="w-full border rounded-lg p-2 bg-white font-bold"
                        >
                          {['1', '2', '3', '4', '5', '6'].map((g) => {
                            const calYear = Number(school.academicYear.split('/')[0]) || 2026;
                            return (
                              <option key={g} value={g}>
                                Tahun {g} {(KPM_SYLLABUS_ROLLOUT[calYear] || []).includes(g) ? '✨ [Silibus 2027]' : '📘 [KSSR]'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Nama Kelas:</label>
                        <input
                          type="text"
                          value={selectedClassName}
                          onChange={(e) => setSelectedClassName(e.target.value)}
                          className="w-full border rounded-lg p-2 bg-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Bilangan Murid:</label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={selectedStudentCount}
                          onChange={(e) => setSelectedStudentCount(Number(e.target.value))}
                          className="w-full border rounded-lg p-2 bg-white font-mono font-bold"
                          placeholder="30"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Masa Mula:</label>
                        <input
                          type="time"
                          value={selectedTimeStart}
                          onChange={(e) => setSelectedTimeStart(e.target.value)}
                          className="w-full border rounded-lg p-2 bg-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Masa Tamat:</label>
                        <input
                          type="time"
                          value={selectedTimeEnd}
                          onChange={(e) => setSelectedTimeEnd(e.target.value)}
                          className="w-full border rounded-lg p-2 bg-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Mata Pelajaran & DSKP Selection */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Mata Pelajaran KPM SJK(C):
                        </label>
                        <select
                          value={selectedSubjectSlug}
                          onChange={(e) => setSelectedSubjectSlug(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white"
                        >
                          {availableSubjects.map((s) => (
                            <option key={s.slug} value={s.slug}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* RPT Weekly Syllabus Recommendation Banner */}
                      {matchedRptInfo && (matchedRptInfo.isMatched || matchedRptInfo.theme) && (
                        <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-50/90 via-blue-50/80 to-sky-50/90 border border-indigo-200/80 shadow-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-base leading-none">🗓️</span>
                              <span className="font-black text-xs text-indigo-950">
                                RPT SJK(C) Minggu {builderWeek}
                              </span>
                              {matchedRptInfo.isMatched && (
                                <span className="text-[10px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-md">
                                  Auto-Padan DSKP
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={handleApplyRptSuggestion}
                              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black rounded-lg shadow-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
                              title={`Muat semula SK & SP mengikut RPT Minggu ${builderWeek}`}
                            >
                              <span>♻️</span>
                              <span>Muat RPT M.{builderWeek}</span>
                            </button>
                          </div>
                          {matchedRptInfo.theme && (
                            <p className="text-[11px] text-indigo-800 font-semibold line-clamp-2 leading-relaxed">
                              <span className="text-indigo-500 font-bold">Topik / Tema:</span> {matchedRptInfo.theme}
                            </p>
                          )}
                          {matchedRptInfo.remarks && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 italic">
                              <span className="font-bold text-slate-600">Catatan:</span> {matchedRptInfo.remarks}
                            </p>
                          )}
                        </div>
                      )}

                      {/* SK Dropdown */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            Standard Kandungan (SK):
                          </label>
                          {matchedRptInfo?.isMatched && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                              ⭐ Disyorkan Mengikut RPT
                            </span>
                          )}
                        </div>
                        {loadingSubject || loadingRpt ? (
                          <div className="p-3 text-xs text-slate-400 bg-slate-50 rounded-xl">Memuatkan DSKP & RPT...</div>
                        ) : (
                          <select
                            value={selectedSk}
                            onChange={(e) => {
                              const newSk = e.target.value;
                              setSelectedSk(newSk);
                              if (subjectData && subjectData[selectedGrade] && subjectData[selectedGrade][newSk]) {
                                const availableSps = subjectData[selectedGrade][newSk];
                                const targetSpCodes = matchedRptInfo?.allWeekSpCodes || [];
                                const matchedSps = findMatchingSpsForSk(availableSps, targetSpCodes);
                                setSelectedSps(matchedSps.length > 0 ? matchedSps : availableSps.slice(0, 1));
                              }
                            }}
                            className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-medium bg-white"
                          >
                            {subjectData && subjectData[selectedGrade] ? (
                              Object.keys(subjectData[selectedGrade]).map((skKey) => {
                                const isRptMatched = matchedRptInfo?.matchedSkKeys.includes(skKey);
                                return (
                                  <option key={skKey} value={skKey}>
                                    {isRptMatched ? `⭐ [RPT M.${builderWeek}] ${skKey}` : skKey}
                                  </option>
                                );
                              })
                            ) : (
                              <option value="">Tiada SK dijumpai untuk tahun ini</option>
                            )}
                          </select>
                        )}
                      </div>

                      {/* SP Multi-Select */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Standard Pembelajaran (SP):
                        </label>
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-36 overflow-y-auto space-y-1.5 text-xs">
                          {subjectData && subjectData[selectedGrade] && selectedSk && subjectData[selectedGrade][selectedSk] ? (
                            subjectData[selectedGrade][selectedSk].map((spItem) => {
                              const checked = selectedSps.includes(spItem);
                              return (
                                <label key={spItem} className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedSps([...selectedSps, spItem]);
                                      else setSelectedSps(selectedSps.filter((s) => s !== spItem));
                                    }}
                                    className="mt-0.5 rounded text-blue-600"
                                  />
                                  <span className="leading-tight text-slate-700">{spItem}</span>
                                </label>
                              );
                            })
                          ) : (
                            <p className="text-slate-400 italic">Pilih SK terlebih dahulu.</p>
                          )}
                        </div>
                      </div>

                      {/* Pedagogy Strategy */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Pendekatan Pedagogi PAK-21:
                        </label>
                        <select
                          value={pedagogy}
                          onChange={(e) => setPedagogy(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-medium bg-white"
                        >
                          <option value="PAK-21 Think-Pair-Share (思考-配对-分享)">
                            PAK-21 Think-Pair-Share (思考-配对-分享)
                          </option>
                          <option value="PAK-21 Gallery Walk (画廊漫步与同侪互评)">
                            PAK-21 Gallery Walk (画廊漫步与同侪互评)
                          </option>
                          <option value="Pembelajaran Terbeza (Differentiated Learning 分层教学)">
                            Pembelajaran Terbeza (Differentiated Learning 分层教学)
                          </option>
                          <option value="Pendekatan STEM & Inkuiri Penemuan (探究式学习)">
                            Pendekatan STEM & Inkuiri Penemuan (探究式学习)
                          </option>
                          <option value="Didik Hibur & Permainan Bahasa (趣味语文游戏教学)">
                            Didik Hibur & Permainan Bahasa (趣味语文游戏教学)
                          </option>
                        </select>
                      </div>

                      {/* Kriteria Tambahan Pilihan: KrMJ (JPNJ) & Nilai Sivik (KPM) */}
                      <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                            <span>✨</span>
                            <span>Kriteria Tambahan Prompt & RPH (Pilihan Subjek)</span>
                          </span>
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            Gemini / ChatGPT / 0-API
                          </span>
                        </div>

                        {/* Tickbox 1: KrMJ (Karakter Murid Johor) */}
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                            <input
                              type="checkbox"
                              checked={includeKrmj}
                              onChange={(e) => setIncludeKrmj(e.target.checked)}
                              className="rounded text-indigo-600 w-4 h-4"
                            />
                            <span>🏳️ Integrasi Karakter Murid Johor (KrMJ - JPNJ)</span>
                          </label>

                          {includeKrmj && (
                            <div className="pl-6 space-y-1.5 pt-1 border-t border-slate-100">
                              <label className="block text-[11px] font-bold text-slate-600">
                                Pilih Dimensi KrMJ:
                              </label>
                              <select
                                value={selectedKrmjId}
                                onChange={(e) => setSelectedKrmjId(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg p-1.5 text-xs font-semibold bg-slate-50"
                              >
                                {KRMJ_DIMENSIONS.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    [{d.id}] {d.nama_dimensi}
                                  </option>
                                ))}
                              </select>
                              <p className="text-[10px] text-indigo-700 bg-indigo-50 p-1.5 rounded font-medium">
                                <b>Catatan RPH:</b> {getKrmjById(selectedKrmjId).contoh_catatan_rph}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Tickbox 2: Nilai Sivik KPM */}
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                            <input
                              type="checkbox"
                              checked={includeSivik}
                              onChange={(e) => setIncludeSivik(e.target.checked)}
                              className="rounded text-indigo-600 w-4 h-4"
                            />
                            <span>🇲🇾 Integrasi Pendidikan Sivik KPM (BM / BI / Sejarah / Moral / BC)</span>
                          </label>

                          {includeSivik && (
                            <div className="pl-6 space-y-2 pt-1 border-t border-slate-100">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                                    Nilai Teras Sivik:
                                  </label>
                                  <select
                                    value={selectedSivikCoreId}
                                    onChange={(e) => {
                                      const newCore = e.target.value;
                                      setSelectedSivikCoreId(newCore);
                                      const foundCore = NILAI_SIVIK_KPM.find((c) => c.id === newCore);
                                      if (foundCore && foundCore.sub_nilai.length > 0) {
                                        setSelectedSivikSubId(foundCore.sub_nilai[0].id);
                                      }
                                    }}
                                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs font-semibold bg-slate-50"
                                  >
                                    {NILAI_SIVIK_KPM.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        [{c.id}] {c.nilai_teras}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                                    Tajuk Sub-Nilai:
                                  </label>
                                  <select
                                    value={selectedSivikSubId}
                                    onChange={(e) => setSelectedSivikSubId(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs font-semibold bg-slate-50"
                                  >
                                    {(
                                      NILAI_SIVIK_KPM.find((c) => c.id === selectedSivikCoreId)?.sub_nilai || []
                                    ).map((sub) => (
                                      <option key={sub.id} value={sub.id}>
                                        {sub.tajuk}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <p className="text-[10px] text-emerald-800 bg-emerald-50 p-1.5 rounded font-medium">
                                <b>Fokus Sivik:</b>{' '}
                                {getSivikById(selectedSivikCoreId, selectedSivikSubId).sub.fokus.join(' • ')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: 0-API & Gemini Prompt */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleGenerate0Api}
                          className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
                        >
                          ⚡ Jana RPH Serta-Merta (0-API)
                        </button>
                        <button
                          type="button"
                          onClick={handleCopySinglePrompt}
                          className="px-4 py-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition"
                        >
                          📋 Salin Prompt Gemini
                        </button>
                      </div>

                      {/* Paste Gemini Box */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                          Atau Tampal Jawapan Dari Gemini Web:
                        </label>
                        <textarea
                          rows={3}
                          value={pastedGeminiText}
                          onChange={(e) => setPastedGeminiText(e.target.value)}
                          placeholder="Salin jawapan penuh dari Gemini Web dan tampal di sini..."
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-mono bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={handleParsePastedSingle}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition"
                        >
                          Tampal & Proses Respons Gemini →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right 6 cols: Merged Draf & e-RPH Pengajaran Saya */}
                  <div className="lg:col-span-6 space-y-4">
                    {/* Header Panel with Mode Switch & Counts */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📚</span>
                          <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">
                            Draf & Rekod e-RPH Saya
                          </h4>
                          <span className="bg-blue-100 text-blue-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                            Minggu {builderWeek}
                          </span>
                        </div>

                        {/* Toggle Tab: Hari Ini vs Seluruh Minggu */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setBuilderRightTab('DAY')}
                            className={`px-3 py-1 rounded-lg transition ${
                              builderRightTab === 'DAY'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Hari {selectedDay} ({myRphsForSelectedDay.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBuilderRightTab('WEEK')}
                            className={`px-3 py-1 rounded-lg transition ${
                              builderRightTab === 'WEEK'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Semua Hari ({myRphsForSelectedWeek.length})
                          </button>
                        </div>
                      </div>

                      {/* Archive Year Switcher & Full-Year PDF Download Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-700 text-[11px]">📂 Sesi / Arkib:</span>
                          <select
                            value={selectedArchiveYear}
                            onChange={(e) => handleSelectArchiveYear(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-extrabold text-slate-800"
                          >
                            <option value="SEMASA">🟢 Sesi Semasa ({school.academicYear})</option>
                            <option value="2025/2026">📦 Arkib 2025/2026 (Google Sheets)</option>
                            <option value="2024/2025">📦 Arkib 2024/2025 (Google Sheets)</option>
                            {selectedArchiveYear !== 'SEMASA' && selectedArchiveYear !== '2025/2026' && selectedArchiveYear !== '2024/2025' && (
                              <option value={selectedArchiveYear}>{selectedArchiveYear}</option>
                            )}
                          </select>

                          <button
                            type="button"
                            onClick={handleTriggerArchiveImport}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] rounded-lg shadow-xs transition flex items-center gap-1"
                            title="Import fail arkib JSON tahun lepas untuk paparan dan semakan segera"
                          >
                            <span>📂</span>
                            <span>Import Fail Arkib (.JSON)</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadFullYearPdf(selectedArchiveYear)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg shadow-xs transition flex items-center gap-1"
                          title="Muat turun atau cetak seluruh tahun e-RPH sebagai Buku PDF"
                        >
                          <span>🖨️</span>
                          <span>PDF e-RPH Setahun Penuh</span>
                        </button>
                      </div>

                      {/* Batch Submit Notification / Action */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 font-medium text-[11px]">
                          {selectedArchiveYear !== 'SEMASA'
                            ? `Memaparkan ${archivedRecords.length} rekod arkib tahun lepas (${selectedArchiveYear}) — Klik "Guna Semula" untuk salin ke minggu semasa.`
                            : builderRightTab === 'DAY'
                            ? `Memaparkan ${myRphsForSelectedDay.length} sesi e-RPH bagi hari ${selectedDay}.`
                            : `Memaparkan ${myRphsForSelectedWeek.length} sesi e-RPH bagi seluruh Minggu ${builderWeek}.`}
                        </span>
                        {selectedArchiveYear === 'SEMASA' && unsubmittedCountForWeek > 0 && (
                          <button
                            type="button"
                            onClick={handleBatchSubmitWeekDrafts}
                            className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-[11px] rounded-lg shadow-sm transition flex items-center gap-1"
                            title="Hantar semua draf minggu ini kepada Pentadbir"
                          >
                            <span>🚀</span>
                            <span>Hantar Semua ({unsubmittedCountForWeek} Draf Belum Hantar)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Active RPH Preview / Editor Table (if previewRph is selected or generated) */}
                    {previewRph && (
                      <div className="bg-white rounded-2xl border-2 border-blue-400 shadow-md p-5 space-y-4 animate-fade-in relative">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg text-xs">
                              {previewRph.day} • {previewRph.timeStart} – {previewRph.timeEnd}
                            </span>
                            <span className="font-extrabold text-slate-900 text-xs">
                              {previewRph.className} • {previewRph.subjectName}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              ({previewRph.studentCount || 30} Murid)
                            </span>
                            <span
                              className={`border px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                previewRph.status === 'DISAHKAN'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : previewRph.status === 'DIHANTAR'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : previewRph.status === 'PEMBETULAN'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-300'
                              }`}
                            >
                              Status: {previewRph.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setIsEditingRph(!isEditingRph)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                                isEditingRph
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {isEditingRph ? '✓ Selesai' : '✏️ Edit'}
                            </button>
                            <button
                              onClick={() => exportSingleRphToDocx(previewRph, school.name)}
                              className="px-2 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-100"
                            >
                              ⬇ .DOCX
                            </button>
                            <button
                              onClick={() => openPrintableRphWindow(previewRph, school.name, currentUser.name)}
                              className="px-2 py-1 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200"
                            >
                              🖨️ Cetak
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewRph(null)}
                              className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg transition"
                              title="Tutup Pratonton"
                            >
                              ✖
                            </button>
                          </div>
                        </div>

                        {/* Official KPM Form Table - Word Document Style (Auto-scaling, Seamless In-Cell Editing) */}
                        {(() => {
                          const isJawiRph = isJawiOrArabicSubject(previewRph.subjectName);
                          const rtlClass = isJawiRph ? "text-right font-serif" : "text-left";
                          const rtlDir = isJawiRph ? "rtl" : "ltr";
                          return (
                            <div className="border border-slate-300 rounded-xl overflow-x-auto text-xs bg-white shadow-xs">
                              {isJawiRph && (
                                <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-emerald-800 text-[11px] font-bold flex items-center justify-between">
                                  <span>🕌 Mod Pendidikan Islam (PAI) / Tulisan Jawi (RTL)</span>
                                  <span className="text-[10px] bg-emerald-200/60 px-2 py-0.5 rounded-full">Tulisan Kanan ke Kiri</span>
                                </div>
                              )}
                              <table className="w-full border-collapse">
                                <tbody>
                                  <tr className="border-b border-slate-200">
                                    <td className="w-1/4 bg-slate-50 font-bold p-3 border-r border-slate-300 align-top text-slate-800">
                                      Standard Kandungan (SK)
                                    </td>
                                    <td className={`p-3 text-slate-800 leading-relaxed ${rtlClass}`} dir={rtlDir}>
                                      {isEditingRph ? (
                                        <textarea
                                          rows={2}
                                          dir={rtlDir}
                                          value={editBuffer.sk}
                                          onChange={(e) => {
                                            setEditBuffer({ ...editBuffer, sk: e.target.value });
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          onInput={(e: any) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          placeholder="Standard Kandungan..."
                                          className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                        />
                                      ) : (
                                        previewRph.sk
                                      )}
                                    </td>
                                  </tr>
                                  <tr className="border-b border-slate-200">
                                    <td className="bg-slate-50 font-bold p-3 border-r border-slate-300 align-top text-slate-800">
                                      Standard Pembelajaran (SP)
                                    </td>
                                    <td className={`p-3 text-slate-800 leading-relaxed ${rtlClass}`} dir={rtlDir}>
                                      {isEditingRph ? (
                                        <textarea
                                          rows={Math.max(editBuffer.sps.split("\n").length + 1, 3)}
                                          dir={rtlDir}
                                          value={editBuffer.sps}
                                          onChange={(e) => {
                                            setEditBuffer({ ...editBuffer, sps: e.target.value });
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          onInput={(e: any) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          placeholder="Setiap baris satu Standard Pembelajaran (SP)..."
                                          className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                        />
                                      ) : (
                                        <ul className={`list-disc ${isJawiRph ? "pr-4" : "pl-4"} space-y-1`}>
                                          {previewRph.sps.map((sp, idx) => (
                                            <li key={idx}>{sp}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </td>
                                  </tr>
                                  <tr className="border-b border-slate-200">
                                    <td className="bg-slate-50 font-bold p-3 border-r border-slate-300 align-top text-slate-800">
                                      Objektif Pembelajaran
                                    </td>
                                    <td className={`p-3 text-slate-800 leading-relaxed ${rtlClass}`} dir={rtlDir}>
                                      {isEditingRph ? (
                                        <textarea
                                          rows={Math.max(editBuffer.objectives.split("\n").length + 1, 4)}
                                          dir={rtlDir}
                                          value={editBuffer.objectives}
                                          onChange={(e) => {
                                            setEditBuffer({ ...editBuffer, objectives: e.target.value });
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          onInput={(e: any) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          placeholder="Setiap baris satu Objektif Pembelajaran..."
                                          className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                        />
                                      ) : (
                                        <ul className={`list-disc ${isJawiRph ? "pr-4" : "pl-4"} space-y-1`}>
                                          {previewRph.objectives.map((obj, idx) => (
                                            <li key={idx}>{obj}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </td>
                                  </tr>
                                  <tr className="border-b border-slate-200">
                                    <td className="bg-slate-50 font-bold p-3 border-r border-slate-300 align-top text-slate-800">
                                      Kriteria Kejayaan
                                    </td>
                                    <td className={`p-3 text-slate-800 leading-relaxed ${rtlClass}`} dir={rtlDir}>
                                      {isEditingRph ? (
                                        <textarea
                                          rows={Math.max(editBuffer.criteria.split("\n").length + 1, 4)}
                                          dir={rtlDir}
                                          value={editBuffer.criteria}
                                          onChange={(e) => {
                                            setEditBuffer({ ...editBuffer, criteria: e.target.value });
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          onInput={(e: any) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          placeholder="Setiap baris satu Kriteria Kejayaan (Aras Rendah, Sederhana, Tinggi)..."
                                          className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                        />
                                      ) : (
                                        <ul className={`list-disc ${isJawiRph ? "pr-4" : "pl-4"} space-y-1`}>
                                          {previewRph.criteria.map((crit, idx) => (
                                            <li key={idx}>{crit}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </td>
                                  </tr>
                                  <tr className="border-b border-slate-200">
                                    <td className="bg-slate-50 font-bold p-3 border-r border-slate-300 align-top text-slate-800">
                                      Aktiviti Pembelajaran (PdP)
                                    </td>
                                    <td className={`p-3 text-slate-800 space-y-3 leading-relaxed ${rtlClass}`} dir={rtlDir}>
                                      <div>
                                        <span className="font-extrabold text-slate-900 block mb-1">Set Induksi:</span>
                                        {isEditingRph ? (
                                          <textarea
                                            rows={2}
                                            dir={rtlDir}
                                            value={editBuffer.induction}
                                            onChange={(e) => {
                                              setEditBuffer({ ...editBuffer, induction: e.target.value });
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                            onInput={(e: any) => {
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                            placeholder="Penerangan aktiviti Set Induksi..."
                                            className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                          />
                                        ) : (
                                          <p className="mt-0.5 text-slate-800">{previewRph.induction}</p>
                                        )}
                                      </div>

                                      <div>
                                        <span className="font-extrabold text-slate-900 block mb-1">Langkah / Aktiviti Utama:</span>
                                        {isEditingRph ? (
                                          <textarea
                                            rows={Math.max(editBuffer.activities.split("\n").length + 2, 6)}
                                            dir={rtlDir}
                                            value={editBuffer.activities}
                                            onChange={(e) => {
                                              setEditBuffer({ ...editBuffer, activities: e.target.value });
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                            onInput={(e: any) => {
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                            placeholder="Setiap baris satu Langkah Aktiviti Utama PdP (PAK-21)..."
                                            className={`w-full p-2.5 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                          />
                                        ) : (
                                          <ol className={`list-decimal ${isJawiRph ? "pr-4" : "pl-4"} mt-0.5 space-y-1.5`}>
                                            {previewRph.activities.map((act, idx) => (
                                              <li key={idx} className="text-slate-800 leading-relaxed">{act}</li>
                                            ))}
                                          </ol>
                                        )}
                                      </div>

                                      <div>
                                        <span className="font-extrabold text-slate-900 block mb-1">Penutup:</span>
                                        {isEditingRph ? (
                                          <textarea
                                            rows={2}
                                            dir={rtlDir}
                                            value={editBuffer.closure}
                                            onChange={(e) => {
                                              setEditBuffer({ ...editBuffer, closure: e.target.value });
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                            onInput={(e: any) => {
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                            placeholder="Penerangan aktiviti Penutup..."
                                            className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                          />
                                        ) : (
                                          <p className="mt-0.5 text-slate-800">{previewRph.closure}</p>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  <tr className="border-b border-slate-200">
                                    <td className="bg-slate-50 font-bold p-3 border-r border-slate-300 align-top text-slate-800">
                                      EMK & BBM
                                    </td>
                                    <td className={`p-3 text-slate-800 space-y-2 leading-relaxed ${rtlClass}`} dir={rtlDir}>
                                      {isEditingRph ? (
                                        <>
                                          <div>
                                            <span className="font-bold text-slate-800">EMK:</span>
                                            <textarea
                                              rows={2}
                                              dir={rtlDir}
                                              value={editBuffer.emk}
                                              onChange={(e) => setEditBuffer({ ...editBuffer, emk: e.target.value })}
                                              className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1 resize-y ${rtlClass}`}
                                            />
                                          </div>
                                          <div>
                                            <span className="font-bold text-slate-800">BBM:</span>
                                            <textarea
                                              rows={2}
                                              dir={rtlDir}
                                              value={editBuffer.bbm}
                                              onChange={(e) => setEditBuffer({ ...editBuffer, bbm: e.target.value })}
                                              className={`w-full p-2 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1 resize-y ${rtlClass}`}
                                            />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div><b>EMK:</b> {previewRph.emk.join(", ")}</div>
                                          <div><b>BBM:</b> {previewRph.bbm.join(", ")}</div>
                                        </>
                                      )}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="bg-slate-50 font-bold p-3 border-r border-slate-300 align-top text-slate-800">
                                      Refleksi Guru
                                    </td>
                                    <td className={`p-3 text-slate-800 leading-relaxed ${rtlClass}`} dir={rtlDir}>
                                      {isEditingRph ? (
                                        <textarea
                                          rows={3}
                                          dir={rtlDir}
                                          value={editBuffer.reflection}
                                          onChange={(e) => {
                                            setEditBuffer({ ...editBuffer, reflection: e.target.value });
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          onInput={(e: any) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          placeholder="Catatan refleksi pengajaran murid..."
                                          className={`w-full p-2.5 border border-blue-300 rounded-lg text-xs bg-blue-50/20 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y ${rtlClass}`}
                                        />
                                      ) : (
                                        previewRph.reflection
                                      )}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                        {/* Save Actions (Supports Re-editing DISAHKAN RPH without losing verified status) */}
                        <div className="space-y-2 pt-1">
                          {previewRph.status === 'DISAHKAN' && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-[11px] text-emerald-900 flex items-center justify-between gap-2">
                              <span>
                                <b>✓ Rekod Telah Disahkan:</b> Anda boleh menyunting atau menambah nilai KrMJ/Sivik/aktiviti dan simpan tanpa menukar status pengesahan Pentadbir.
                              </span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {previewRph.status === 'DISAHKAN' ? (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleToWeekly(false, true)}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition"
                              >
                                ✅ Simpan Kemaskini (Kekal Status DISAHKAN)
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleToWeekly(false, false)}
                                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition"
                                >
                                  💾 Simpan Sebagai Draf
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleToWeekly(true, false)}
                                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition"
                                >
                                  🚀 Simpan & Hantar ke Pentadbir
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Past Year Archive Banner & List (When viewing archived year) */}
                    {selectedArchiveYear !== 'SEMASA' && (
                      <div className="bg-amber-50/70 rounded-2xl border-2 border-amber-300 shadow-sm p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2">
                          <div>
                            <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full">
                              Arkib e-RPH Tahun Lepas ({selectedArchiveYear})
                            </span>
                            <h5 className="text-xs font-extrabold text-slate-900 mt-1">
                              Rekod Pengajaran Terdahulu ({currentUser.name})
                            </h5>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleTriggerArchiveImport}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold text-xs rounded-lg flex items-center gap-1"
                            >
                              <span>📂</span>
                              <span>Import Fail Arkib (.JSON)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedArchiveYear('SEMASA')}
                              className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-lg"
                            >
                              ← Kembali ke Sesi Semasa
                            </button>
                          </div>
                        </div>

                        {isLoadingArchive ? (
                          <div className="p-8 text-center text-xs text-slate-500 font-bold">
                            ⏳ Sedang memuat turun rekod arkib dari Google Sheets...
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                            {archivedRecords.map((arch) => (
                              <div
                                key={arch.id}
                                className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs space-y-2 text-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                                      M.{arch.weekNumber} • {arch.day} ({arch.date})
                                    </span>
                                    <span className="font-bold text-slate-900">{arch.className}</span>
                                    <span className="text-slate-500">• {arch.subjectName}</span>
                                  </div>
                                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    ✓ {arch.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-700">
                                  <b>SK:</b> {arch.sk}
                                </p>
                                <p className="text-[11px] text-slate-500 line-clamp-2">
                                  <b>Objektif:</b> {arch.objectives.join('; ')}
                                </p>
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => handleReuseArchivedRph(arch)}
                                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-lg shadow-xs transition flex items-center gap-1"
                                  >
                                    <span>♻️</span>
                                    <span>Guna Semula ke Minggu {builderWeek}</span>
                                  </button>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openPrintableRphWindow(arch, school.name, currentUser.name)}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg"
                                    >
                                      🖨️ Cetak
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => exportSingleRphToDocx(arch, school.name)}
                                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg"
                                    >
                                      ⬇ .DOCX
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scrollable List of All RPHs for Selected Day / Week */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                          {builderRightTab === 'DAY'
                            ? `Senarai e-RPH Hari ${selectedDay} (${myRphsForSelectedDay.length} Sesi Terjana)`
                            : `Semua Sesi e-RPH Minggu ${builderWeek} (${myRphsForSelectedWeek.length} Sesi Terjana)`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          Tatal untuk semak & edit
                        </span>
                      </div>

                      {(builderRightTab === 'DAY' ? myRphsForSelectedDay : myRphsForSelectedWeek).length === 0 ? (
                        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400 space-y-2">
                          <div className="text-3xl">📄</div>
                          <p className="text-xs font-bold text-slate-700">
                            Tiada rekod e-RPH bagi {builderRightTab === 'DAY' ? `hari ${selectedDay}` : `Minggu ${builderWeek}`}.
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                            Pilih slot kelas di sebelah kiri dan klik <b>"Jana RPH Serta-Merta"</b> untuk membina sesi pembelajaran.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                          {(builderRightTab === 'DAY' ? myRphsForSelectedDay : myRphsForSelectedWeek).map((rph) => {
                            const isCurrentPreview = previewRph?.id === rph.id;
                            return (
                              <div
                                key={rph.id}
                                className={`p-4 rounded-xl border transition space-y-2.5 ${
                                  isCurrentPreview
                                    ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20 shadow-sm'
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-blue-700 bg-blue-100/70 text-[11px] px-2 py-0.5 rounded-md">
                                      {rph.day} • {rph.timeStart} – {rph.timeEnd}
                                    </span>
                                    <span className="font-black text-slate-900 text-xs">{rph.className}</span>
                                    <span className="text-slate-300 text-xs">•</span>
                                    <span className="font-bold text-slate-700 text-xs">{rph.subjectName}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`border px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        rph.status === 'DISAHKAN'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                          : rph.status === 'DIHANTAR'
                                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                                          : rph.status === 'PEMBETULAN'
                                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                                          : 'bg-amber-50 text-amber-700 border-amber-300'
                                      }`}
                                    >
                                      {rph.status === 'DIHANTAR'
                                        ? '🚀 DIHANTAR'
                                        : rph.status === 'DISAHKAN'
                                        ? '✓ DISAHKAN'
                                        : rph.status === 'PEMBETULAN'
                                        ? '⚠️ PEMBETULAN'
                                        : '💾 DRAF'}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-[11px] space-y-1 text-slate-600 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                                  <p>
                                    <b className="text-slate-700">SK:</b> {rph.sk}
                                  </p>
                                  <p className="line-clamp-2">
                                    <b className="text-slate-700">Objektif:</b> {rph.objectives.join('; ')}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewRph(rph);
                                        setSelectedDay(rph.day as any);
                                        setSelectedSlotId(rph.slotId);
                                        setSelectedClassName(rph.className);
                                        setSelectedGrade(rph.grade);
                                        setSelectedTimeStart(rph.timeStart);
                                        setSelectedTimeEnd(rph.timeEnd);
                                        setSelectedSubjectSlug(rph.subjectSlug);
                                        setSelectedSk(rph.sk);
                                        setSelectedSps(rph.sps);
                                        setIsEditingRph(false);
                                      }}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                                    >
                                      🔍 Pratonton Penuh
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDraftRecord(rph)}
                                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition"
                                    >
                                      ✏️ Edit
                                    </button>
                                    {(rph.status === 'DRAF' || rph.status === 'PEMBETULAN') ? (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateRphStatus(rph.id, 'DIHANTAR')}
                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition flex items-center gap-1"
                                      >
                                        <span>🚀</span>
                                        <span>Hantar</span>
                                      </button>
                                    ) : rph.status === 'DIHANTAR' ? (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateRphStatus(rph.id, 'DRAF')}
                                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-lg transition"
                                      >
                                        ↩ Tarik Balik
                                      </button>
                                    ) : null}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => exportSingleRphToDocx(rph, school.name)}
                                      className="px-2 py-1 text-emerald-700 hover:bg-emerald-50 rounded font-bold"
                                      title="Muat turun fail .DOCX"
                                    >
                                      ⬇ DOCX
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openPrintableRphWindow(rph, school.name, currentUser.name)}
                                      className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded font-bold"
                                      title="Cetak format rasmi"
                                    >
                                      🖨️ Cetak
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRph(rph.id)}
                                      className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded font-bold"
                                      title="Padam rekod ini"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* WEEKLY BATCH IMPORT MODE */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        Batch Mingguan SJK(C)
                      </span>
                      <h3 className="text-base font-extrabold text-slate-800 mt-1">
                        Jana & Import RPH Seluruh Minggu Sekaligus
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sistem membaca jadual waktu guru dan mengimport semua sesi serentak melalui Gemini Web.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                      <span className="text-slate-500 font-medium">Akaun:</span>
                      <span className="font-extrabold text-slate-800">{currentUser.name}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">Minggu {builderWeek}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={handleCopyWeeklyBatchPrompt}
                      className="py-3 px-4 bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 font-extrabold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                    >
                      <span>📋</span>
                      <span>Salin Prompt Mingguan ({activeWeeklySlots.length} Sesi Minggu {builderWeek})</span>
                    </button>
                    <button
                      onClick={handleAutoPopulateDemoWeeklyText}
                      className="py-3 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 font-extrabold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                    >
                      <span>⚡</span>
                      <span>Muat Contoh Respons AI (Ujian Cepat Tanpa API)</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Tampal Respons Gemini Di Sini:
                    </label>
                    <textarea
                      rows={8}
                      value={weeklyPasteText}
                      onChange={(e) => setWeeklyPasteText(e.target.value)}
                      placeholder="Tampal teks hasil respons Gemini Mingguan di sini..."
                      className="w-full border border-slate-300 rounded-2xl p-4 text-xs font-mono bg-slate-50"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleProcessWeeklyBatch}
                      disabled={!weeklyPasteText.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg transition"
                    >
                      🚀 Proses & Import RPH Seluruh Minggu {batchWeek} Sekarang
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              VIEW: SEMAK & SUNTING DRAF e-RPH (Feature 1: Filter by Advance Weeks & Day)
             ===================================================================== */}
          {activeNav === 'rph-drafts' && (
            <div className="space-y-6">
              {/* Header Filter Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full">
                      Buku Rekod Mengajar Digital
                    </span>
                    <h3 className="text-base font-extrabold text-slate-800 mt-1">
                      Semak & Edit Draf e-RPH ({currentUser.name})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Saring mengikut minggu dan hari untuk melihat, mengubah suai atau mencetak draf sesi pengajaran anda.
                    </p>
                  </div>

                  {/* WEEK SELECTOR DROPDOWN & BATCH SUBMIT */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                      <label className="text-xs font-bold text-slate-700">Pilih Minggu:</label>
                      <select
                        value={draftWeekFilter}
                        onChange={(e) => setDraftWeekFilter(Number(e.target.value))}
                        className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {activeAcademicWeeks.map((w) => (
                          <option key={w.weekNumber} value={w.weekNumber}>
                            Minggu {w.weekNumber} (Hantar: {w.dueDateFriday}) {w.weekNumber === school.currentWeek ? '★ [Semasa]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {unsubmittedCountForWeek > 0 && (
                      <button
                        type="button"
                        onClick={handleBatchSubmitWeekDrafts}
                        className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                        title="Hantar semua draf minggu ini kepada Pentadbir serentak"
                      >
                        <span>🚀</span>
                        <span>Hantar Semua Draf Minggu {draftWeekFilter} ({unsubmittedCountForWeek} Sesi)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Day Filter Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Saring Mengikut Hari Persekolahan:
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setDraftDayFilter('ALL')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                        draftDayFilter === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🌟 Semua Hari
                    </button>
                    {(['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'] as const).map((day) => {
                      const countForDay = rphRecords.filter(
                        (r) => r.teacherId === currentUser.id && r.weekNumber === draftWeekFilter && r.day === day
                      ).length;
                      return (
                        <button
                          key={day}
                          onClick={() => setDraftDayFilter(day)}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition flex items-center justify-between ${
                            draftDayFilter === day
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{day}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                              draftDayFilter === day ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {countForDay}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* List of Draft Records */}
              {myDraftsForWeek.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl mx-auto">
                    📝
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm">
                    Tiada Rekod Draf e-RPH Ditemui Bagi Hari {draftDayFilter === 'ALL' ? 'Ini' : draftDayFilter} (Minggu {draftWeekFilter}).
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Anda boleh menggunakan Penjana e-RPH untuk menyediakan sesi pengajaran bagi minggu ini lebih awal.
                  </p>
                  <button
                    onClick={() => {
                      setBuilderWeek(draftWeekFilter);
                      setActiveNav('rph-builder');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow"
                  >
                    Bina e-RPH untuk Minggu {draftWeekFilter} →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myDraftsForWeek.map((draft) => (
                    <div
                      key={draft.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-blue-300 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl text-xs">
                            {draft.day} • {draft.timeStart} – {draft.timeEnd}
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm">
                            {draft.className}
                          </span>
                          <span className="text-xs font-semibold text-slate-600">
                            • {draft.subjectName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`border px-3 py-1 rounded-full text-xs font-bold ${
                              draft.status === 'DISAHKAN'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : draft.status === 'DIHANTAR'
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : draft.status === 'PEMBETULAN'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}
                          >
                            Status: {draft.status}
                          </span>

                          <button
                            onClick={() => setEditingDraftRecord(draft)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                          >
                            ✏️ Edit
                          </button>

                          {(draft.status === 'DRAF' || draft.status === 'PEMBETULAN') ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateRphStatus(draft.id, 'DIHANTAR')}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1"
                              title="Hantar e-RPH ini kepada Pentadbir untuk semakan & pengesahan"
                            >
                              <span>🚀</span>
                              <span>Hantar e-RPH</span>
                            </button>
                          ) : draft.status === 'DIHANTAR' ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateRphStatus(draft.id, 'DRAF')}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition flex items-center gap-1"
                              title="Tarik balik e-RPH ke status Draf untuk disunting semula"
                            >
                              <span>↩️</span>
                              <span>Tarik Balik</span>
                            </button>
                          ) : null}
                          <button
                            onClick={() => exportSingleRphToDocx(draft, school.name)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                          >
                            ⬇ .DOCX
                          </button>
                          <button
                            onClick={() => openPrintableRphWindow(draft, school.name, currentUser.name)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition"
                          >
                            🖨️ Cetak
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRph(draft.id)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition"
                            title="Padam draf / rekod e-RPH ini secara kekal"
                          >
                            🗑️ Padam
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                          <p><span className="font-bold text-slate-700">SK:</span> {draft.sk}</p>
                          <p><span className="font-bold text-slate-700">SP:</span> {draft.sps.join('; ')}</p>
                          <p><span className="font-bold text-slate-700">Set Induksi:</span> {draft.induction}</p>
                        </div>

                        <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                          <div>
                            <span className="font-bold text-slate-700">Objektif:</span>
                            <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                              {draft.objectives.map((o, idx) => (
                                <li key={idx}>{o}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Aktiviti Utama:</span>
                            <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                              {draft.activities.slice(0, 2).map((a, idx) => (
                                <li key={idx}>{a}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              VIEW: JADUAL WAKTU MENGAJAR SAYA
             ===================================================================== */}
          {activeNav === 'my-timetable' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full">
                      Jadual Guru Persendirian
                    </span>
                    <h3 className="text-base font-extrabold text-slate-800 mt-1">
                      Jadual Waktu Mengajar ({currentUser.name})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Senarai kelas dan masa mengajar anda yang diselaraskan terus dengan Penjana e-RPH.
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                    {teacherOwnSlots.length} Sesi Seminggu
                  </span>
                </div>

                {/* Day Filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setMyTimetableDayFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      myTimetableDayFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua Hari
                  </button>
                  {(['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setMyTimetableDayFilter(d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        myTimetableDayFilter === d
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {/* Add / Edit Slot Form */}
                <form
                  onSubmit={handleSaveTeacherOwnSlot}
                  className={`border rounded-xl p-4 space-y-3 transition ${
                    editingTimetableSlotId
                      ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-300/30'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase">
                      {editingTimetableSlotId
                        ? '✏️ Edit Maklumat Jadual Mengajar'
                        : '+ Tambah Jadual Mengajar Baharu'}
                    </h4>
                    {editingTimetableSlotId && (
                      <button
                        type="button"
                        onClick={handleCancelEditTimetableSlot}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Hari</label>
                      <select
                        value={myNewDay}
                        onChange={(e) => setMyNewDay(e.target.value as any)}
                        className="w-full border rounded-lg p-2 bg-white"
                      >
                        <option value="ISNIN">ISNIN</option>
                        <option value="SELASA">SELASA</option>
                        <option value="RABU">RABU</option>
                        <option value="KHAMIS">KHAMIS</option>
                        <option value="JUMAAT">JUMAAT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Masa Mula</label>
                      <input
                        type="time"
                        value={myNewTimeStart}
                        onChange={(e) => setMyNewTimeStart(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Masa Tamat</label>
                      <input
                        type="time"
                        value={myNewTimeEnd}
                        onChange={(e) => setMyNewTimeEnd(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tahun</label>
                      <select
                        value={myNewGrade}
                        onChange={(e) => setMyNewGrade(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white font-bold"
                      >
                        {['1', '2', '3', '4', '5', '6'].map((g) => (
                          <option key={g} value={g}>
                            Tahun {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Kelas</label>
                      <input
                        type="text"
                        value={myNewClassName}
                        onChange={(e) => setMyNewClassName(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white font-bold"
                        placeholder="4 Merah"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Bil. Murid</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={myNewStudentCount}
                        onChange={(e) => setMyNewStudentCount(Number(e.target.value))}
                        className="w-full border rounded-lg p-2 bg-white font-mono"
                        placeholder="30"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 lg:col-span-6">
                      <label className="block font-bold text-slate-700 mb-1">Subjek</label>
                      <select
                        value={myNewSubjectSlug}
                        onChange={(e) => setMyNewSubjectSlug(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white font-bold"
                      >
                        {dskpMeta.map((s) => (
                          <option key={s.slug} value={s.slug}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {editingTimetableSlotId && (
                      <button
                        type="button"
                        onClick={handleCancelEditTimetableSlot}
                        className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      className={`px-4 py-2 font-bold text-xs rounded-xl shadow transition text-white ${
                        editingTimetableSlotId
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {editingTimetableSlotId
                        ? '✓ Simpan Kemaskini Jadual'
                        : '+ Simpan Jadual Mengajar'}
                    </button>
                  </div>
                </form>

                {/* Slots Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold">
                      <tr>
                        <th className="py-3 px-4">Hari</th>
                        <th className="py-3 px-4">Masa</th>
                        <th className="py-3 px-4">Kelas</th>
                        <th className="py-3 px-4">Bil. Murid</th>
                        <th className="py-3 px-4">Subjek</th>
                        <th className="py-3 px-4 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teacherOwnSlots
                        .filter((s) => myTimetableDayFilter === 'ALL' || s.day === myTimetableDayFilter)
                        .map((slot) => (
                          <tr key={slot.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">{slot.day}</td>
                            <td className="py-3 px-4 text-slate-600 font-mono">
                              {slot.timeStart} – {slot.timeEnd}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">{slot.className}</td>
                            <td className="py-3 px-4 text-slate-700 font-semibold">{slot.studentCount || 30} orang</td>
                            <td className="py-3 px-4 text-slate-700">{slot.subjectName}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditTimetableSlot(slot)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-lg transition"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlot(slot.id)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition"
                                >
                                  Padam
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW: RANCANGAN PENGAJARAN TAHUNAN (RPT) MENGAJAR SAYA
             ===================================================================== */}
          {activeNav === 'my-rpt' && (
            <div className="space-y-6">
              {/* Top Banner Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📚</span>
                      <h3 className="text-lg font-black text-slate-800">
                        Rancangan Pengajaran Tahunan (RPT) Mengajar Saya
                      </h3>
                      <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        KPM SJK(C)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Semak, sesuaikan topik, SK & SP sukatan tahunan bagi subjek mengajar anda. Sebarang perubahan akan digunakan secara automatik dalam Penjana e-RPH.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddRptSubjectModalOpen(true)}
                      className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>➕</span>
                      <span>Tambah RPT Subjek</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintFullRpt}
                      disabled={!activeRptAssignment || activeRptList.length === 0}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      title="Cetak atau simpan sebagai PDF"
                    >
                      <span>🖨️</span>
                      <span>Cetak RPT Lengkap</span>
                    </button>

                    {activeRptAssignment && customRptModifiedMap[`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`] && (
                      <button
                        type="button"
                        onClick={handleResetToDefaultRpt}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                        title="Pulihkan kepada sukatan asal KPM"
                      >
                        <span>♻️</span>
                        <span>Pulihkan Asal KPM</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Subjek Mengajar Tabs / Pills */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>Subjek Pengajaran Ditugaskan ({teacherRptAssignments.length}):</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Pilih tab subjek di bawah untuk semak & edit RPT</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {teacherRptAssignments.map((assign) => {
                      const isSelected = assign.id === (activeRptAssignment?.id || '');
                      const isCustom = customRptModifiedMap[`${assign.subjectSlug}_${assign.grade}`];
                      return (
                        <div
                          key={assign.id}
                          className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          onClick={() => setSelectedRptAssignId(assign.id)}
                        >
                          <span>📚</span>
                          <span>{assign.subjectName}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            Tahun {assign.grade}
                          </span>
                          {assign.className && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] ${
                                isSelected ? 'bg-indigo-900/40 text-blue-100' : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {assign.className}
                            </span>
                          )}
                          {isCustom && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-black ${
                                isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                              }`}
                              title="Telah disunting oleh guru"
                            >
                              KUSTOM
                            </span>
                          )}
                          {teacherRptAssignments.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTeacherRptSubject(assign.id);
                              }}
                              className={`ml-1 text-[11px] hover:text-red-500 rounded p-0.5 opacity-60 group-hover:opacity-100 transition ${
                                isSelected ? 'text-white' : 'text-slate-400'
                              }`}
                              title="Keluarkan subjek ini daripada senarai"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setIsAddRptSubjectModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-dashed border-blue-300 transition cursor-pointer"
                      title="Tambah subjek lain"
                    >
                      <span>➕</span>
                      <span>Tambah Subjek</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RPT Content Details and Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                {/* Search, Filter & Row Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Search Query */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <input
                        type="text"
                        value={rptSearchQuery}
                        onChange={(e) => setRptSearchQuery(e.target.value)}
                        placeholder="Cari topik, kod SK, SP, nilai..."
                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">🔍</span>
                      {rptSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setRptSearchQuery('')}
                          className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Filter by Week */}
                    <select
                      value={rptFilterWeek}
                      onChange={(e) => setRptFilterWeek(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                      className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white font-bold text-slate-700"
                    >
                      <option value="ALL">Semua Minggu (1 - 43)</option>
                      {Array.from(new Set(activeRptList.map((r) => r.week_number))).sort((a,b)=>a-b).map((w) => (
                        <option key={w} value={w}>
                          Minggu {w} {w === school.currentWeek ? '(Minggu Semasa)' : ''}
                        </option>
                      ))}
                    </select>

                    {/* Status Badge */}
                    {activeRptAssignment && (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                          customRptModifiedMap[`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`]
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <span>{customRptModifiedMap[`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`] ? '✏️' : '🏛️'}</span>
                        <span>
                          {customRptModifiedMap[`${activeRptAssignment.subjectSlug}_${activeRptAssignment.grade}`]
                            ? 'Telah Disesuaikan (Kustom)'
                            : 'Templat KPM Asal'}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Add New Week Row & Full Text Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFullRptText(!showFullRptText)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        showFullRptText
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                      title="Tukar antara paparan Teks Penuh DSKP atau Kod Ringkas"
                    >
                      <span>{showFullRptText ? '📖' : '🏷️'}</span>
                      <span>{showFullRptText ? 'Paparan: Teks Penuh' : 'Paparan: Kod Ringkas'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddNewRptWeek}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <span>➕</span>
                      <span>Tambah Minggu / Baris Baru</span>
                    </button>
                  </div>
                </div>

                {/* Table View */}
                {loadingActiveRpt ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <div className="animate-spin text-2xl">⏳</div>
                    <p className="text-xs font-bold">Memuatkan data RPT...</p>
                  </div>
                ) : activeRptList.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <div className="text-3xl">📄</div>
                    <p className="text-xs font-bold text-slate-700">Tiada rekod RPT bagi subjek ini.</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Klik butang "Tambah Minggu / Baris Baru" di atas untuk mula memasukkan perancangan RPT mengikut minggu persekolahan.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAddNewRptWeek}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 cursor-pointer"
                    >
                      ➕ Tambah Baris Minggu Pertama
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-700 uppercase font-black tracking-wide border-b border-slate-200 text-[11px]">
                          <th className="py-3 px-3 w-28">Minggu</th>
                          <th className="py-3 px-3 w-56">Tema & Topik</th>
                          <th className={`py-3 px-3 ${showFullRptText ? 'w-64' : 'w-40'}`}>Standard Kandungan (SK)</th>
                          <th className={`py-3 px-3 ${showFullRptText ? 'w-80' : 'w-56'}`}>Standard Pembelajaran (SP)</th>
                          <th className="py-3 px-3">Catatan / EMK / Sivik</th>
                          <th className="py-3 px-3 w-28 text-center">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activeRptList
                          .filter((r) => {
                            if (rptFilterWeek !== 'ALL' && r.week_number !== rptFilterWeek) return false;
                            if (!rptSearchQuery.trim()) return true;
                            const q = rptSearchQuery.toLowerCase();
                            const theme = (r.theme || '').toLowerCase();
                            const remarks = (r.remarks || '').toLowerCase();
                            const sk = (r.sk_codes || []).join(' ').toLowerCase();
                            const sp = (r.sp_codes || []).join(' ').toLowerCase();
                            return (
                              theme.includes(q) ||
                              remarks.includes(q) ||
                              sk.includes(q) ||
                              sp.includes(q) ||
                              String(r.week_number).includes(q)
                            );
                          })
                          .map((row, idx) => {
                            const isCurrentWeek = row.week_number === school.currentWeek;
                            const isBuilderWeek = row.week_number === builderWeek;
                            return (
                              <tr
                                key={`${row.week_number}_${idx}`}
                                className={`transition hover:bg-blue-50/50 ${
                                  isCurrentWeek
                                    ? 'bg-amber-50/50 font-medium'
                                    : isBuilderWeek
                                    ? 'bg-blue-50/30'
                                    : idx % 2 === 1
                                    ? 'bg-slate-50/60'
                                    : 'bg-white'
                                }`}
                              >
                                {/* Minggu */}
                                <td className="py-3 px-3 align-top font-bold text-slate-800">
                                  <div className="space-y-1">
                                    <span className="text-xs block font-black text-slate-900">
                                      {row.week_label || `Minggu ${row.week_number}`}
                                    </span>
                                    {isCurrentWeek && (
                                      <span className="inline-block px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black text-[9px] rounded-md">
                                        Minggu Semasa
                                      </span>
                                    )}
                                    {isBuilderWeek && !isCurrentWeek && (
                                      <span className="inline-block px-1.5 py-0.2 bg-indigo-100 text-indigo-800 font-bold text-[9px] rounded-md">
                                        Pilihan e-RPH
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Tema & Topik */}
                                <td className="py-3 px-3 align-top text-slate-800 font-semibold leading-relaxed">
                                  {row.theme || <span className="text-slate-400 italic">Tiada tema direkodkan</span>}
                                </td>

                                {/* SK Codes & Full Descriptive Text */}
                                <td className="py-3 px-3 align-top">
                                  {row.sk_codes && row.sk_codes.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {row.sk_codes.map((sc, i) => {
                                        const full = showFullRptText ? resolveFullSkText(sc, activeRptDskpTree) : sc;
                                        return (
                                          <div key={i} className="text-slate-800 font-semibold leading-relaxed">
                                            <span className="inline-block px-1.5 py-0.2 bg-blue-100 text-blue-900 font-black rounded text-[10px] mr-1.5">
                                              {sc}
                                            </span>
                                            {showFullRptText && full !== sc && (
                                              <span className="text-slate-700 text-[11px] font-medium">
                                                {full.replace(sc, '').trim()}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">-</span>
                                  )}
                                </td>

                                {/* SP Codes & Full Descriptive Text */}
                                <td className="py-3 px-3 align-top">
                                  {row.sp_codes && row.sp_codes.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {row.sp_codes.map((sp, i) => {
                                        const full = showFullRptText ? resolveFullSpText(sp, activeRptDskpTree) : sp;
                                        return (
                                          <div key={i} className="text-slate-700 leading-relaxed text-[11px]">
                                            <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-800 font-mono font-bold text-[10px] rounded border border-slate-200 mr-1.5">
                                              {sp}
                                            </span>
                                            {showFullRptText && full !== sp && (
                                              <span className="text-slate-600">
                                                {full.replace(/^([A-Za-z0-9\.\-]+)\s*/, '')}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">-</span>
                                  )}
                                </td>

                                {/* Catatan */}
                                <td className="py-3 px-3 align-top text-slate-600 text-[11px] leading-relaxed">
                                  {row.remarks || <span className="text-slate-400 italic">-</span>}
                                </td>

                                {/* Tindakan */}
                                <td className="py-3 px-3 align-top text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditRptModal(row, idx)}
                                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 transition text-[11px] cursor-pointer"
                                      title="Edit maklumat RPT minggu ini"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        requestConfirmation({
                                          title: "Padam Baris RPT",
                                          message: `Padam sukatan RPT bagi ${row.week_label || "Minggu " + row.week_number}?`,
                                          detail: "Perubahan ini akan disimpan ke dalam senarai RPT pengajaran tersuai anda.",
                                          confirmText: "Ya, Padam Baris RPT",
                                          confirmColor: "rose",
                                          onConfirm: () => handleDeleteRptRecord(idx),
                                        });
                                      }}
                                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-200 transition text-[11px] cursor-pointer"
                                      title="Padam baris ini"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Edit RPT Modal */}
              {isEditingRptModalOpen && editingRptRecord && activeRptAssignment && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
                  <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
                    {/* Modal Header */}
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-blue-600 bg-white border border-blue-200 px-2 py-0.5 rounded-full">
                          {editingRptOriginalIndex >= 0 ? 'Edit RPT Minggu' : 'Tambah Minggu Baru'}
                        </span>
                        <h3 className="text-base font-black text-slate-800 mt-1">
                          {activeRptAssignment.subjectName} (Tahun {activeRptAssignment.grade})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingRptModalOpen(false);
                          setEditingRptRecord(null);
                        }}
                        className="text-slate-400 hover:text-slate-700 p-1 text-lg leading-none cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Nombor Minggu:</label>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={editingRptRecord.week_number}
                            onChange={(e) =>
                              setEditingRptRecord({
                                ...editingRptRecord,
                                week_number: Number(e.target.value) || 1,
                                week_label: `Minggu ${e.target.value}`,
                              })
                            }
                            className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Label Minggu:</label>
                          <input
                            type="text"
                            value={editingRptRecord.week_label || ''}
                            onChange={(e) =>
                              setEditingRptRecord({
                                ...editingRptRecord,
                                week_label: e.target.value,
                              })
                            }
                            placeholder="Contoh: Minggu 24"
                            className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-semibold text-slate-800"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Tema / Topik / Unit:</label>
                        <textarea
                          rows={2}
                          value={editingRptRecord.theme || ''}
                          onChange={(e) =>
                            setEditingRptRecord({
                              ...editingRptRecord,
                              theme: e.target.value,
                            })
                          }
                          placeholder="Contoh: 单元七 早期马来王国 / Tema 3: Alam Sekitar"
                          className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 leading-relaxed font-semibold"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-slate-700 font-bold">
                            Kod Standard Kandungan (SK):
                          </label>
                          <span className="text-[10px] text-slate-400">Pisahkan dengan koma jika lebih daripada satu</span>
                        </div>
                        <input
                          type="text"
                          value={(editingRptRecord.sk_codes || []).join(', ')}
                          onChange={(e) =>
                            setEditingRptRecord({
                              ...editingRptRecord,
                              sk_codes: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Contoh: 4.1, 4.2"
                          className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono text-slate-800 font-bold"
                        />
                        {/* Quick SK helper from DSKP */}
                        {subjectData && subjectData[activeRptAssignment.grade] && (
                          <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 block">
                              ⚡ Bantuan Pantas SK dari DSKP KPM:
                            </span>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {Object.keys(subjectData[activeRptAssignment.grade]).map((skKey) => {
                                const extracted = extractSkCode(skKey) || skKey.split(' ')[0];
                                const isAdded = (editingRptRecord.sk_codes || []).includes(extracted);
                                return (
                                  <button
                                    key={skKey}
                                    type="button"
                                    onClick={() => {
                                      const cur = editingRptRecord.sk_codes || [];
                                      if (cur.includes(extracted)) {
                                        setEditingRptRecord({
                                          ...editingRptRecord,
                                          sk_codes: cur.filter((c) => c !== extracted),
                                        });
                                      } else {
                                        setEditingRptRecord({
                                          ...editingRptRecord,
                                          sk_codes: [...cur, extracted],
                                        });
                                      }
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                      isAdded
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                    title={skKey}
                                  >
                                    {isAdded ? `✓ ${extracted}` : `+ ${extracted}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-slate-700 font-bold">
                            Kod Standard Pembelajaran (SP):
                          </label>
                          <span className="text-[10px] text-slate-400">Pisahkan dengan koma jika lebih daripada satu</span>
                        </div>
                        <input
                          type="text"
                          value={(editingRptRecord.sp_codes || []).join(', ')}
                          onChange={(e) =>
                            setEditingRptRecord({
                              ...editingRptRecord,
                              sp_codes: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Contoh: 4.1.1, 4.1.2, 4.1.5"
                          className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono text-slate-800 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Catatan / Nilai Sivik / Pedagogi / EMK:
                        </label>
                        <textarea
                          rows={2}
                          value={editingRptRecord.remarks || ''}
                          onChange={(e) =>
                            setEditingRptRecord({
                              ...editingRptRecord,
                              remarks: e.target.value,
                            })
                          }
                          placeholder="Contoh: PAK-21 Think-Pair-Share, Nilai Kasih Sayang, EMK Kreativiti"
                          className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 leading-relaxed font-semibold"
                        />
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingRptModalOpen(false);
                          setEditingRptRecord(null);
                        }}
                        className="px-4 py-2 border border-slate-300 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-100 transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditedRptRecord(editingRptRecord)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>💾</span>
                        <span>Simpan & Kemaskini RPT</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add RPT Subject Modal */}
              {isAddRptSubjectModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
                  <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-blue-600 bg-white border border-blue-200 px-2 py-0.5 rounded-full">
                          Penugasan Subjek
                        </span>
                        <h3 className="text-base font-black text-slate-800 mt-1">
                          Tambah RPT Subjek Mengajar
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddRptSubjectModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 p-1 text-lg leading-none cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-5 space-y-4 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Mata Pelajaran KPM SJK(C):</label>
                        <select
                          value={newRptSubjectSlug}
                          onChange={(e) => setNewRptSubjectSlug(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-bold text-slate-800"
                        >
                          {dskpMeta.map((s) => (
                            <option key={s.slug} value={s.slug}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Tahun / Darjah:</label>
                          <select
                            value={newRptGrade}
                            onChange={(e) => setNewRptGrade(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-bold text-slate-800"
                          >
                            {['1', '2', '3', '4', '5', '6'].map((g) => (
                              <option key={g} value={g}>
                                Tahun {g}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Nama Kelas (Pilihan):</label>
                          <input
                            type="text"
                            value={newRptClassName}
                            onChange={(e) => setNewRptClassName(e.target.value)}
                            placeholder="Contoh: 4 Merah"
                            className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-semibold text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 leading-relaxed text-[11px]">
                        ℹ️ Menambah subjek ini akan memuatkan sukatan rasmi RPT KPM bagi subjek & tahun berkaitan ke dalam senarai peribadi anda, serta membolehkan anda menyunting topik & standard mingguan secara bebas.
                      </div>
                    </div>

                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setIsAddRptSubjectModalOpen(false)}
                        className="px-4 py-2 border border-slate-300 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-100 transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTeacherRptSubject}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>➕</span>
                        <span>Tambah ke Senarai RPT</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              VIEW: PUSAT SEMAKAN & COP PENTADBIR (PK Pentadbiran / Guru Besar)
             ===================================================================== */}
          {activeNav === 'admin-review' && (
            <div className="space-y-6">
              {/* SUBTAB TOGGLE: Semakan Mingguan vs Matriks Tahunan */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdminPanelSubTab('weekly')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
                    adminPanelSubTab === 'weekly'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <span>📝 Semakan Mingguan & Cop e-RPH</span>
                  {metrics.waitingReview > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {metrics.waitingReview}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAdminPanelSubTab('yearly')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
                    adminPanelSubTab === 'yearly'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <span>📊 Matriks Rekod Penghantaran Tahunan</span>
                  <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    SJKC
                  </span>
                </button>
              </div>

              {adminPanelSubTab === 'weekly' ? (
                <>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      Panel Semakan Rasmi KPM
                    </span>
                    <h3 className="text-base font-extrabold text-slate-800 mt-1">
                      Semakan, Ulasan & Cop e-RPH Guru Sekolah
                    </h3>
                    <p className="text-xs text-slate-500">
                      Disahkan oleh: <b>{currentUser.name} ({currentUser.role === 'guru_besar' ? 'Guru Besar' : 'PK Pentadbiran'})</b>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* WEEK SELECTOR IN ADMIN REVIEW (Feature 1) */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                      <label className="text-xs font-bold text-slate-700">Minggu Semakan:</label>
                      <select
                        value={adminReviewWeek}
                        onChange={(e) => setAdminReviewWeek(Number(e.target.value))}
                        className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {activeAcademicWeeks.map((w) => (
                          <option key={w.weekNumber} value={w.weekNumber}>
                            Minggu {w.weekNumber} (Tarikh Akhir: {w.dueDateFriday}) {w.weekNumber === school.currentWeek ? '★ [Semasa]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleBulkVerifyAllSubmitted}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      ⚡ Sahkan & Cop Semua Yang Dihantar
                    </button>
                  </div>
                </div>

                {/* Submissions Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold">
                      <tr>
                        <th className="py-3 px-4">Nama Guru</th>
                        <th className="py-3 px-4">Panitia</th>
                        <th className="py-3 px-4">Sesi Diisi (Minggu {adminReviewWeek})</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Disahkan Oleh</th>
                        <th className="py-3 px-4 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teacherSummaries.map((item) => (
                        <tr key={item.teacher.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {item.teacher.name} <span className="text-slate-400 font-normal">({item.teacher.chineseName})</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{item.teacher.panitia}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700">
                            {item.filledCount} / {item.totalSlots} Sesi
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                item.status === 'DISAHKAN'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'DIHANTAR'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.status === 'PEMBETULAN'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {item.records.find((r) => r.verifiedBy)?.verifiedBy || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setInspectTeacher(item.teacher)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-lg font-bold transition"
                            >
                              Periksa & Cop ✍️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inspect Teacher Modal / Drawer */}
              {inspectTeacher && (() => {
                const inspectedWeekRphs = getTeacherWeekRphs(inspectTeacher.id, adminReviewWeek);
                return (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center border-b pb-3 sticky top-0 bg-white z-10">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                              Semakan & Pengesahan Pentadbir
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {inspectedWeekRphs.length} Sesi PdP
                            </span>
                          </div>
                          <h4 className="font-extrabold text-slate-900 text-lg mt-1">
                            {inspectTeacher.name} ({inspectTeacher.chineseName})
                          </h4>
                          <p className="text-xs text-slate-500">
                            Minggu Persekolahan {adminReviewWeek} • Panitia: {inspectTeacher.panitia} • Jawatan: {inspectTeacher.jawatan || 'GAB'}
                          </p>
                        </div>
                        <button
                          onClick={() => setInspectTeacher(null)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Lesson Plans List */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                            <span>📋</span>
                            <span>Senarai Rancangan Pengajaran Harian (e-RPH) Minggu {adminReviewWeek}:</span>
                          </h5>
                          <span className="text-xs text-slate-500 font-medium">
                            Klik butang &quot;Cetak A4&quot; pada setiap sesi untuk pratonton cetakan rasmi
                          </span>
                        </div>

                        {inspectedWeekRphs.length === 0 ? (
                          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
                            <span className="text-2xl block mb-2">📭</span>
                            Tiada rekod PdP direkodkan untuk Minggu {adminReviewWeek} oleh guru ini.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {inspectedWeekRphs.map((r) =>
                              renderInspectRphCard(r, inspectTeacher.name)
                            )}
                          </div>
                        )}
                      </div>

                      {/* Admin Feedback & Actions */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <label className="block text-xs font-extrabold text-slate-800">
                          Catatan, Cadangan Penambahbaikan & Ulasan Pentadbir:
                        </label>
                        <textarea
                          rows={3}
                          value={adminFeedback}
                          onChange={(e) => setAdminFeedback(e.target.value)}
                          placeholder="Cth: Objektif PdP tercapai dengan cemerlang. Aktiviti PAK-21 teratur dan berkesan..."
                          className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
                        <button
                          type="button"
                          onClick={() => setInspectTeacher(null)}
                          className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl transition"
                        >
                          Tutup
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyRph(inspectTeacher.id, 'PEMBETULAN')}
                            className="px-4 py-2.5 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl transition shadow-sm"
                          >
                            ⚠️ Minta Pembetulan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyRph(inspectTeacher.id, 'DISAHKAN')}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                          >
                            <span>✅</span>
                            <span>Sahkan & Cop Rasmi e-RPH</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
                </>
              ) : (
                renderYearlyMatrix()
              )}
            </div>
          )}

          {/* =====================================================================
              VIEW: REKOD PENGHANTARAN E-RPH TAHUNAN (STANDALONE TAB)
             ===================================================================== */}
          {activeNav === 'yearly-matrix' && (
            <div className="space-y-6">
              {/* Top Subtab switcher */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setAdminPanelSubTab('weekly');
                    setActiveNav('admin-review');
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition flex items-center gap-2"
                >
                  <span>📝 Semakan Mingguan & Cop e-RPH</span>
                  {metrics.waitingReview > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {metrics.waitingReview}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 text-white shadow-md flex items-center gap-2"
                >
                  <span>📊 Matriks Rekod Penghantaran Tahunan</span>
                  <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    SJKC
                  </span>
                </button>
              </div>

              {renderYearlyMatrix()}
            </div>
          )}

          {/* =====================================================================
              VIEW: TAKWIM & PENGURUSAN MINGGUAN (Feature 2: Weeks 1 - 45)
             ===================================================================== */}
          {activeNav === 'settings' && (
            <div className="space-y-6">
              {/* Takwim Sub-Tabs */}
              <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => setTakwimTab('mingguan')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    takwimTab === 'mingguan'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📅 1. Pengurusan Takwim Minggu Persekolahan
                </button>
                <button
                  onClick={() => setTakwimTab('profil')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    takwimTab === 'profil'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  🏫 2. Profil Sekolah & Kalendar Akademik
                </button>
              </div>

              {takwimTab === 'mingguan' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                        Takwim Sesi Persekolahan KPM
                      </span>
                      <h3 className="text-base font-extrabold text-slate-800 mt-1">
                        Pengurusan Tarikh Akhir Jumaat & Ketersediaan Minggu Persekolahan
                      </h3>
                      <p className="text-xs text-slate-500 max-w-2xl">
                        Senarai takwim minggu persekolahan standard (42 minggu) berserta kebolehan menambah minggu baharu jika diperlukan. Tarikh akhir rasmi penghantaran e-RPH adalah pada setiap hari Jumaat.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        ref={takwimFileInputRef}
                        onChange={handleTakwimFileUpload}
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={isExtractingTakwim}
                        onClick={() => takwimFileInputRef.current?.click()}
                        className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
                        title="Muat naik fail Takwim KPM (PDF atau JPEG/PNG) untuk ekstrak minggu 1-44"
                      >
                        <span>{isExtractingTakwim ? '⏳' : '📄'}</span>
                        <span>{isExtractingTakwim ? 'Sedang Mengekstrak Takwim...' : 'Ekstrak Takwim KPM (PDF/JPEG)'}</span>
                      </button>
                      <button
                        onClick={handleAddAcademicWeek}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                      >
                        <span>➕</span>
                        <span>Tambah Minggu Baharu (Minggu {academicWeeks.length + 1})</span>
                      </button>
                      {academicWeeks.length > 42 && (
                        <button
                          onClick={() => handleDeleteAcademicWeek(academicWeeks.length)}
                          className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 font-bold text-xs rounded-xl transition"
                          title="Padam minggu tambahan terakhir"
                        >
                          🗑️ Padam Minggu {academicWeeks.length}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Jumlah Minggu Aktif:</span>
                      <span className="bg-blue-600 text-white font-extrabold px-2.5 py-0.5 rounded-full">
                        {activeAcademicWeeks.length} Minggu Tersedia
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-600 font-medium">
                        Minggu Disembunyikan (Tiada tarikh Jumaat): {academicWeeks.length - activeAcademicWeeks.length} Minggu
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Minggu Semasa Sekolah:</span>
                      <span className="font-extrabold text-blue-700 bg-white border border-blue-300 px-3 py-1 rounded-lg">
                        Minggu {school.currentWeek}
                      </span>
                    </div>
                  </div>

                  {/* Weeks Table with Extra Bottom Padding for Native Datepicker */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[620px] overflow-y-auto pb-48">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 uppercase font-bold z-10">
                        <tr>
                          <th className="py-3 px-4">Minggu</th>
                          <th className="py-3 px-4">Tarikh Mula (Isnin)</th>
                          <th className="py-3 px-4">Tarikh Akhir / Hantar (Jumaat)</th>
                          <th className="py-3 px-4">Status Paparan</th>
                          <th className="py-3 px-4">Tema / Catatan Takwim</th>
                          <th className="py-3 px-4 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {academicWeeks.map((week) => {
                          const isActive = !!week.dueDateFriday && week.dueDateFriday.trim() !== '';
                          const isCurrent = week.weekNumber === school.currentWeek;
                          return (
                            <tr
                              key={week.weekNumber}
                              className={`hover:bg-slate-50 ${isCurrent ? 'bg-blue-50/50 font-semibold' : ''}`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">Minggu {week.weekNumber}</span>
                                  {isCurrent && (
                                    <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                      SEMASA
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 font-mono text-slate-600">{week.startDate}</td>

                              <td className="py-3 px-4">
                                <div className="flex flex-col gap-1.5 min-w-[210px]">
                                  <input
                                    type="date"
                                    value={week.dueDateFriday}
                                    onChange={(e) => handleUpdateWeekDueDate(week.weekNumber, e.target.value)}
                                    placeholder="Tetapkan tarikh Jumaat..."
                                    className={`border rounded-lg px-2.5 py-1 text-xs font-mono font-bold w-full max-w-[160px] ${
                                      isActive
                                        ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 shadow-2xs'
                                        : 'border-slate-300 bg-white text-slate-400'
                                    }`}
                                  />
                                  {isActive && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {(() => {
                                        const dayName = getMalaysianDayName(week.dueDateFriday);
                                        const isFriday = dayName === 'Jumaat';
                                        const snappedFri = getFridayForDate(week.dueDateFriday);
                                        if (isFriday) {
                                          return (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                              ✓ Jumaat (Sah KPM)
                                            </span>
                                          );
                                        }
                                        return (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                                              ⚠️ Hari {dayName} (Bukan Jumaat)
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleUpdateWeekDueDate(week.weekNumber, week.dueDateFriday, true)
                                              }
                                              className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition shadow-2xs"
                                              title={`Anjak automatik ke hari Jumaat terdekat (${snappedFri})`}
                                            >
                                              🎯 Anjak ke Jumaat ({snappedFri})
                                            </button>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                {isActive ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                    ✓ Aktif untuk Guru
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 text-[11px] font-medium px-2 py-0.5 rounded-full">
                                    ⚪ Disembunyikan
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={week.theme || ''}
                                  onChange={(e) => handleUpdateWeekTheme(week.weekNumber, e.target.value)}
                                  placeholder="Cth: Minggu Transisi / Ujian..."
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs bg-transparent"
                                />
                              </td>

                              <td className="py-3 px-4 text-right space-x-2">
                                {!isCurrent && isActive && (
                                  <button
                                    onClick={() => handleSetCurrentWeek(week.weekNumber)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white rounded text-[11px] font-bold text-slate-700 transition"
                                  >
                                    Set Semasa
                                  </button>
                                )}
                                {isActive ? (
                                  <button
                                    onClick={() => handleUpdateWeekDueDate(week.weekNumber, '')}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-bold transition"
                                    title="Kosongkan tarikh untuk menyembunyikan minggu ini dari guru"
                                  >
                                    Padam Tarikh
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      const startMonday = new Date(2026, 0, 5);
                                      const mon = new Date(startMonday.getTime() + (week.weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
                                      const fri = new Date(mon.getTime() + 4 * 24 * 60 * 60 * 1000);
                                      handleUpdateWeekDueDate(week.weekNumber, fri.toISOString().split('T')[0]);
                                    }}
                                    className="px-2 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-[11px] font-bold transition shadow-sm"
                                  >
                                    + Aktifkan
                                  </button>
                                )}
                                {week.weekNumber > 42 && (
                                  <button
                                    onClick={() => handleDeleteAcademicWeek(week.weekNumber)}
                                    className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[11px] font-bold transition"
                                    title="Padam minggu tambahan ini dari takwim"
                                  >
                                    🗑️ Padam
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Profil Sekolah & Kalendar */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                  <div className="border-b pb-3">
                    <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                      Penyelenggaraan Guru ICT
                    </span>
                    <h3 className="text-base font-extrabold text-slate-800 mt-1">
                      Maklumat Sekolah & Sesi Akademik
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Kod Sekolah KPM</label>
                      <input
                        type="text"
                        value={school.code}
                        onChange={(e) => setSchool({ ...school, code: e.target.value })}
                        className="w-full border rounded-lg p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Sesi Akademik (Tahun)</label>
                      <input
                        type="text"
                        value={school.academicYear}
                        onChange={(e) => setSchool({ ...school, academicYear: e.target.value })}
                        className="w-full border rounded-lg p-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Minggu Akademik Semasa</label>
                      <input
                        type="number"
                        value={school.currentWeek}
                        onChange={(e) => handleSetCurrentWeek(Number(e.target.value) || 1)}
                        className="w-full border rounded-lg p-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Kumpulan Cuti Sekolah</label>
                      <select
                        value={school.groupType}
                        onChange={(e) => setSchool({ ...school, groupType: e.target.value as any })}
                        className="w-full border rounded-lg p-2 font-semibold"
                      >
                        <option value="KUMPULAN_A">Kumpulan A (Ahad - Khamis)</option>
                        <option value="KUMPULAN_B">Kumpulan B (Isnin - Jumaat)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Nama Sekolah (Rumi)</label>
                      <input
                        type="text"
                        value={school.name}
                        onChange={(e) => setSchool({ ...school, name: e.target.value })}
                        className="w-full border rounded-lg p-2 font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Nama Sekolah (Bahasa Cina)</label>
                      <input
                        type="text"
                        value={school.chineseName}
                        onChange={(e) => setSchool({ ...school, chineseName: e.target.value })}
                        className="w-full border rounded-lg p-2 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="text-right pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.setItem("erph_school_config_v1", JSON.stringify(school));
                          localStorage.setItem("erph_academic_weeks_v1", JSON.stringify(academicWeeks));
                        } catch (_) {}
                        saveSchoolConfigToDb(school).catch((err) => console.warn("saveSchoolConfigToDb err:", err));
                        saveAcademicWeeksToDb(academicWeeks).catch((err) => console.warn("saveAcademicWeeksToDb err:", err));
                        showToast("✅ Maklumat sekolah & takwim berjaya disimpan ke pangkalan data!");
                      }}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition"
                    >
                      Simpan Perubahan Takwim & Kalendar
                    </button>
                  </div>
                </div>
              )}

              {/* ADMIN ANNUAL ARCHIVE TO GOOGLE SHEETS (GAS) & SUPABASE PURGE PANEL */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      Arkib Tahunan KPM / JPN & Optimasi Supabase
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900 mt-1">
                      📦 Arkib Akhir Tahun ke Google Sheets (GAS Web App) & Pembersihan Draf Lama
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                      Pada setiap akhir sesi persekolahan (Disember), Admin boleh mengeksport semua rekod e-RPH tahun semasa ke Google Sheets untuk simpanan audit KPM/JPN selama-lamanya, dan membersihkan draf lama bagi memastikan storan Supabase kekal ringan.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowGasCodeModal(true)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                  >
                    <span>💻</span>
                    <span>Lihat Kod Google Apps Script (Code.gs)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end text-xs">
                  <div className="lg:col-span-7 space-y-1">
                    <label className="block font-bold text-slate-700">
                      URL Endpoint Google Apps Script (GAS Web App):
                    </label>
                    <input
                      type="url"
                      value={gasWebAppUrl}
                      onChange={(e) => {
                        setGasWebAppUrl(e.target.value);
                        localStorage.setItem('erph_gas_webapp_url', e.target.value);
                      }}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec (Pilihan - Kosongkan untuk muat turun fail JSON tempatan)"
                      className="w-full border border-slate-300 rounded-xl p-2.5 font-mono text-xs bg-slate-50"
                    />
                  </div>

                  <div className="lg:col-span-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isExportingArchive}
                      onClick={handleAdminAnnualExport}
                      className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl shadow transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span>📤</span>
                      <span>
                        {isExportingArchive
                          ? 'Sedang Mengeksport...'
                          : `Export Sesi ${school.academicYear} (${rphRecords.length} Rekod)`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerArchiveImport}
                      className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded-xl transition flex items-center gap-1"
                      title="Import fail arkib JSON tahun lepas untuk paparan dan semakan segera"
                    >
                      <span>📂</span>
                      <span>Import Fail Arkib (.JSON)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenPurgeModal}
                      className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl transition flex items-center gap-1"
                      title="Padam draf lama berstatus DRAF sahaja untuk jimat ruang Supabase"
                    >
                      <span>🧹</span>
                      <span>Purge Draf Lama</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW: PENGURUSAN GURU & PERANAN (Feature 3: Edit Function & Data Retention)
             ===================================================================== */}
          {activeNav === 'roster' && (
            <div className="space-y-6">
              {/* DATA RETENTION GUARANTEE BANNER (Feature 3) */}
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h4 className="font-extrabold text-emerald-950 text-sm">
                      Pengekalan Pangkalan Data Guru Merentasi Tahun Kalendar
                    </h4>
                    <p className="text-xs text-emerald-900 mt-0.5">
                      Semua profil guru, peranan, dan kepakaran panitia dikekalkan secara utuh apabila bertukar tahun kalendar persekolahan. Pentadbir atau Guru ICT hanya perlu mengemaskini maklumat guru sedia ada tanpa perlu mendaftar semula setiap tahun.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleRenewAcademicYear}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition"
                  >
                    🔄 Perbaharui Sesi Kalendar Baharu ({school.academicYear})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      requestConfirmation({
                        title: "Reset Bersih Data Ujian",
                        message: "Adakah anda pasti untuk mengosongkan semua data mock dan memulakan pangkalan data yang bersih?",
                        detail: "Tindakan ini akan membersihkan data ujian lama. Hanya profil pentadbir anda yang akan dikekalkan.",
                        confirmText: "Ya, Mulakan Pangkalan Data Bersih",
                        confirmColor: "rose",
                        onConfirm: () => {
                          localStorage.removeItem("erph_live_teachers_v1");
                          localStorage.removeItem("erph_live_timetable_v1");
                          localStorage.removeItem("erph_live_rph_records_v1");
                          localStorage.removeItem("erph_yearly_matrix_records_v2");
                          setTimetable([]);
                          setRphRecords([]);
                          setYearlyRecords({});
                          if (currentUser) {
                            setTeachers([currentUser]);
                          } else {
                            setTeachers([]);
                          }
                          showToast("✨ Pangkalan data bersih telah dimulakan! Hanya profil pentadbir anda dikekalkan.");
                        },
                      });
                    }}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-extrabold text-xs rounded-xl shadow-xs transition"
                    title="Kosongkan sebarang data mock ujian lama"
                  >
                    🧹 Reset Bersih Data Ujian
                  </button>
                </div>
              </div>

              {/* Roster Container */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                      Pangkalan Guru Sekolah
                    </span>
                    <h3 className="text-base font-extrabold text-slate-800 mt-1">
                      Pengurusan Senarai Guru, Peranan & Panitia
                    </h3>
                    <p className="text-xs text-slate-500">
                      Klik butang <b>Edit</b> untuk mengubah suai nama, peranan, panitia, emel, atau status guru pada bila-bila masa.
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                    {teachers.length} Guru Berdaftar
                  </span>
                </div>

                {/* Add Teacher Box */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">+ Daftar Guru Baharu</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Penuh (Rumi)</label>
                      <input
                        type="text"
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        placeholder="Cth: Lim Mei Hwa"
                        className="w-full border rounded-lg p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Cina</label>
                      <input
                        type="text"
                        value={newTeacherChinese}
                        onChange={(e) => setNewTeacherChinese(e.target.value)}
                        placeholder="Cth: 林美华老师"
                        className="w-full border rounded-lg p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">E-mel DELIMa</label>
                      <input
                        type="email"
                        value={newTeacherEmail}
                        onChange={(e) => setNewTeacherEmail(e.target.value)}
                        placeholder="g-12345@moe-dl.edu.my"
                        className="w-full border rounded-lg p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Panitia</label>
                      <select
                        value={newTeacherPanitia}
                        onChange={(e) => setNewTeacherPanitia(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white"
                      >
                        <option value="Bahasa Cina">Bahasa Cina</option>
                        <option value="Bahasa Melayu">Bahasa Melayu</option>
                        <option value="Bahasa Inggeris">Bahasa Inggeris</option>
                        <option value="Matematik">Matematik</option>
                        <option value="Sains">Sains</option>
                        <option value="Pendidikan Moral">Pendidikan Moral</option>
                        <option value="Sejarah">Sejarah</option>
                        <option value="RBT">RBT / TMK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Peranan (Role)</label>
                      <select
                        value={newTeacherRole}
                        onChange={(e) => setNewTeacherRole(e.target.value as any)}
                        className="w-full border rounded-lg p-2 bg-white font-semibold"
                      >
                        <option value="guru">Guru Subjek</option>
                        <option value="pk_pentadbiran">PK Pentadbiran</option>
                        <option value="guru_besar">Guru Besar</option>
                        <option value="guru_ict_data">Guru ICT / Data</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTeacherName.trim()) return;
                        const nt: TeacherProfile = {
                          id: `t_${Date.now()}`,
                          name: newTeacherName.trim(),
                          chineseName: newTeacherChinese.trim() || '老师',
                          email: newTeacherEmail.trim() || `g-${Date.now()}@moe-dl.edu.my`,
                          panitia: newTeacherPanitia,
                          subjectSlug: 'bahasa_cina_sjkc',
                          role: newTeacherRole,
                          status: 'AKTIF',
                        };
                        setTeachers((prev) => {
                          const updated = [...prev, nt];
                          try { localStorage.setItem('erph_live_teachers_v1', JSON.stringify(updated)); } catch (_) {}
                          return updated;
                        });
                        saveTeacherToDb(nt).catch((err) => console.warn('saveTeacherToDb err:', err));
                        setNewTeacherName('');
                        setNewTeacherChinese('');
                        setNewTeacherEmail('');
                        showToast(`✅ ${nt.name} (${nt.role}) telah didaftarkan!`);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      + Simpan & Masukkan ke Roster
                    </button>
                  </div>
                </div>

                {/* Teachers Table with EDIT and DELETE buttons (Feature 3) */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold">
                      <tr>
                        <th className="py-3 px-4">Nama Guru</th>
                        <th className="py-3 px-4">Peranan</th>
                        <th className="py-3 px-4">Panitia Utama</th>
                        <th className="py-3 px-4">E-mel Rasmi</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400">
                            <p className="font-bold text-sm text-slate-600">Pangkalan data guru masih kosong.</p>
                            <p className="text-xs mt-1">Sila gunakan borang "+ DAFTAR GURU BAHARU" di atas untuk mendaftarkan guru sekolah.</p>
                          </td>
                        </tr>
                      ) : (
                        teachers.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{t.name}</span>
                            <span className="text-slate-400 ml-2">({t.chineseName})</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                t.role === 'guru_besar'
                                  ? 'bg-rose-100 text-rose-800'
                                  : t.role === 'pk_pentadbiran'
                                  ? 'bg-amber-100 text-amber-800'
                                  : t.role === 'guru_ict_data'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-cyan-100 text-cyan-800'
                              }`}
                            >
                              {t.role === 'guru_besar'
                                ? 'Guru Besar'
                                : t.role === 'pk_pentadbiran'
                                ? 'PK Pentadbiran'
                                : t.role === 'guru_ict_data'
                                ? 'Guru ICT / Data'
                                : 'Guru Subjek'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">{t.panitia}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{t.email}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === 'CUTI'
                                  ? 'bg-amber-100 text-amber-800'
                                  : t.status === 'BERPINDAH'
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {t.status === 'CUTI' ? 'Cuti Belajar/Sakit' : t.status === 'BERPINDAH' ? 'Berpindah' : 'Aktif Bertugas'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditTeacher(t)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-lg transition"
                            >
                              ✏️ Edit
                            </button>
                            {teachers.length > 1 && (
                              <button
                                onClick={() => handleDeleteTeacher(t.id)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition"
                              >
                                Padam
                              </button>
                            )}
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


        </main>
      </div>

      {/* =====================================================================
          GLOBAL MODALS
         ===================================================================== */}

      {/* 1. EDIT TEACHER PROFILE MODAL (Feature 3) */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEditTeacher}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">
                  Edit Profil & Maklumat Guru
                </h4>
                <p className="text-xs text-slate-500">
                  Data disimpan secara kekal dan tidak akan dipadam apabila tahun kalendar diperbaharui.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Penuh (Rumi)</label>
                  <input
                    type="text"
                    required
                    value={editingTeacher.name}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Bahasa Cina</label>
                  <input
                    type="text"
                    value={editingTeacher.chineseName}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, chineseName: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No KP / Pengenalan</label>
                  <input
                    type="text"
                    value={editingTeacher.icNo || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, icNo: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 font-mono"
                    placeholder="Cth: 920420135529"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jawatan Sekolah</label>
                  <select
                    value={editingTeacher.jawatan || 'GAB'}
                    onChange={(e) => {
                      const newJ = e.target.value as any;
                      let newRole = editingTeacher.role;
                      if (newJ === 'GB') newRole = 'guru_besar';
                      else if (['GPK1', 'GPK HEM', 'GPK KOKO', 'GPK KK'].includes(newJ)) newRole = 'pk_pentadbiran';
                      setEditingTeacher({ ...editingTeacher, jawatan: newJ, role: newRole });
                    }}
                    className="w-full border rounded-lg p-2 bg-slate-50 font-bold"
                  >
                    <option value="GB">GB (Guru Besar / Pengetua) - [Pentadbir]</option>
                    <option value="GPK1">GPK1 (PK Pentadbiran) - [Pentadbir]</option>
                    <option value="GPK HEM">GPK HEM - [Pentadbir]</option>
                    <option value="GPK KK">GPK KK (GPK Kokurikulum) - [Pentadbir]</option>
                    <option value="GPK KOKO">GPK KOKO - [Pentadbir]</option>
                    <option value="GAB">GAB (Guru Akademik Biasa)</option>
                    <option value="G GANTI">G GANTI (Guru Ganti)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tetapkan Kata Laluan Baharu (Pilihan / Reset Kata Laluan)
                </label>
                <input
                  type="password"
                  value={editingTeacher.password || ''}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
                  placeholder="Masukkan kata laluan baharu jika ingin menetapkan semula (cth: Cikgu2026)..."
                  className="w-full border rounded-lg p-2 bg-slate-50 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Jika dibiarkan kosong, kata laluan lalai sistem/DELIMa (delima123 atau No. Kad Pengenalan) kekal sah.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mel Rasmi DELIMa</label>
                <input
                  type="email"
                  required
                  value={editingTeacher.email}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Panitia Utama</label>
                  <select
                    value={editingTeacher.panitia}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, panitia: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  >
                    <option value="Bahasa Cina">Bahasa Cina</option>
                    <option value="Bahasa Melayu">Bahasa Melayu</option>
                    <option value="Bahasa Inggeris">Bahasa Inggeris</option>
                    <option value="Matematik">Matematik</option>
                    <option value="Sains">Sains</option>
                    <option value="Pendidikan Moral">Pendidikan Moral</option>
                    <option value="Sejarah">Sejarah</option>
                    <option value="RBT">RBT / TMK</option>
                    <option value="Pentadbiran / Kepimpinan">Pentadbiran / Kepimpinan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Peranan (Role)</label>
                  <select
                    value={editingTeacher.role}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, role: e.target.value as any })}
                    className="w-full border rounded-lg p-2 bg-slate-50 font-bold"
                  >
                    <option value="guru">Guru Subjek</option>
                    <option value="pk_pentadbiran">PK Pentadbiran</option>
                    <option value="guru_besar">Guru Besar</option>
                    <option value="guru_ict_data">Guru ICT / Data</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Perkhidmatan</label>
                <select
                  value={editingTeacher.status || 'AKTIF'}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, status: e.target.value as any })}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-bold"
                >
                  <option value="AKTIF">Aktif Bertugas</option>
                  <option value="CUTI">Cuti Bersalin / Cuti Panjang / Belajar</option>
                  <option value="BERPINDAH">Berpindah Keluar (Arkib)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="px-4 py-2 border rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow"
              >
                💾 Simpan Perubahan Profil Guru
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. EDIT DRAFT RPH MODAL */}
      {editingDraftRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">
                  Edit Kandungan e-RPH
                </h4>
                <p className="text-slate-500">
                  {editingDraftRecord.day} • {editingDraftRecord.timeStart}-{editingDraftRecord.timeEnd} • {editingDraftRecord.className} ({editingDraftRecord.subjectName})
                </p>
              </div>
              <button
                onClick={() => setEditingDraftRecord(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bilangan Murid:</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={editingDraftRecord.studentCount || 30}
                  onChange={(e) =>
                    setEditingDraftRecord({
                      ...editingDraftRecord,
                      studentCount: Number(e.target.value) || 30,
                    })
                  }
                  className="w-full border rounded-lg p-2 bg-slate-50 font-mono font-bold"
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Standard Kandungan (SK):</label>
                <input
                  type="text"
                  value={editingDraftRecord.sk}
                  onChange={(e) => setEditingDraftRecord({ ...editingDraftRecord, sk: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Standard Pembelajaran (SP):</label>
                <input
                  type="text"
                  value={editingDraftRecord.sps.join('; ')}
                  onChange={(e) =>
                    setEditingDraftRecord({
                      ...editingDraftRecord,
                      sps: e.target.value.split(';').map((x) => x.trim()),
                    })
                  }
                  className="w-full border rounded-lg p-2 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Objektif Pembelajaran:</label>
                <textarea
                  rows={3}
                  value={editingDraftRecord.objectives.join('\n')}
                  onChange={(e) =>
                    setEditingDraftRecord({
                      ...editingDraftRecord,
                      objectives: e.target.value.split('\n').filter((x) => x.trim()),
                    })
                  }
                  className="w-full border rounded-lg p-2 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Set Induksi:</label>
                <input
                  type="text"
                  value={editingDraftRecord.induction}
                  onChange={(e) => setEditingDraftRecord({ ...editingDraftRecord, induction: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Aktiviti Pembelajaran:</label>
                <textarea
                  rows={4}
                  value={editingDraftRecord.activities.join('\n')}
                  onChange={(e) =>
                    setEditingDraftRecord({
                      ...editingDraftRecord,
                      activities: e.target.value.split('\n').filter((x) => x.trim()),
                    })
                  }
                  className="w-full border rounded-lg p-2 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Refleksi:</label>
                <textarea
                  rows={2}
                  value={editingDraftRecord.reflection}
                  onChange={(e) => setEditingDraftRecord({ ...editingDraftRecord, reflection: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-medium"
                />
              </div>
            </div>



            {editingDraftRecord.status === 'DISAHKAN' && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-[11px] text-emerald-900 font-medium">
                ✓ <b>Mod Pindaan Rekod Disahkan:</b> RPH ini telah disahkan oleh{' '}
                <b>{editingDraftRecord.verifiedBy || 'Pentadbir'}</b>. Klik butang hijau di bawah untuk menyimpan pindaan <b>tanpa</b> menukar status kepada Belum Disahkan.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingDraftRecord(null)}
                className="px-4 py-2 border rounded-xl text-slate-600 font-bold hover:bg-slate-50"
              >
                Batal
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {editingDraftRecord.status === 'DISAHKAN' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const updated: RphRecord = {
                        ...editingDraftRecord,
                        status: 'DISAHKAN',
                        updatedAt: new Date().toISOString(),
                      };
                      setRphRecords((prev) =>
                        prev.map((r) => (r.id === updated.id ? updated : r))
                      );
                      if (previewRph?.id === updated.id) {
                        setPreviewRph(updated);
                      }
                      setEditingDraftRecord(null);
                      showToast('✅ Pindaan berjaya disimpan! Status DISAHKAN dikekalkan sepenuhnya.');
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1.5"
                  >
                    <span>✅</span>
                    <span>Simpan Kemaskini (Kekal Status DISAHKAN)</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const updated: RphRecord = {
                          ...editingDraftRecord,
                          status: 'DRAF',
                          updatedAt: new Date().toISOString(),
                        };
                        setRphRecords((prev) =>
                          prev.map((r) => (r.id === updated.id ? updated : r))
                        );
                        if (previewRph?.id === updated.id) setPreviewRph(updated);
                        setEditingDraftRecord(null);
                        showToast('💾 Perubahan disimpan ke dalam Draf.');
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center gap-1.5"
                    >
                      <span>💾</span>
                      <span>Simpan Sahaja (Draf)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated: RphRecord = {
                          ...editingDraftRecord,
                          status: 'DIHANTAR',
                          updatedAt: new Date().toISOString(),
                        };
                        setRphRecords((prev) =>
                          prev.map((r) => (r.id === updated.id ? updated : r))
                        );
                        if (previewRph?.id === updated.id) setPreviewRph(updated);
                        setEditingDraftRecord(null);
                        showToast(`🚀 e-RPH Minggu ${updated.weekNumber} (${updated.day}) berjaya dihantar kepada Pentadbir!`);
                      }}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <span>🚀</span>
                      <span>Simpan & Hantar ke Pentadbir</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3B. GOOGLE APPS SCRIPT (Code.gs) ARCHIVE MODAL */}
      {showGasCodeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  Integrasi Arkib Percuma Selamanya (Supabase + Google Sheets)
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Skrip Penuh Google Apps Script (Code.gs) — Menyokong doGet & doPost
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Skrip ini telah diperkemas daripada draf asal anda: menyokong penciptaan tab tahunan automatik, bacaan on-demand (doGet), dan penyimpanan pukal pantas (doPost setValues).
                </p>
              </div>
              <button
                onClick={() => setShowGasCodeModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-96">
              <pre>{PRODUCTION_GAS_SCRIPT_TEMPLATE}</pre>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(PRODUCTION_GAS_SCRIPT_TEMPLATE);
                  showToast('📋 Kod penuh Code.gs berjaya disalin ke papan keratan!');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow transition"
              >
                📋 Salin Kod Code.gs
              </button>
              <button
                type="button"
                onClick={() => setShowGasCodeModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAKWIM EXTRACTION MODAL (KPM PDF / JPEG) */}
      {showTakwimModal && takwimPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                  Pengekstrakan Takwim Rasmi KPM
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Kalendar Akademik Sesi {takwimPreview.academicYear} (Kumpulan {takwimPreview.kumpulan})
                </h3>
                <p className="text-slate-500 text-xs">
                  {takwimPreview.sourceFileName ? `Sumber Fail: ${takwimPreview.sourceFileName} • ` : ''}
                  Ekstrak sesi persekolahan dan cuti penggal/pertengahan tahun secara automatik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTakwimModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base"
              >
                ✕
              </button>
            </div>

            {/* KPI Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-blue-700">Jumlah Minggu Persekolahan</span>
                <div className="text-2xl font-black text-blue-900 mt-0.5">
                  {takwimPreview.totalSchoolWeeks} Minggu
                </div>
                <span className="text-[10px] text-blue-600 font-medium">Minggu 1 - {takwimPreview.totalSchoolWeeks}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700">Penggal 1</span>
                <div className="text-2xl font-black text-emerald-900 mt-0.5">
                  19 Minggu
                </div>
                <span className="text-[10px] text-emerald-600 font-medium">9 + 10 Minggu (Bahagian 1 & 2)</span>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-purple-700">Penggal 2</span>
                <div className="text-2xl font-black text-purple-900 mt-0.5">
                  25 Minggu
                </div>
                <span className="text-[10px] text-purple-600 font-medium">12 + 13 Minggu (Bahagian 1 & 2)</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-700">Cuti Dikecualikan</span>
                <div className="text-2xl font-black text-amber-900 mt-0.5">
                  {takwimPreview.totalHolidaysWeeks} Minggu
                </div>
                <span className="text-[10px] text-amber-700 font-medium">Tidak Dikira Minggu Persekolahan</span>
              </div>
            </div>

            {/* Holiday Exclusions Info Box */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
                <span>🌴</span>
                <span>Cuti Persekolahan Yang Dikecualikan (Bukan Minggu e-RPH):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-amber-900">
                {takwimPreview.holidayBlocks.map((h, i) => (
                  <div key={i} className="bg-white/80 border border-amber-200/80 rounded-lg p-2">
                    <span className="font-bold">{h.name}:</span> {h.startDate} hingga {h.endDate} ({h.daysCount} hari / {h.weeksCount} minggu)
                  </div>
                ))}
              </div>
            </div>

            {/* Generated Weeks Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800">
                  Senarai {takwimPreview.generatedWeeks.length} Minggu Persekolahan & Tarikh Akhir Jumaat:
                </h4>
                <span className="text-[10px] text-slate-500 font-medium">
                  Tarikh akhir rasmi e-RPH dijana setiap hari Jumaat
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3 w-16 text-center">Minggu</th>
                      <th className="py-2 px-3">Tarikh Mula (Isnin)</th>
                      <th className="py-2 px-3">Tarikh Akhir (Jumaat)</th>
                      <th className="py-2 px-3">Keterangan / Penggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {takwimPreview.generatedWeeks.map((w) => (
                      <tr key={w.weekNumber} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-bold text-blue-700">M.{w.weekNumber}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{w.startDate || '—'}</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700">{w.dueDateFriday}</td>
                        <td className="py-2 px-3 text-slate-600 text-[11px]">{w.theme}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowTakwimModal(false)}
                className="px-4 py-2 border rounded-xl text-slate-600 font-bold hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleApplyExtractedTakwim}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1.5"
              >
                <span>✅</span>
                <span>Terapkan ke Sistem Takwim Sekolah ({takwimPreview.generatedWeeks.length} Minggu)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. INSPECT & OVERRIDE MATRIX CELL MODAL (Feature: Yearly Matrix) */}
      {inspectMatrixCell && (() => {
        const cellWeeklyRphs = getTeacherWeekRphs(
          inspectMatrixCell.teacher.id,
          inspectMatrixCell.weekNumber
        );

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-5 text-xs max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center border-b pb-3 sticky top-0 bg-white z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                      Semakan Rekod Penghantaran Matriks Tahunan
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {cellWeeklyRphs.length} Sesi PdP
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-lg mt-1">
                    Minggu {inspectMatrixCell.weekNumber}: {inspectMatrixCell.teacher.name} ({inspectMatrixCell.teacher.chineseName})
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    No KP: {inspectMatrixCell.teacher.icNo || '—'} • Jawatan: {inspectMatrixCell.teacher.jawatan || 'GAB'} • Panitia: {inspectMatrixCell.teacher.panitia}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectMatrixCell(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              {/* Section 1: Lesson Plans List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <span>📋</span>
                    <span>Semakan Rancangan Pengajaran Harian (e-RPH) Minggu {inspectMatrixCell.weekNumber}:</span>
                  </h5>
                  <span className="text-xs text-slate-500 font-medium">
                    Semak butiran SK, SP, objektif, aktiviti atau klik butang &quot;Cetak A4&quot;
                  </span>
                </div>

                {cellWeeklyRphs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
                    <span className="text-2xl block mb-2">📭</span>
                    Tiada rekod PdP direkodkan untuk Minggu {inspectMatrixCell.weekNumber} oleh guru ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cellWeeklyRphs.map((r) =>
                      renderInspectRphCard(r, inspectMatrixCell.teacher.name)
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Status Override & Verification Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase text-slate-700">
                  ⚡ Kemas Kini Status Penghantaran Mingguan
                </h5>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Status Penghantaran:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditCellForm({ ...editCellForm, status: 'TEPAT' })}
                      className={`p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ${
                        editCellForm.status === 'TEPAT'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>✓ Tepat Masa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditCellForm({ ...editCellForm, status: 'LEWAT' })}
                      className={`p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ${
                        editCellForm.status === 'LEWAT'
                          ? 'bg-cyan-50 border-cyan-500 text-cyan-900 ring-2 ring-cyan-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-cyan-500 shrink-0"></span>
                      <span>✓ Lewat Hantar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditCellForm({ ...editCellForm, status: 'TIDAK_HANTAR' })}
                      className={`p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ${
                        editCellForm.status === 'TIDAK_HANTAR'
                          ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span>
                      <span>✗ Tidak Hantar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditCellForm({ ...editCellForm, status: 'CUTI' })}
                      className={`p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ${
                        editCellForm.status === 'CUTI'
                          ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                      <span>🌴 Cuti / MC</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tarikh Paparan (DD-MM):
                    </label>
                    <input
                      type="text"
                      value={editCellForm.customDate}
                      onChange={(e) => setEditCellForm({ ...editCellForm, customDate: e.target.value })}
                      placeholder="Cth: 16-01 atau 20-02"
                      className="w-full border rounded-lg p-2 font-mono text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pegawai Pengesah:
                    </label>
                    <input
                      type="text"
                      value={editCellForm.verifiedBy}
                      onChange={(e) => setEditCellForm({ ...editCellForm, verifiedBy: e.target.value })}
                      className="w-full border rounded-lg p-2 text-xs bg-white font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catatan Pentadbir (Pilihan):
                  </label>
                  <textarea
                    rows={2}
                    value={editCellForm.notes}
                    onChange={(e) => setEditCellForm({ ...editCellForm, notes: e.target.value })}
                    placeholder="Cth: Disahkan secara manual / Cuti Rehat Khas diluluskan..."
                    className="w-full border rounded-lg p-2 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setInspectMatrixCell(null)}
                  className="px-4 py-2 border rounded-xl text-slate-600 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatrixCell}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <span>💾</span>
                  <span>Simpan Perubahan Status</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* User Account Settings Modal */}
      {showAccountModal && renderAccountSettingsModal()}

      {/* Global Hidden Archive JSON Input (Always mounted across all tabs) */}
      <input
        type="file"
        id="global-archive-json-input"
        ref={archiveFileInputRef}
        accept=".json"
        onChange={handleImportArchiveJson}
        className="hidden"
      />

      {/* 0. GLOBAL ACTION & DELETE CONFIRMATION MODAL (Replaces browser confirm popup) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-xs">
            {/* Header */}
            <div className={`p-5 text-white ${
              confirmModal.confirmColor === "rose"
                ? "bg-gradient-to-r from-rose-600 to-red-700"
                : confirmModal.confirmColor === "amber"
                ? "bg-gradient-to-r from-amber-600 to-orange-700"
                : "bg-gradient-to-r from-indigo-600 to-blue-700"
            }`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                  {confirmModal.confirmColor === "rose" ? "⚠️ PENGESAHAN TINDAKAN" : "ℹ️ PENGESAHAN"}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="text-white/80 hover:text-white text-lg font-bold transition"
                >
                  ✕
                </button>
              </div>
              <h3 className="text-base font-black tracking-tight text-white mt-2">
                {confirmModal.title}
              </h3>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-3">
              <p className="text-slate-800 text-sm font-bold leading-snug">
                {confirmModal.message}
              </p>
              {confirmModal.detail && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
                  {confirmModal.detail}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className={`px-5 py-2.5 text-white font-extrabold text-xs rounded-xl shadow-md transition ${
                    confirmModal.confirmColor === "rose"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : confirmModal.confirmColor === "amber"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. PURGE DRAF LAMA WARNING MODAL (Custom UI replacing browser popup) */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 max-w-lg w-full overflow-hidden text-xs">
            {/* Warning Header */}
            <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 text-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                  ⚠️ AMARAN PEMBERSIHAN PANGKALAN DATA
                </span>
                <button
                  onClick={() => setShowPurgeModal(false)}
                  className="text-white/80 hover:text-white text-lg font-bold transition"
                >
                  ✕
                </button>
              </div>
              <h3 className="text-base font-black tracking-tight text-white">
                Sahkan Pembersihan Draf Lama (Purge)
              </h3>
              <p className="text-rose-100 text-[11px] leading-relaxed">
                Tindakan ini akan memadam rekod draf yang belum disahkan secara kekal bagi memastikan kuota storan Supabase sentiasa ringan dan pantas.
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-rose-800">
                    Jumlah Draf Terlibat
                  </span>
                  <div className="text-2xl font-black text-rose-700">
                    {rphRecords.filter((r) => r.status === 'DRAF').length}{' '}
                    <span className="text-xs font-bold text-rose-600">Rekod DRAF</span>
                  </div>
                  <p className="text-[10px] text-rose-600">
                    Semua draf belum hantar akan dipadam
                  </p>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-800">
                    Jaminan Keselamatan
                  </span>
                  <div className="text-2xl font-black text-emerald-700">
                    100%{' '}
                    <span className="text-xs font-bold text-emerald-600">Selamat</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    Rekod DISAHKAN & DIHANTAR kekal utuh
                  </p>
                </div>
              </div>

              {/* Callout Warning */}
              <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-2xl p-3.5 text-[11px] text-amber-950 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-amber-900">
                  <span>⚠️</span>
                  <span>PERINGATAN PENTADBIR SEKOLAH:</span>
                </div>
                <p className="leading-relaxed">
                  Pemadaman ini adalah <b>muktamad (irreversible)</b>. Sila pastikan anda telah menekan butang <b>"Export Sesi Tahun"</b> untuk memuat turun salinan sandaran sebelum memulakan pembersihan ini.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmPurgeDrafts}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <span>🧹</span>
                <span>
                  Ya, Sahkan & Padam {rphRecords.filter((r) => r.status === 'DRAF').length} Draf
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. IMPORTED ARCHIVE VIEWER MODAL (Immediate UI response upon JSON import) */}
      {showArchiveImportModal && importedArchiveData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-2.5 bg-white/20 rounded-2xl text-xl backdrop-blur-xs">📂</span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full text-white backdrop-blur-xs">
                      Fail Arkib e-RPH Berjaya Dimuat Naik
                    </span>
                    <h3 className="text-base font-black text-white mt-0.5">
                      {importedArchiveData.fileName}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowArchiveImportModal(false)}
                  className="text-white/80 hover:text-white text-lg font-bold transition p-1"
                >
                  ✕
                </button>
              </div>

              {/* Stats Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <span className="font-bold text-white bg-black/20 px-2.5 py-1 rounded-lg">
                  🗓️ Sesi: {importedArchiveData.academicYear}
                </span>
                <span className="font-bold text-white bg-black/20 px-2.5 py-1 rounded-lg">
                  📄 {importedArchiveData.records.length} Rekod e-RPH
                </span>
                {importedArchiveData.timetable && importedArchiveData.timetable.length > 0 && (
                  <span className="font-bold text-white bg-black/20 px-2.5 py-1 rounded-lg">
                    ⏰ {importedArchiveData.timetable.length} Slot Jadual Waktu
                  </span>
                )}
                {importedArchiveData.teachers && importedArchiveData.teachers.length > 0 && (
                  <span className="font-bold text-white bg-black/20 px-2.5 py-1 rounded-lg">
                    👨‍🏫 {importedArchiveData.teachers.length} Profil Guru
                  </span>
                )}
              </div>
            </div>

            {/* Sub-header Actions */}
            <div className="bg-amber-50/70 border-b border-amber-200 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <span className="text-slate-400">🔍</span>
                <input
                  type="text"
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  placeholder="Cari kelas, subjek, SK atau tarikh..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPrintableFullYearRphPdf(
                      importedArchiveData.records,
                      school.name,
                      currentUser.name,
                      importedArchiveData.academicYear
                    )
                  }
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs"
                >
                  <span>🖨️</span>
                  <span>Cetak Buku PDF Penuh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowArchiveImportModal(false);
                    setActiveNav('rph-builder');
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs"
                >
                  <span>🚀</span>
                  <span>Buka di Penjana e-RPH</span>
                </button>
              </div>
            </div>

            {/* List of Records in Modal */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {importedArchiveData.records
                .filter((r) => {
                  if (!archiveSearchQuery.trim()) return true;
                  const q = archiveSearchQuery.toLowerCase();
                  return (
                    r.className?.toLowerCase().includes(q) ||
                    r.subjectName?.toLowerCase().includes(q) ||
                    r.sk?.toLowerCase().includes(q) ||
                    r.day?.toLowerCase().includes(q)
                  );
                })
                .map((r, idx) => (
                  <div
                    key={r.id || idx}
                    className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4 shadow-xs space-y-2.5 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg text-[10px]">
                          Minggu {r.weekNumber} • {r.day} ({r.date || 'Tarikh'})
                        </span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {r.timeStart} – {r.timeEnd}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{r.className}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-slate-700 text-xs">{r.subjectName}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        ✓ {r.status || 'DISAHKAN'}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <p>
                        <b className="text-slate-800">SK:</b> {r.sk}
                      </p>
                      <p className="line-clamp-2">
                        <b className="text-slate-800">Objektif:</b> {r.objectives?.join('; ')}
                      </p>
                      {r.reflection && (
                        <p className="text-slate-500">
                          <b className="text-slate-700">Refleksi:</b> {r.reflection}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          handleReuseArchivedRph(r);
                          setShowArchiveImportModal(false);
                          setActiveNav('rph-builder');
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1"
                      >
                        <span>♻️</span>
                        <span>Guna Semula ke Minggu {builderWeek}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPrintableRphWindow(r, school.name, currentUser.name)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1"
                      >
                        <span>🖨️</span>
                        <span>Cetak Sesi Ini</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                Data arkib kekal dalam memori sesi untuk semakan dan cetakan tanpa menimpa data semasa anda.
              </span>
              <button
                type="button"
                onClick={() => setShowArchiveImportModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition"
              >
                Tutup Paparan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
