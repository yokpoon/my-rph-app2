import { TeacherProfile, TimetableSlot, TeacherAbsence, ReliefAssignment } from './mockData';

export interface ReliefSolverOptions {
  excludeAdmin?: boolean; // Default true
  excludedAdminPositions?: string[]; // ['GB', 'GPK1', 'GPK HEM', 'GPK KK', 'GPK KOKO', 'GPK Petang']
  includeSpecialDutiesTeachers?: boolean; // Default false (Gunakan Guru Bertugas Khas)
  maxConsecutivePeriods?: number; // 2 to 6, default 4
  enforceConsecutiveLimit?: boolean; // Default true (suis override manual)
  monthlyReliefCounts?: Record<string, number>; // Workload equity cumulative count
}

export interface ReliefCandidate {
  teacher: TeacherProfile;
  score: number;
  reasons: string[];
  currentReliefCount: number;
  monthlyCount: number;
  consecutivePeriods: number;
  hasWarning?: boolean;
  warningMessage?: string;
}

/**
 * Helper: Kira turutan waktu berturut-turut maksimum
 */
export function calculateMaxConsecutive(
  periodsOrTeacherId: number[] | string,
  day?: string,
  timetable?: TimetableSlot[],
  reliefs?: ReliefAssignment[]
): number {
  if (Array.isArray(periodsOrTeacherId)) {
    const periods = periodsOrTeacherId;
    if (periods.length === 0) return 0;
    const sorted = Array.from(new Set(periods)).sort((a, b) => a - b);
    let maxSeq = 1;
    let currentSeq = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        currentSeq++;
        if (currentSeq > maxSeq) maxSeq = currentSeq;
      } else {
        currentSeq = 1;
      }
    }
    return maxSeq;
  }

  const teacherId = periodsOrTeacherId;
  const tSlots = (timetable || [])
    .filter((s) => s.teacherId === teacherId && (!day || s.day === day))
    .map((s) => s.period ?? 0)
    .filter((p) => p > 0);
  const rSlots = (reliefs || [])
    .filter((r) => r.reliefTeacherId === teacherId && (!day || r.day === day))
    .map((r) => r.period);
  return calculateMaxConsecutive([...tSlots, ...rSlots]);
}

/**
 * Deterministic Score-Based Relief Teacher (Guru Ganti) Solver
 * Evaluates free periods, absences, subject match, class familiarity, consecutive periods, and workload equity.
 */
