export type UserRole = 'guru' | 'pk_pentadbiran' | 'guru_besar' | 'guru_ict_data' | 'superadmin';
export type RphStatus = 'BELUM_HANTAR' | 'DRAF' | 'DIHANTAR' | 'DISAHKAN' | 'PEMBETULAN';

export interface SchoolConfig {
  code: string;
  name: string;
  chineseName: string;
  ppd: string;
  academicYear: string;
  currentWeek: number;
  groupType: 'KUMPULAN_A' | 'KUMPULAN_B';
}

export type TeacherJawatan = 'GB' | 'GPK1' | 'GPK HEM' | 'GPK KOKO' | 'GPK KK' | 'GAB' | 'G GANTI';

export interface AuthUserSession {
  userId: string;
  name: string;
  chineseName: string;
  email: string;
  role: UserRole;
  jawatan?: TeacherJawatan;
  panitia: string;
  provider: 'email' | 'google';
  loginAt: string;
  isGoogleLinked?: boolean;
}

export const SUPERADMIN_PROFILE: TeacherProfile = {
  id: 'superadmin',
  bil: 0,
  name: 'SJKC YOK POON',
  chineseName: '育本国民型华文小学',
  email: 'YokPoon@moe-dl.edu.my',
  panitia: 'Pengurusan Pentadbiran',
  subjectSlug: 'bahasa_cina_sjkc',
  role: 'superadmin',
  jawatan: 'GB',
  status: 'AKTIF',
  icNo: 'SUPERADMIN',
};


export interface TeacherProfile {
  id: string;
  name: string;
  chineseName: string;
  email: string;
  panitia: string;
  subjectSlug: string;
  role: UserRole;
  status?: 'AKTIF' | 'CUTI' | 'BERPINDAH';
  icNo?: string;
  jawatan?: TeacherJawatan;
  penyemakGroupId?: string; // 'k1'..'k7'
  penyemakGroupName?: string; // 'KUMPULAN 1', etc.
  penyemakName?: string; // 'HONG WAI FUN', etc.
  bil?: number;
  password?: string;
}

export type MatrixCellStatus = 'TEPAT' | 'LEWAT' | 'TIDAK_HANTAR' | 'CUTI' | 'BELUM';