export function findBestReliefCandidates(
  slotToCover: TimetableSlot,
  allTeachers: TeacherProfile[],
  allTimetableSlots: TimetableSlot[],
  absencesToday: TeacherAbsence[],
  existingReliefsToday: ReliefAssignment[],
  options?: ReliefSolverOptions
): ReliefCandidate[] {
  const excludeAdmin = options?.excludeAdmin ?? true;
  const excludedAdminPositions = options?.excludedAdminPositions || [
    'GB',
    'GPK1',
    'GPK HEM',
    'GPK KK',
    'GPK KOKO',
    'GPK Petang',
  ];
  const includeSpecialDuties = options?.includeSpecialDutiesTeachers ?? false;
  const maxConsecutive = options?.maxConsecutivePeriods ?? 4;
  const enforceConsecutive = options?.enforceConsecutiveLimit ?? true;
  const monthlyCounts = options?.monthlyReliefCounts || {};

  // 1. Teachers busy at this day & period (regular timetable)
  const busyTeacherIds = new Set(
    allTimetableSlots
      .filter((s) => s.day === slotToCover.day && s.period === slotToCover.period)
      .map((s) => s.teacherId)
  );

  // 2. Teachers absent today
  const absentTeacherIds = new Set(
    absencesToday.filter((a) => a.day === slotToCover.day).map((a) => a.teacherId)
  );

  // 3. Teachers already assigned to another relief at this exact period
  const alreadyRelievingThisPeriod = new Set(
    existingReliefsToday
      .filter((r) => r.day === slotToCover.day && r.period === slotToCover.period)
      .map((r) => r.reliefTeacherId)
  );

  const candidates: ReliefCandidate[] = [];

  for (const teacher of allTeachers) {
    // Superadmin is strictly excluded from timetable & relief duties
    if (teacher.id === 'superadmin' || teacher.role === 'superadmin') continue;

    // Filter 1: Admin exclusion filter
    if (excludeAdmin) {
      const isPentadbirRole = teacher.role === 'guru_besar' || teacher.role === 'pk_pentadbiran';
      const isExcludedJawatan = teacher.jawatan && excludedAdminPositions.includes(teacher.jawatan);
      if (isPentadbirRole || isExcludedJawatan) {
        continue;
      }
    }

    // Filter 2: Special duties portfolio (Kaunseling / Media / Data)
    if (!includeSpecialDuties) {
      const isSpecialDuty =
        teacher.jawatan === ('GBK' as any) ||
        teacher.panitia?.toLowerCase().includes('kaunseling') ||
        teacher.panitia?.toLowerCase().includes('media') ||
        teacher.panitia?.toLowerCase().includes('pusat sumber');
      if (isSpecialDuty) {
        continue;
      }
    }

    if (teacher.id === slotToCover.teacherId) continue;
    if (busyTeacherIds.has(teacher.id)) continue;
    if (absentTeacherIds.has(teacher.id)) continue;
    if (alreadyRelievingThisPeriod.has(teacher.id)) continue;

    let score = 20; // Base score for being free & present
    const reasons: string[] = ['Slot Lapang (Free Period)'];

    const teacherSlotsToday = allTimetableSlots
      .filter((s) => s.teacherId === teacher.id && s.day === slotToCover.day)
      .map((s) => s.period ?? 0)
      .filter((p) => p > 0);

    const teacherReliefsToday = existingReliefsToday
      .filter((r) => r.reliefTeacherId === teacher.id && r.day === slotToCover.day)
      .map((r) => r.period);

    const slotPeriod = slotToCover.period ?? 0;
    const proposedPeriods = slotPeriod > 0
      ? [...teacherSlotsToday, ...teacherReliefsToday, slotPeriod]
      : [...teacherSlotsToday, ...teacherReliefsToday];
    const consecutive = calculateMaxConsecutive(proposedPeriods);

    let hasWarning = false;
    let warningMessage: string | undefined = undefined;

    // TERAS 3: Kawalan Had Waktu Berturut-turut
    if (consecutive > maxConsecutive) {
      hasWarning = true;
      warningMessage = `Amaran: Mencapai Had ${consecutive} Waktu Berturut-turut`;
      if (enforceConsecutive) {
        score -= 40; // Penalti berat supaya tidak menjadi pilihan utama
        reasons.push(`⚠️ Melebihi Had (${consecutive} Waktu Berturut) [-40]`);
      } else {
        reasons.push(`⚡ Manual Bypass Had Berturut (${consecutive} Waktu)`);
      }
    }

    const allTeacherSlots = allTimetableSlots.filter((s) => s.teacherId === teacher.id);

    // Kriteria 1: Teaches the same subject / Panitia (+12 pts)
    const teachesSameSubject =
      teacher.subjectSlug === slotToCover.subjectSlug ||
      allTeacherSlots.some((s) => s.subjectSlug === slotToCover.subjectSlug);
    if (teachesSameSubject) {
      score += 12;
      reasons.push('Subjek / Panitia Sama (+12)');
    }

    // Kriteria 2: Teaches the same class in other periods (+8 pts)
    const teachesSameClass = allTeacherSlots.some((s) => s.className === slotToCover.className);
    if (teachesSameClass) {
      score += 8;
      reasons.push(`Mengajar Kelas ${slotToCover.className.split(' ')[0]} (+8)`);
    }

    // Kriteria 3: Beban harian semasa (-5 pts per relief hari ini)
    const currentReliefCount = teacherReliefsToday.length;
    if (currentReliefCount > 0) {
      score -= currentReliefCount * 5;
      reasons.push(`Ada ${currentReliefCount} relief hari ini (-${currentReliefCount * 5})`);
    }

    // TERAS 3: Pemarkahan Keadilan Pengagihan Bulanan (Fairness Scoring)
    const monthlyCount = monthlyCounts[teacher.id] || currentReliefCount;
    if (monthlyCount === 0) {
      score += 10;
      reasons.push('Beban Bulanan Sifar (+10 Bonus Keadilan)');
    } else {
      const penalty = Math.min(monthlyCount * 2, 20);
      score -= penalty;
      reasons.push(`Kumulatif Bulanan: ${monthlyCount} slot (-${penalty})`);
    }

    candidates.push({
      teacher,
      score,
      reasons,
      currentReliefCount,
      monthlyCount,
      consecutivePeriods: consecutive,
      hasWarning,
      warningMessage,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}