export interface MatrixCellRecord {
  weekNumber: number;
  dueDate: string; // cth: '16-01-26'
  status: MatrixCellStatus;
  submittedDateFormatted?: string; // cth: '16-01' or '20-02'
  statusLabel?: string; // cth: '16-01 tepat' or '20-02 lewat'
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface PenyemakGroupDef {
  id: string;
  code: string; // 'KUMPULAN 1'
  title: string; // 'GB / PENGETUA'
  supervisorName: string; // 'HONG WAI FUN'
  badgeBg: string;
  badgeText: string;
  borderHex: string;
  colorHex: string;
}

export const INITIAL_PENYEMAK_GROUPS: PenyemakGroupDef[] = [
  {
    id: 'k1',
    code: 'KUMPULAN 1',
    title: 'GB / PENGETUA',
    supervisorName: 'HONG WAI FUN',
    badgeBg: 'bg-yellow-400',
    badgeText: 'text-yellow-950',
    borderHex: '#eab308',
    colorHex: '#facc15',
  },
  {
    id: 'k2',
    code: 'KUMPULAN 2',
    title: 'GPK 1 / PK PENTADBIRAN',
    supervisorName: 'PHOON SAU PING',
    badgeBg: 'bg-sky-400',
    badgeText: 'text-sky-950',
    borderHex: '#0284c7',
    colorHex: '#38bdf8',
  },
  {
    id: 'k3',
    code: 'KUMPULAN 3',
    title: 'GPK HEM',
    supervisorName: 'LOW OOI LIAN',
    badgeBg: 'bg-emerald-400',
    badgeText: 'text-emerald-950',
    borderHex: '#10b981',
    colorHex: '#4ade80',
  },
  {
    id: 'k4',
    code: 'KUMPULAN 4',
    title: 'GPK KOKO',
    supervisorName: 'CHOI MING MING',
    badgeBg: 'bg-orange-400',
    badgeText: 'text-orange-950',
    borderHex: '#f97316',
    colorHex: '#fb923c',
  },
  {
    id: 'k5',
    code: 'KUMPULAN 5',
    title: 'KETUA BIDANG 1',
    supervisorName: 'KETUA PANITIA BC/BM',
    badgeBg: 'bg-slate-300',
    badgeText: 'text-slate-900',
    borderHex: '#64748b',
    colorHex: '#cbd5e1',
  },
  {
    id: 'k6',
    code: 'KUMPULAN 6',
    title: 'KETUA BIDANG 2',
    supervisorName: 'KETUA PANITIA MT/SN',
    badgeBg: 'bg-rose-500',
    badgeText: 'text-white',
    borderHex: '#ef4444',
    colorHex: '#f87171',
  },
  {
    id: 'k7',
    code: 'KUMPULAN 7',
    title: 'KETUA BIDANG 3',
    supervisorName: 'KETUA PANITIA BI/SEJ',
    badgeBg: 'bg-fuchsia-500',
    badgeText: 'text-white',
    borderHex: '#d946ef',
    colorHex: '#e879f9',
  },
];

export interface AcademicWeek {
  weekNumber: number; // 1 to 45
  startDate: string; // Isnin (cth: '2026-01-05')
  dueDateFriday: string; // Jumaat (cth: '2026-01-09') - kosong jika minggu tidak aktif
  theme?: string; // Tema / Catatan
  isHoliday?: boolean; // Cuti Sekolah
}

export interface SyllabusRolloutGrade {
  year: number;
  newSyllabusGrades: string[];
}

export interface TimetableSlot {
  id: string;
  teacherId: string;
  day: 'ISNIN' | 'SELASA' | 'RABU' | 'KHAMIS' | 'JUMAAT';
  period?: number; // Optional legacy reference
  timeStart: string;
  timeEnd: string;
  grade: string;
  className: string;
  studentCount?: number; // Number of students in this class
  subjectSlug: string;
  subjectName: string;
  defaultSk: string;
  defaultSps: string[];
}

export interface RphRecord {
  id: string;
  slotId: string;
  teacherId: string;
  weekNumber: number;
  date: string;
  day: string;
  timeStart: string;
  timeEnd: string;
  grade: string;
  className: string;
  studentCount?: number; // Number of students in class
  subjectSlug: string;
  subjectName: string;
  sk: string;
  sps: string[];
  objectives: string[];
  criteria: string[];
  induction: string;
  activities: string[];
  closure: string;
  emk: string[];
  bbm: string[];
  assessment: string;
  reflection: string;
  status: RphStatus;
  verifiedBy?: string;
  verifierFeedback?: string;
  verifiedAt?: string;
  updatedAt: string;
}

export interface TeacherAbsence {
  id: string;
  teacherId: string;
  date: string;
  day: 'ISNIN' | 'SELASA' | 'RABU' | 'KHAMIS' | 'JUMAAT';
  reason: 'Cuti Sakit (MC)' | 'Cuti Rehat Khas (CRK)' | 'Kursus PPD / JPN' | 'Taklimat Rasmi';
}

export interface ReliefAssignment {
  id: string;
  date: string;
  day: string;
  slotId: string;
  period: number;
  timeStart: string;
  timeEnd: string;
  className: string;
  subjectName: string;
  absentTeacherId: string;
  reliefTeacherId: string;
  matchReason: string;
  score: number;
}

const nowYear = new Date().getFullYear();
export const CURRENT_ACADEMIC_YEAR = `${nowYear}/${nowYear + 1}`;


// KPM 2027 Syllabus 6-Year Phased Rollout Schedule (2027 - 2032)
export const KPM_SYLLABUS_ROLLOUT: Record<number, string[]> = {
  2026: [], // Semua Tahun 1-6 menggunakan KSSR Semakan
  2027: ['1'], // Tahun 1 bermula Kurikulum 2027
  2028: ['1', '2'], // Tahun 1 & 2
  2029: ['1', '2', '3'], // Tahun 1, 2, 3
  2030: ['1', '2', '3', '4'], // Tahun 1 - 4
  2031: ['1', '2', '3', '4', '5'], // Tahun 1 - 5
  2032: ['1', '2', '3', '4', '5', '6'], // Pelaksanaan Penuh 1 - 6
};

// Minggu 1 hingga 45 (Minggu 43-45 dueDateFriday kosong secara lalai)
export const INITIAL_ACADEMIC_WEEKS: AcademicWeek[] = [
  { weekNumber: 1, startDate: '2026-01-12', dueDateFriday: '2026-01-16', theme: 'Minggu Orientasi & Transisi Tahun 1' },
  { weekNumber: 2, startDate: '2026-01-19', dueDateFriday: '2026-01-23', theme: 'Minggu Pengenalan Sukatan & Taklimat' },
  { weekNumber: 3, startDate: '2026-01-26', dueDateFriday: '2026-01-30', theme: 'Program Guru Penyayang & Amalan 3S' },
  { weekNumber: 4, startDate: '2026-02-02', dueDateFriday: '2026-02-06', theme: 'Minggu Bahasa Cina & Sambutan Tahun Baharu Cina' },
  { weekNumber: 5, startDate: '2026-02-09', dueDateFriday: '2026-02-13', theme: 'Penilaian Diagnostik PBD Awal Sesi' },
  { weekNumber: 6, startDate: '2026-02-16', dueDateFriday: '2026-02-20', theme: 'Minggu Sains & Matematik Kreatif' },
  { weekNumber: 7, startDate: '2026-02-23', dueDateFriday: '2026-02-27', theme: 'Kem Membaca 1Malaysia & Nilam' },
  { weekNumber: 8, startDate: '2026-03-02', dueDateFriday: '2026-03-06', theme: 'Minggu Sivik: Nilai Kasih Sayang' },
  { weekNumber: 9, startDate: '2026-03-09', dueDateFriday: '2026-03-13', theme: 'Program Celik STEM & Robotik' },
  { weekNumber: 10, startDate: '2026-03-16', dueDateFriday: '2026-03-20', theme: 'Minggu Disiplin & Anti-Buli' },
  { weekNumber: 11, startDate: '2026-03-30', dueDateFriday: '2026-04-03', theme: 'Pencerapan PdP Kendiri Fasa 1' },
  { weekNumber: 12, startDate: '2026-04-06', dueDateFriday: '2026-04-10', theme: 'Minggu Bahasa Melayu & Bulan Patriotisme' },
  { weekNumber: 13, startDate: '2026-04-13', dueDateFriday: '2026-04-17', theme: 'Kemuncak Program Ihya Ramadan' },
  { weekNumber: 14, startDate: '2026-04-20', dueDateFriday: '2026-04-24', theme: 'Minggu Bahasa Inggeris (HIP Carnival)' },
  { weekNumber: 15, startDate: '2026-04-27', dueDateFriday: '2026-05-01', theme: 'Minggu Sivik: Bertanggungjawab' },
  { weekNumber: 16, startDate: '2026-05-04', dueDateFriday: '2026-05-08', theme: 'Sambutan Hari Guru Peringkat Sekolah' },
  { weekNumber: 17, startDate: '2026-05-11', dueDateFriday: '2026-05-15', theme: 'Minggu Kesenian & Muzik Tradisional' },
  { weekNumber: 18, startDate: '2026-05-18', dueDateFriday: '2026-05-22', theme: 'Penilaian Sumatif Pertengahan Sesi' },
  { weekNumber: 19, startDate: '2026-05-25', dueDateFriday: '2026-05-29', theme: 'Ulasan PBD & Mesyuarat Kurikulum Bil 2' },
  { weekNumber: 20, startDate: '2026-06-08', dueDateFriday: '2026-06-12', theme: 'Hari Terbuka & Dialog Prestasi Waris' },
  { weekNumber: 21, startDate: '2026-06-15', dueDateFriday: '2026-06-19', theme: 'Minggu Sivik: Kegembiraan' },
  { weekNumber: 22, startDate: '2026-06-22', dueDateFriday: '2026-06-26', theme: 'Sukan Tara & Latihan Rumah Sukan' },
  { weekNumber: 23, startDate: '2026-06-29', dueDateFriday: '2026-07-03', theme: 'Kejohanan Sukan Tahunan Sekolah' },
  { weekNumber: 24, startDate: '2026-07-06', dueDateFriday: '2026-07-10', theme: 'Minggu RBT & Pameran Inovasi Murid' },
  { weekNumber: 25, startDate: '2026-07-13', dueDateFriday: '2026-07-17', theme: 'Minggu Pendidikan Moral & Kesedaran Alam' },
  { weekNumber: 26, startDate: '2026-07-20', dueDateFriday: '2026-07-24', theme: 'Kem Kepimpinan Murid & Pengawas' },
  { weekNumber: 27, startDate: '2026-07-27', dueDateFriday: '2026-07-31', theme: 'Minggu Sejarah & Penghayatan Kemerdekaan' },
  { weekNumber: 28, startDate: '2026-08-03', dueDateFriday: '2026-08-07', theme: 'Minggu Sivik: Kasih Sayang Sesama Insan' },
  { weekNumber: 29, startDate: '2026-08-10', dueDateFriday: '2026-08-14', theme: 'Pelancaran Bulan Kebangsaan' },
  { weekNumber: 30, startDate: '2026-08-17', dueDateFriday: '2026-08-21', theme: 'Karnival Kokurikulum & Hari Keusahawanan' },
  { weekNumber: 31, startDate: '2026-08-24', dueDateFriday: '2026-08-28', theme: 'Pencerapan PdP Kendiri Fasa 2' },
  { weekNumber: 32, startDate: '2026-08-31', dueDateFriday: '2026-09-04', theme: 'Pertandingan Nyanyian Lagu Patriotik' },
  { weekNumber: 33, startDate: '2026-09-14', dueDateFriday: '2026-09-18', theme: 'Sambutan Hari Kemerdekaan & Hari Malaysia' },
  { weekNumber: 34, startDate: '2026-09-21', dueDateFriday: '2026-09-25', theme: 'Minggu Sivik: Hormat Hak Orang Lain' },
  { weekNumber: 35, startDate: '2026-09-28', dueDateFriday: '2026-10-02', theme: 'Minggu Literasi Digital & Keselamatan Siber' },
  { weekNumber: 36, startDate: '2026-10-05', dueDateFriday: '2026-10-09', theme: 'Bimbingan Pecutan Akhir Peperiksaan UASA' },
  { weekNumber: 37, startDate: '2026-10-12', dueDateFriday: '2026-10-16', theme: 'Simulasi & Ujian Percubaan UASA' },
  { weekNumber: 38, startDate: '2026-10-19', dueDateFriday: '2026-10-23', theme: 'Ujian Akhir Sesi Akademik (UASA Tahap 2)' },
  { weekNumber: 39, startDate: '2026-10-26', dueDateFriday: '2026-10-30', theme: 'Penilaian Bilik Darjah (PBD Akhir Tahun)' },
  { weekNumber: 40, startDate: '2026-11-02', dueDateFriday: '2026-11-06', theme: 'Penyerahan Markah & Semakan RPH Lengkap' },
  { weekNumber: 41, startDate: '2026-11-09', dueDateFriday: '2026-11-13', theme: 'Aktiviti Pasca Peperiksaan & Pengayaan' },
  { weekNumber: 42, startDate: '2026-11-16', dueDateFriday: '2026-11-20', theme: 'Hari Apresiasi Murid & Majlis Graduasi' },
];

export const getActiveAcademicWeeks = (weeks: AcademicWeek[]): AcademicWeek[] => {
  return weeks.filter((w) => !!w.dueDateFriday && w.dueDateFriday.trim() !== '');
};

export const INITIAL_SCHOOL_CONFIG: SchoolConfig = {
  code: 'JBC1001',
  name: 'SJKC YOK POON',
  chineseName: '育本国民型华文小学',
  ppd: 'SUNGAI RENGIT, 81620 PENGERANG JOHOR',
  academicYear: CURRENT_ACADEMIC_YEAR,
  currentWeek: 24,
  groupType: 'KUMPULAN_B',
};

export const INITIAL_TEACHERS: TeacherProfile[] = [];
const DEPRECATED_TEACHERS: TeacherProfile[] = [
  {
    id: 'gb1',
    bil: 1,
    icNo: '900527015758',
    name: 'HONG WAI FUN',
    chineseName: '方慧芬校长',
    email: 'g-900527@moe-dl.edu.my',
    panitia: 'Pengurusan & Pentadbiran',
    subjectSlug: 'bahasa_cina_sjkc',
    role: 'guru_besar',
    jawatan: 'GB',
    penyemakGroupId: 'k1',
    penyemakGroupName: 'KUMPULAN 1',
    penyemakName: 'HONG WAI FUN',
    status: 'AKTIF',
  },
  {
    id: 'admin1',
    bil: 2,
    icNo: '760728085724',
    name: 'PHOON SAU PING',
    chineseName: '潘少萍副校长 (PK1)',
    email: 'g-760728@moe-dl.edu.my',
    panitia: 'Pentadbiran & Kurikulum',
    subjectSlug: 'sejarah_sjkc',
    role: 'pk_pentadbiran',
    jawatan: 'GPK1',
    penyemakGroupId: 'k2',
    penyemakGroupName: 'KUMPULAN 2',
    penyemakName: 'PHOON SAU PING',
    status: 'AKTIF',
  },
  {
    id: 't3',
    bil: 3,
    icNo: '680722015602',
    name: 'LOW OOI LIAN',
    chineseName: '刘爱莲副校长 (HEM)',
    email: 'g-680722@moe-dl.edu.my',
    panitia: 'Hal Ehwal Murid / Matematik',
    subjectSlug: 'matematik_sjkc',
    role: 'pk_pentadbiran',
    jawatan: 'GPK HEM',
    penyemakGroupId: 'k3',
    penyemakGroupName: 'KUMPULAN 3',
    penyemakName: 'LOW OOI LIAN',
    status: 'AKTIF',
  },
  {
    id: 't4',
    bil: 4,
    icNo: '871218085312',
    name: 'CHOI MING MING',
    chineseName: '蔡明明副校长 (KK)',
    email: 'g-871218@moe-dl.edu.my',
    panitia: 'Kokurikulum / Sains',
    subjectSlug: 'sains_sjkc',
    role: 'pk_pentadbiran',
    jawatan: 'GPK KK',
    penyemakGroupId: 'k4',
    penyemakGroupName: 'KUMPULAN 4',
    penyemakName: 'CHOI MING MING',
    status: 'AKTIF',
  },
  {
    id: 't5',
    bil: 5,
    icNo: '940601135052',
    name: 'ARENE YEU TZE LING',
    chineseName: '杨紫灵老师',
    email: 'g-940601@moe-dl.edu.my',
    panitia: 'Bahasa Cina',
    subjectSlug: 'bahasa_cina_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k1',
    penyemakGroupName: 'KUMPULAN 1',
    penyemakName: 'HONG WAI FUN',
    status: 'AKTIF',
  },
  {
    id: 't6',
    bil: 6,
    icNo: '941112135954',
    name: 'CHAI MUI AI',
    chineseName: '蔡美爱老师',
    email: 'g-941112@moe-dl.edu.my',
    panitia: 'Bahasa Inggeris',
    subjectSlug: 'bahasa_inggeris_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k2',
    penyemakGroupName: 'KUMPULAN 2',
    penyemakName: 'PHOON SAU PING',
    status: 'AKTIF',
  },
  {
    id: 'ict1',
    bil: 7,
    icNo: '920420135529',
    name: 'JACKIE WONG SING QIE',
    chineseName: '黄圣杰老师 (Guru ICT/Data)',
    email: 'g-920420@moe-dl.edu.my',
    panitia: 'Teknologi Maklumat / RBT',
    subjectSlug: 'rbt_sjkc',
    role: 'guru_ict_data',
    jawatan: 'GAB',
    penyemakGroupId: 'k2',
    penyemakGroupName: 'KUMPULAN 2',
    penyemakName: 'PHOON SAU PING',
    status: 'AKTIF',
  },
  {
    id: 't2',
    bil: 8,
    icNo: '900806015185',
    name: 'KHOO WEN JING',
    chineseName: '邱雯晶老师',
    email: 'g-900806@moe-dl.edu.my',
    panitia: 'Bahasa Melayu',
    subjectSlug: 'bahasa_melayu_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k3',
    penyemakGroupName: 'KUMPULAN 3',
    penyemakName: 'LOW OOI LIAN',
    status: 'AKTIF',
  },
  {
    id: 't7',
    bil: 9,
    icNo: '920114135026',
    name: 'NGU TTI TING',
    chineseName: '吴婷婷老师',
    email: 'g-920114@moe-dl.edu.my',
    panitia: 'Matematik',
    subjectSlug: 'matematik_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k3',
    penyemakGroupName: 'KUMPULAN 3',
    penyemakName: 'LOW OOI LIAN',
    status: 'AKTIF',
  },
  {
    id: 't8',
    bil: 10,
    icNo: '841108016538',
    name: 'NOR ZALIFAH BINTI KELIWON',
    chineseName: '诺扎丽法老师',
    email: 'g-841108@moe-dl.edu.my',
    panitia: 'Bahasa Melayu',
    subjectSlug: 'bahasa_melayu_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k4',
    penyemakGroupName: 'KUMPULAN 4',
    penyemakName: 'CHOI MING MING',
    status: 'AKTIF',
  },
  {
    id: 't9',
    bil: 11,
    icNo: '691121045252',
    name: 'POO YIA LIEN',
    chineseName: '蒲雅莲老师',
    email: 'g-691121@moe-dl.edu.my',
    panitia: 'Pendidikan Moral',
    subjectSlug: 'pendidikan_moral_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k2',
    penyemakGroupName: 'KUMPULAN 2',
    penyemakName: 'PHOON SAU PING',
    status: 'AKTIF',
  },
  {
    id: 't10',
    bil: 12,
    icNo: '910202035470',
    name: 'SITI MAISARAH BT HASSAN',
    chineseName: '茜蒂麦莎拉老师',
    email: 'g-910202@moe-dl.edu.my',
    panitia: 'Pendidikan Islam',
    subjectSlug: 'bahasa_melayu_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k4',
    penyemakGroupName: 'KUMPULAN 4',
    penyemakName: 'CHOI MING MING',
    status: 'AKTIF',
  },
  {
    id: 't1',
    bil: 13,
    icNo: '910603015408',
    name: 'TAN SUIN LIN',
    chineseName: '陈顺莲老师',
    email: 'g-910603@moe-dl.edu.my',
    panitia: 'Bahasa Cina',
    subjectSlug: 'bahasa_cina_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k1',
    penyemakGroupName: 'KUMPULAN 1',
    penyemakName: 'HONG WAI FUN',
    status: 'AKTIF',
  },
  {
    id: 't12',
    bil: 14,
    icNo: '670804015058',
    name: 'TEY SUAT HONG',
    chineseName: '郑雪芬老师',
    email: 'g-670804@moe-dl.edu.my',
    panitia: 'Sains',
    subjectSlug: 'sains_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k3',
    penyemakGroupName: 'KUMPULAN 3',
    penyemakName: 'LOW OOI LIAN',
    status: 'AKTIF',
  },
  {
    id: 't13',
    bil: 15,
    icNo: '020320030552',
    name: 'SITI AISYAH BINTI MAMAT',
    chineseName: '茜蒂爱莎老师',
    email: 'g-020320@moe-dl.edu.my',
    panitia: 'Bahasa Melayu',
    subjectSlug: 'bahasa_melayu_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k4',
    penyemakGroupName: 'KUMPULAN 4',
    penyemakName: 'CHOI MING MING',
    status: 'AKTIF',
  },
  {
    id: 't14',
    bil: 16,
    icNo: '12345',
    name: 'GURU GANTI',
    chineseName: '代课老师',
    email: 'g-12345@moe-dl.edu.my',
    panitia: 'Umum & Gantian',
    subjectSlug: 'bahasa_melayu_sjkc',
    role: 'guru',
    jawatan: 'G GANTI',
    penyemakGroupId: 'k2',
    penyemakGroupName: 'KUMPULAN 2',
    penyemakName: 'PHOON SAU PING',
    status: 'AKTIF',
  },
  {
    id: 't15',
    bil: 17,
    icNo: '030225130352',
    name: 'PHIONG YING QIAN',
    chineseName: '冯莹倩老师',
    email: 'g-030225@moe-dl.edu.my',
    panitia: 'Pendidikan Seni Visual',
    subjectSlug: 'bahasa_cina_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k1',
    penyemakGroupName: 'KUMPULAN 1',
    penyemakName: 'HONG WAI FUN',
    status: 'AKTIF',
  },
  {
    id: 't16',
    bil: 18,
    icNo: '051211040198',
    name: 'KOH ZHEN LING',
    chineseName: '许真菱老师',
    email: 'g-051211@moe-dl.edu.my',
    panitia: 'Muzik & PJ',
    subjectSlug: 'bahasa_inggeris_sjkc',
    role: 'guru',
    jawatan: 'GAB',
    penyemakGroupId: 'k2',
    penyemakGroupName: 'KUMPULAN 2',
    penyemakName: 'PHOON SAU PING',
    status: 'AKTIF',
  },
];

// Helper to format YYYY-MM-DD to DD-MM (or DD-MM-YY)
export function formatToDayMonth(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}`;
  }
  return dateStr;
}

export function formatToDayMonthYear(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const yr = parts[0].slice(-2);
    return `${parts[2]}-${parts[1]}-${yr}`;
  }
  return dateStr;
}

// Generate realistic initial yearly matrix submission records matching SJKC Yok Poon master spreadsheet
export function generateInitialYearlyRecords(
  teachers: TeacherProfile[],
  weeks: AcademicWeek[]
): Record<string, Record<number, MatrixCellRecord>> {
  const result: Record<string, Record<number, MatrixCellRecord>> = {};

  teachers.forEach((teacher) => {
    result[teacher.id] = {};

    weeks.forEach((w) => {
      const weekNum = w.weekNumber;
      const rawDue = w.dueDateFriday;
      const dueFormatted = formatToDayMonthYear(rawDue);
      const dm = formatToDayMonth(rawDue);

      if (!rawDue || rawDue.trim() === '') {
        // Inactive / unassigned week (weeks 43-45)
        result[teacher.id][weekNum] = {
          weekNumber: weekNum,
          dueDate: '',
          status: 'BELUM',
          notes: 'Minggu belum diaktifkan',
        };
        return;
      }

      if (weekNum > 24) {
        // Future academic weeks
        result[teacher.id][weekNum] = {
          weekNumber: weekNum,
          dueDate: dueFormatted,
          status: 'BELUM',
          notes: 'Belum tiba tarikh penghantaran',
        };
        return;
      }

      // Past weeks (1 to 24) - Populate matching official sheet
      let status: MatrixCellStatus = 'TEPAT';
      let statusLabel = `${dm} tepat`;

      // Specific historical nuances from actual school sheet
      if (weekNum === 6) {
        // Week 6: Many teachers submitted late (20-02 lewat)
        if (
          [
            'ict1', // Jackie Wong
            't2', // Khoo Wen Jing
            't7', // Ngu Tti Ting
            't8', // Nor Zalifah
            't9', // Poo Yia Lien
            't10', // Siti Maisarah
            't1', // Tan Suin Lin
            't12', // Tey Suat Hong
            't13', // Siti Aisyah
          ].includes(teacher.id)
        ) {
          status = 'LEWAT';
          statusLabel = `${dm} lewat`;
        }
      } else if (weekNum === 7) {
        if (['t7', 't8', 't10', 't13'].includes(teacher.id)) {
          status = 'LEWAT';
          statusLabel = `${dm} lewat`;
        }
      } else if (weekNum === 14) {
        if (teacher.id === 'ict1' || teacher.id === 't14') {
          status = 'LEWAT';
          statusLabel = `${dm} lewat`;
        }
      } else if (weekNum === 17) {
        if (teacher.id === 'ict1' || teacher.id === 't1') {
          status = 'LEWAT';
          statusLabel = `${dm} lewat`;
        }
      }

      result[teacher.id][weekNum] = {
        weekNumber: weekNum,
        dueDate: dueFormatted,
        status,
        submittedDateFormatted: dm,
        statusLabel,
        verifiedBy: teacher.penyemakName || 'PHOON SAU PING',
        verifiedAt: `${rawDue} 14:00`,
      };
    });
  });

  return result;
}

// Summary statistics helper for teacher rows
export function calculateTeacherMatrixSummary(
  cells: Record<number, MatrixCellRecord> | undefined,
  activeWeeksCount: number = 24
) {
  if (!cells) {
    return {
      totalSubmitted: 0,
      totalOnTime: 0,
      totalLate: 0,
      totalMissed: 0,
      complianceRate: 100,
    };
  }

  let totalSubmitted = 0;
  let totalOnTime = 0;
  let totalLate = 0;
  let totalMissed = 0;

  for (let w = 1; w <= activeWeeksCount; w++) {
    const cell = cells[w];
    if (!cell) continue;
    if (cell.status === 'TEPAT') {
      totalSubmitted += 1;
      totalOnTime += 1;
    } else if (cell.status === 'LEWAT') {
      totalSubmitted += 1;
      totalLate += 1;
    } else if (cell.status === 'TIDAK_HANTAR') {
      totalMissed += 1;
    }
  }

  const denominator = totalSubmitted + totalMissed;
  const complianceRate =
    denominator > 0 ? Math.round((totalOnTime / denominator) * 1000) / 10 : 0;

  return {
    totalSubmitted,
    totalOnTime,
    totalLate,
    totalMissed,
    complianceRate,
  };
}

export const INITIAL_TIMETABLE: TimetableSlot[] = [];
const DEPRECATED_TIMETABLE: TimetableSlot[] = [
  // Tan Mei Ling (t1) - Bahasa Cina & Pendidikan Moral
  {
    id: 'slot_t1_mon_1',
    teacherId: 't1',
    day: 'ISNIN',
    period: 1,
    timeStart: '07:30',
    timeEnd: '08:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'bahasa_cina_sjkc',
    subjectName: 'BAHASA CINA SJKC 华校华语',
    defaultSk: '1.1 进行口语交际。能根据不同的情况，有效地与人沟通，且能针对不明白的事情提出问题。',
    defaultSps: ['1.1.1 进行口语交际，能应用礼貌语言与人沟通交流（4年级标准）'],
  },
  {
    id: 'slot_t1_mon_3',
    teacherId: 't1',
    day: 'ISNIN',
    period: 3,
    timeStart: '09:30',
    timeEnd: '10:30',
    grade: '2',
    className: '2 Kuning (二黄班)',
    subjectSlug: 'bahasa_cina_sjkc',
    subjectName: 'BAHASA CINA SJKC 华校华语',
    defaultSk: '2.1 阅读与理解教材，能了解文章的内涵，领会其教育意义，体验文章表现的情感。',
    defaultSps: ['2.1.1 理解教材，能借助工具书认识教材中的汉字，掌握词语，理解句子、段落、篇章的内容'],
  },
  {
    id: 'slot_t1_tue_2',
    teacherId: 't1',
    day: 'SELASA',
    period: 2,
    timeStart: '08:30',
    timeEnd: '09:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'bahasa_cina_sjkc',
    subjectName: 'BAHASA CINA SJKC 华校华语',
    defaultSk: '3.2 培养书面表达能力，进行基础写作，学习掌握叙述、描写和说明等基本表达手法。',
    defaultSps: ['3.2.1 练习写话，尝试进行书面表达。能不拘形式地写自己想说的话，并根据表达的需要，正确使用标点符号'],
  },
  {
    id: 'slot_t1_wed_1',
    teacherId: 't1',
    day: 'RABU',
    period: 1,
    timeStart: '07:30',
    timeEnd: '08:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'pendidikan_moral_sjkc',
    subjectName: 'PENDIDIKAN MORAL SJKC 华校道德教育',
    defaultSk: '6.0 尊重与仁爱 (Hormat & Kasih Sayang)',
    defaultSps: ['6.0.1 辨识尊重长辈、师长与同学的方法'],
  },
  {
    id: 'slot_t1_thu_4',
    teacherId: 't1',
    day: 'KHAMIS',
    period: 4,
    timeStart: '10:50',
    timeEnd: '11:50',
    grade: '2',
    className: '2 Kuning (二黄班)',
    subjectSlug: 'bahasa_cina_sjkc',
    subjectName: 'BAHASA CINA SJKC 华校华语',
    defaultSk: '5.3 通过阅读，认识各类词语，辨析及理解词义，并能准确地应用词语。',
    defaultSps: ['5.3.1 通过阅读，认识各类词语，辨析及理解词义，并能准确地应用词语与成语'],
  },
  {
    id: 'slot_t1_fri_2',
    teacherId: 't1',
    day: 'JUMAAT',
    period: 2,
    timeStart: '08:30',
    timeEnd: '09:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'bahasa_cina_sjkc',
    subjectName: 'BAHASA CINA SJKC 华校华语',
    defaultSk: '3.1 应用铅笔写字，感受汉字的形体美。做到笔画和笔顺正确，字的间架结构匀称。',
    defaultSps: ['3.1.1 应用铅笔在田字格上书写基本笔画和正楷，感受汉字的形体美'],
  },

  // Ahmad Faiz (t2) - Bahasa Melayu
  {
    id: 'slot_t2_mon_2',
    teacherId: 't2',
    day: 'ISNIN',
    period: 2,
    timeStart: '08:30',
    timeEnd: '09:30',
    grade: '5',
    className: '5 Biru (五蓝班)',
    subjectSlug: 'bahasa_melayu_sjkc',
    subjectName: 'BAHASA MELAYU SJKC 华校国语',
    defaultSk: '1.1 Mendengar dan memberikan respons semasa berkomunikasi dalam situasi formal dan tidak formal',
    defaultSps: ['1.1.2 Mendengar, memahami dan memberikan respons terhadap soalan, suruhan, pesanan dan permintaan'],
  },
  {
    id: 'slot_t2_wed_3',
    teacherId: 't2',
    day: 'RABU',
    period: 3,
    timeStart: '09:30',
    timeEnd: '10:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'bahasa_melayu_sjkc',
    subjectName: 'BAHASA MELAYU SJKC 华校国语',
    defaultSk: '2.1 Asas membaca dan memahami teks sastera dan bukan sastera',
    defaultSps: ['2.1.2 Membaca dan memahami maklumat tersurat dan tersirat untuk memberikan respons'],
  },

  // Chong Wei Lun (t3) - Matematik
  {
    id: 'slot_t3_mon_1',
    teacherId: 't3',
    day: 'ISNIN',
    period: 1,
    timeStart: '07:30',
    timeEnd: '08:30',
    grade: '6',
    className: '6 Cemerlang (六精英)',
    subjectSlug: 'matematik_sjkc',
    subjectName: 'MATEMATIK SJKC 华小数学',
    defaultSk: '3.1 分数、小数与百分比 (Pecahan, Perpuluhan dan Peratus)',
    defaultSps: ['3.1.2 联系分数、小数与百分比并解答日常生活应用题'],
  },
  {
    id: 'slot_t3_mon_4',
    teacherId: 't3',
    day: 'ISNIN',
    period: 4,
    timeStart: '10:50',
    timeEnd: '11:50',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'matematik_sjkc',
    subjectName: 'MATEMATIK SJKC 华小数学',
    defaultSk: '2.1 基本运算：加、减、乘、除 (Operasi Asas)',
    defaultSps: ['2.1.2 进行涉及整数的乘法与除法运算 (Menyelesaikan ayat matematik darab dan bahagi)'],
  },

  // Lim Siew Bee (t4) - Sains
  {
    id: 'slot_t4_mon_2',
    teacherId: 't4',
    day: 'ISNIN',
    period: 2,
    timeStart: '08:30',
    timeEnd: '09:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'sains_sjkc',
    subjectName: 'SAINS SJKC 华校科学',
    defaultSk: '7.1 电、光与能量的转换 (Tenaga, Cahaya & Elektrik)',
    defaultSps: ['7.1.2 装配完整电路并探究导体与绝缘体的性质'],
  },

  // Lee Kah Seng (t5) - Bahasa Inggeris
  {
    id: 'slot_t5_mon_3',
    teacherId: 't5',
    day: 'ISNIN',
    period: 3,
    timeStart: '09:30',
    timeEnd: '10:30',
    grade: '5',
    className: '5 Biru (五蓝班)',
    subjectSlug: 'bahasa_inggeris_sjkc',
    subjectName: 'BAHASA INGGERIS SJKC 华校英语',
    defaultSk: '2.1 Communicate simple information intelligibly',
    defaultSps: ['2.1.5 Describe objects and people using suitable words and phrases'],
  },

  // Ng Sock Hoon (t6) - Bahasa Cina
  {
    id: 'slot_t6_tue_3',
    teacherId: 't6',
    day: 'SELASA',
    period: 3,
    timeStart: '09:30',
    timeEnd: '10:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'rbt_sjkc',
    subjectName: 'RBT  SJKC 华校设计与工艺',
    defaultSk: '2.1 产品设计与工程编程制作 (Reka Bentuk Produk & Pengaturcaraan)',
    defaultSps: ['2.1.1 根据问题绘制产品设计草图并选择合适的材料与工具'],
  },

  // Wong Kah Wai (admin1 - PK Pentadbiran) - Mengajar Sejarah
  {
    id: 'slot_admin1_mon_3',
    teacherId: 'admin1',
    day: 'ISNIN',
    period: 3,
    timeStart: '09:30',
    timeEnd: '10:30',
    grade: '5',
    className: '5 Biru (五蓝班)',
    subjectSlug: 'sejarah_sjkc',
    subjectName: 'SEJARAH SJKC 华校历史',
    defaultSk: '1.1 认识历史与我们的国家 (Mari Belajar Sejarah / Warisan Negara)',
    defaultSps: ['1.1.1 说明历史的定义及史料来源 (Menyatakan pengertian sejarah dan sumber sejarah)'],
  },
  {
    id: 'slot_admin1_thu_2',
    teacherId: 'admin1',
    day: 'KHAMIS',
    period: 2,
    timeStart: '08:30',
    timeEnd: '09:30',
    grade: '6',
    className: '6 Cemerlang (六精英)',
    subjectSlug: 'sejarah_sjkc',
    subjectName: 'SEJARAH SJKC 华校历史',
    defaultSk: '5.1 马六甲王朝与国家独立历程 (Kesultanan Melayu Melaka & Kemerdekaan)',
    defaultSps: ['5.1.1 讲述国家独立先贤的贡献与团结精神'],
  },

  // Lim Choon Huat (gb1 - Guru Besar) - Mengajar Pendidikan Moral
  {
    id: 'slot_gb1_tue_1',
    teacherId: 'gb1',
    day: 'SELASA',
    period: 1,
    timeStart: '07:30',
    timeEnd: '08:30',
    grade: '6',
    className: '6 Cemerlang (六精英)',
    subjectSlug: 'pendidikan_moral_sjkc',
    subjectName: 'PENDIDIKAN MORAL SJKC 华校道德教育',
    defaultSk: '1.0 信奉上苍 / 礼敬与感恩 (Kepercayaan kepada Tuhan / Berterima Kasih)',
    defaultSps: ['1.0.1 举例说明在家庭与学校中实践感恩与礼貌的行为'],
  },

  // Tan Zhi Wei (ict1 - Guru ICT / Data) - Mengajar RBT & TMK
  {
    id: 'slot_ict1_wed_2',
    teacherId: 'ict1',
    day: 'RABU',
    period: 2,
    timeStart: '08:30',
    timeEnd: '09:30',
    grade: '5',
    className: '5 Biru (五蓝班)',
    subjectSlug: 'rbt_sjkc',
    subjectName: 'RBT  SJKC 华校设计与工艺',
    defaultSk: '2.1 产品设计与工程编程制作 (Reka Bentuk Produk & Pengaturcaraan)',
    defaultSps: ['2.1.1 根据问题绘制产品设计草图并选择合适的材料与工具'],
  },
  {
    id: 'slot_ict1_fri_1',
    teacherId: 'ict1',
    day: 'JUMAAT',
    period: 1,
    timeStart: '07:30',
    timeEnd: '08:30',
    grade: '6',
    className: '6 Cemerlang (六精英)',
    subjectSlug: 'tmk_sjkc',
    subjectName: 'TMK SJKC 华校信息与通信技术',
    defaultSk: '1.0 计算机系统与网络安全',
    defaultSps: ['1.1 认识互联网基本原理及网络安全防范措施'],
  },
];

export const INITIAL_RPH_RECORDS: RphRecord[] = [];
const DEPRECATED_RPH_RECORDS: RphRecord[] = [
  // Wong Kah Wai (admin1) - Rekod RPH Pengajaran Pentadbir (Sejarah)
  {
    id: 'rph_admin1_1',
    slotId: 'slot_admin1_mon_3',
    teacherId: 'admin1',
    weekNumber: 24,
    date: '2026-10-19',
    day: 'ISNIN',
    timeStart: '09:30',
    timeEnd: '10:30',
    grade: '5',
    className: '5 Biru (五蓝班)',
    subjectSlug: 'sejarah_sjkc',
    subjectName: 'SEJARAH SJKC 华校历史',
    sk: '1.1 认识历史与我们的国家 (Mari Belajar Sejarah / Warisan Negara)',
    sps: ['1.1.1 说明历史的定义及史料来源 (Menyatakan pengertian sejarah dan sumber sejarah)'],
    objectives: [
      'Murid dapat menyatakan pengertian sejarah berdasarkan sumber primer dan sekunder.',
      'Murid dapat membezakan sekurang-kurangnya 3 contoh sumber sejarah dengan tepat.',
    ],
    criteria: [
      'Menyatakan pengertian sejarah dengan bimbingan.',
      'Mengelaskan artifak, fosil dan dokumen bertulis.',
      'Menerangkan kepentingan memelihara artifak warisan negara.',
    ],
    induction: 'Guru menunjukkan replika duit syiling purba dan keratan surat khabar lama untuk merangsang rasa ingin tahu murid (5 minit).',
    activities: [
      'Langkah 1: Penerangan konsep sumber primer dan sekunder menggunakan slaid multimedia.',
      'Langkah 2 (PAK-21 Think-Pair-Share): Murid mengelaskan kad gambar bahan sejarah mengikut kategori sumber.',
      'Langkah 3: Murid menjawab soalan pengukuhan dalam lembaran kerja secara individu.',
    ],
    closure: 'Guru membuat rumusan dan memupuk nilai menghargai warisan sejarah tanah air (5 minit).',
    emk: ['Patriotisme', 'Kewarganegaraan Global'],
    bbm: ['Buku Teks Sejarah Tahun 5', 'Replika Artifak', 'Slaid Multimedia', 'Kad Pengelasan'],
    assessment: 'Pemerhatian & Lembaran Kerja (PBD)',
    reflection: '28/30 orang murid berjaya mencapai objektif pembelajaran hari ini.',
    status: 'DRAF',
    updatedAt: '2026-10-23T11:00:00Z',
  },
  // Tan Mei Ling (t1) - Submitted (DIHANTAR) for Week 24
  {
    id: 'rph_t1_1',
    slotId: 'slot_t1_mon_1',
    teacherId: 't1',
    weekNumber: 24,
    date: '2026-10-19',
    day: 'ISNIN',
    timeStart: '07:30',
    timeEnd: '08:30',
    grade: '4',
    className: '4 Merah (四红班)',
    subjectSlug: 'bahasa_cina_sjkc',
    subjectName: 'BAHASA CINA SJKC 华校华语',
    sk: '1.1 进行口语交际。能根据不同的情况，有效地与人沟通，且能针对不明白的事情提出问题。',
    sps: ['1.1.1 进行口语交际，能应用礼貌语言与人沟通交流（4年级标准）'],
    objectives: [
      '学生能够根据日常校园情境，准确应用至少3个礼貌用语与同学进行对话。',
      '学生能够在小组口语交际活动中清楚表达个人看法并礼貌回应他人。',
    ],
    criteria: [
      '低阶达标：在教师引导下说出礼貌问候语。',
      '中阶达标：与同伴完成2分钟的情境对话。',
      '高阶达标：针对同学的提问作出得体、完整的延伸回答。',
    ],
    induction: '教师播放一段校园礼貌与不礼貌对话的对比短视频，引导学生观察并发表看法（5分钟）。',
    activities: [
      '步骤 1：教师讲解口语交际中的礼貌用语规范，并示范声调与姿态。',
      '步骤 2（PAK-21 Think-Pair-Share）：学生两人一组抽取情境卡（借文具、请教问题、道歉），进行角色扮演练习。',
      '步骤 3：各组代表上台展示情境对话，全班利用信号卡（Traffic Light Cards）进行互评与反馈。',
    ],
    closure: '教师总结今日所学礼貌用语，表扬表现积极的组别，并勉励学生在日常生活中实践（5分钟）。',
    emk: ['道德价值（礼貌、互相尊重）', '语文跨课程元素'],
    bbm: ['华文课本', '情境演示短视频', '角色扮演情境卡', 'Traffic Light 评估卡'],
    assessment: '口语观察评估与小组角色扮演表现 (PBD TP1-TP6)',
    reflection: '32/35 位学生达标，3 位学生需教师从旁辅导口语表达。',
    status: 'DIHANTAR',
    updatedAt: '2026-10-23T14:30:00Z',
  },
  {
    id: 'rph_t1_2',
    slotId: 'slot_t1_mon_3',
    teacherId: 't1',
    weekNumber: 24,
    date: '2026-10-19',
    day: 'ISNIN',
    timeStart: '09:30',
    timeEnd: '10:30',
    grade: '2',
    className: '2 Kuning (二黄班)',
    subjectSlug: 'bahasa_cina_sjkc',
    subjectName: 'BAHASA CINA SJKC 华校华语',
    sk: '2.1 阅读与理解教材，能了解文章的内涵，领会其教育意义，体验文章表现的情感。',
    sps: ['2.1.1 理解教材，能借助工具书认识教材中的汉字，掌握词语，理解句子、段落、篇章的内容'],
    objectives: [
      '学生能够正确朗读课文段落，认识并口头解释至少5个新词的含义。',
      '学生能够回答3道关于课文内容细节的理解问题。',
    ],
    criteria: [
      '能准确读出5个生字词的读音。',
      '能利用新词口头造出通顺的句子。',
      '能复述课文的主要教育意义。',
    ],
    induction: '教师展示与课文主题相关的图片，通过提问激发学生的生活经验（5分钟）。',
    activities: [
      '步骤 1：教师范读课文，学生跟读并圈出生字新词。',
      '步骤 2（PAK-21 Round Robin）：学生分组利用词典查找生字词义，轮流在组内分享并记录在迷你白板上。',
      '步骤 3：完成课堂阅读理解巩固练习，师生共同讨论答案。',
    ],
    closure: '全班齐读课文重点段落，总结故事传达的价值观（5分钟）。',
    emk: ['道德价值', '创造与革新'],
    bbm: ['二年级华文课本', '生字词字卡', '迷你白板', '电子词典'],
    assessment: '朗读观察、口头问答及书面练习',
    reflection: '30/30 位学生顺利掌握本课生字词。',
    status: 'DIHANTAR',
    updatedAt: '2026-10-23T14:35:00Z',
  },

  // Ahmad Faiz (t2) - Verified (DISAHKAN) for Week 24
  {
    id: 'rph_t2_1',
    slotId: 'slot_t2_mon_2',
    teacherId: 't2',
    weekNumber: 24,
    date: '2026-10-19',
    day: 'ISNIN',
    timeStart: '08:30',
    timeEnd: '09:30',
    grade: '5',
    className: '5 Biru (五蓝班)',
    subjectSlug: 'bahasa_melayu_sjkc',
    subjectName: 'BAHASA MELAYU SJKC 华校国语',
    sk: '1.1 Mendengar dan memberikan respons semasa berkomunikasi dalam situasi formal dan tidak formal',
    sps: ['1.1.2 Mendengar, memahami dan memberikan respons terhadap soalan, suruhan, pesanan dan permintaan'],
    objectives: [
      'Murid dapat mendengar dan memberikan sekurang-kurangnya 3 respons yang betul terhadap pesanan guru.',
      'Murid dapat melakonkan dialog situasi pesanan secara bertatasusila.',
    ],
    criteria: [
      'Aras Rendah: Menyatakan semula 1 pesanan mudah dengan bimbingan.',
      'Aras Sederhana: Memberikan 2 respons tepat berdasarkan audio.',
      'Aras Tinggi: Membina dan melakonkan dialog respons pesanan secara spontan.',
    ],
    induction: 'Guru memainkan permainan "Telefon Karat" secara ringkas untuk menguji kemahiran mendengar murid (5 minit).',
    activities: [
      'Langkah 1: Murid mendengar rakaman audio dialog pesanan dan mencatat isi penting.',
      'Langkah 2 (PAK-21 Role Play): Murid bergerak secara berpasangan untuk melakonkan situasi menyampaikan pesanan.',
      'Langkah 3: Murid melengkapkan lembaran kerja padanan respons yang sesuai.',
    ],
    closure: 'Murid merumuskan kepentingan mendengar dengan teliti sebelum memberikan respons (5 minit).',
    emk: ['Nilai Murni (Hemah Tinggi)', 'Bahasa'],
    bbm: ['Buku Teks BM SJKC Tahun 5', 'Audio Rakaman', 'Lembaran Kerja'],
    assessment: 'Pemerhatian & Lisan (Simulasi Dialog)',
    reflection: '31/34 murid dapat memberikan respons dengan lancar. 3 murid diberi bimbingan kosa kata.',
    status: 'DISAHKAN',
    verifiedBy: 'Wong Kah Wai (PK Pentadbiran)',
    verifierFeedback: 'Tahniah Cikgu Faiz, aktiviti PAK-21 sangat menarik dan sesuai untuk murid SJK(C).',
    verifiedAt: '2026-10-24T09:15:00Z',
    updatedAt: '2026-10-23T10:15:00Z',
  },

  // Chong Wei Lun (t3) - Draft (DRAF)
  {
    id: 'rph_t3_1',
    slotId: 'slot_t3_mon_1',
    teacherId: 't3',
    weekNumber: 24,
    date: '2026-10-19',
    day: 'ISNIN',
    timeStart: '07:30',
    timeEnd: '08:30',
    grade: '6',
    className: '6 Cemerlang (六精英)',
    subjectSlug: 'matematik_sjkc',
    subjectName: 'MATEMATIK SJKC 华小数学',
    sk: '3.1 分数、小数与百分比 (Pecahan, Perpuluhan dan Peratus)',
    sps: ['3.1.2 联系分数、小数与百分比并解答日常生活应用题'],
    objectives: [
      '学生能够准确进行分数、小数与百分比之间的互化。',
      '学生能够运用波利亚四步骤解答至少3道涉及百分比折扣的日常应用题。',
    ],
    criteria: [
      '能将基本分数与小数转换为百分比。',
      '能正确列出应用题的横式与竖式。',
      '能验算并解释促销折扣应用题的最佳购买方案。',
    ],
    induction: '教师展示超市促销宣传单（20%折扣、半价），引导学生思考如何计算实际售价（5分钟）。',
    activities: [
      '步骤 1：教师示范分数、小数与百分比互化的思维图解法。',
      '步骤 2（PAK-21 Gallery Walk）：各组解决不同难度的商场购物折扣题，并将解题步骤张贴展示。',
      '步骤 3：学生完成个人堂课练习，教师巡视指导。',
    ],
    closure: '总结百分比在日常生活理财中的应用（5分钟）。',
    emk: ['理财教育 ( Pendidikan Kewangan )', '科学与工艺'],
    bbm: ['六年级数学课本', '超市促销传单', '麻将纸', '计算机'],
    assessment: '书面练习与小组步骤展示',
    reflection: 'Menunggu PdP dijalankan.',
    status: 'DRAF',
    updatedAt: '2026-10-24T08:00:00Z',
  },
];

export const INITIAL_ABSENCES: TeacherAbsence[] = [
  {
    id: 'abs_1',
    teacherId: 't4', // Lim Siew Bee (Sains, 4 Merah on ISNIN Period 2)
    date: '2026-10-24',
    day: 'ISNIN',
    reason: 'Cuti Sakit (MC)',
  },
  {
    id: 'abs_2',
    teacherId: 't3', // Chong Wei Lun (Matematik, ISNIN Period 1 & Period 4)
    date: '2026-10-24',
    day: 'ISNIN',
    reason: 'Kursus PPD / JPN',
  },
];

export const INITIAL_RELIEF_ASSIGNMENTS: ReliefAssignment[] = [
  {
    id: 'rel_1',
    date: '2026-10-24',
    day: 'ISNIN',
    slotId: 'slot_t4_mon_2',
    period: 2,
    timeStart: '08:30',
    timeEnd: '09:30',
    className: '4 Merah (四红班)',
    subjectName: 'SAINS SJKC 华校科学',
    absentTeacherId: 't4',
    reliefTeacherId: 't1',
    matchReason: 'Mengajar Kelas Sama (4 Merah) • Slot Kosong',
    score: 15,
  },
];
