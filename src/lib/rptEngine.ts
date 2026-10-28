/**
 * rptEngine.ts - Engine for Rancangan Pengajaran Tahunan (RPT) KPM SJK(C)
 * Matches RPT weekly syllabus records with DSKP Standard Kandungan (SK) and Standard Pembelajaran (SP).
 */

export interface RptRecord {
  subject_code: string;
  subject_name: string;
  grade: number | string;
  academic_year: number;
  week_number: number;
  week_label: string;
  theme: string;
  sk_codes: string[];
  sp_codes: string[];
  remarks: string;
}

export interface RptMatchResult {
  rptEntry: RptRecord | null;
  allWeekEntries: RptRecord[];
  allWeekSkCodes: string[];
  allWeekSpCodes: string[];
  matchedSkKeys: string[];
  selectedSk: string;
  matchedSps: string[];
  theme: string;
  remarks: string;
  isMatched: boolean;
}

// Mapping of DSKP subject slugs to RPT file codes
export const DSKP_TO_RPT_CODE_MAP: Record<string, string> = {
  bahasa_cina_sjkc: 'BC_SJKC',
  bahasa_inggeris_sjkc: 'BI_SJKC',
  bahasa_melayu_sjkc: 'BM_SJKC',
  matematik_sjkc: 'MT_SJKC',
  matematik_sjkc_kelas_bercantum: 'MT_SJKC',
  pemulihan_khas_mt_sjkc: 'MT_SJKC',
  pemulihan_khas_bm_sjkc: 'BM_SJKC',
  pendidikan_jasmani_sjkc: 'PJ_SJKC',
  pendidikan_jasmani_sjkc_bm: 'PJ_SJKC',
  pendidikan_jasmani_sjkc_kelas_bercantum: 'PJ_SJKC',
  pendidikan_kesihatan_sjkc: 'PK_SJKC',
  pendidikan_kesihatan_sjkc_bm: 'PK_SJKC',
  pendidikan_kesihatan_sjkc_kelas_bercantum: 'PK_SJKC',
  pendidikan_moral_sjkc: 'PM_SJKC',
  pendidikan_moral_sjkc_kelas_bercantum: 'PM_SJKC',
  pendidikan_muzik_sjkc: 'MZ_SJKC',
  pendidikan_muzik_sjkc_kelas_bercantum: 'MZ_SJKC',
  pendidikan_seni_sjkc: 'PSV_SJKC',
  pendidikan_seni_sjkc_bm: 'PSV_SJKC',
  pendidikan_seni_sjkc_kelas_bercantum: 'PSV_SJKC',
  rbt_sjkc: 'RBT_SJKC',
  rbt_sjkc_kelas_bercantum: 'RBT_SJKC',
  tmk_sjkc: 'RBT_SJKC',
  sains_sjkc: 'SN_SJKC',
  sains_sjkc_kelas_bercantum: 'SN_SJKC',
  sejarah_sjkc: 'SEJ_SJKC',
  sejarah_sjkc_kelas_bercantum: 'SEJ_SJKC',
  sjkc: 'PAI_SJKC',
};

// In-memory cache for loaded RPT JSON files
const rptCache = new Map<string, RptRecord[]>();

/**
 * Fetch RPT JSON for a given DSKP subject slug and grade
 */
export async function fetchRptJson(
  subjectSlug: string,
  grade: string | number
): Promise<RptRecord[]> {
  const rptCode = DSKP_TO_RPT_CODE_MAP[subjectSlug];
  if (!rptCode) return [];

  const gradeStr = String(grade).replace(/[^0-9]/g, '') || '1';
  const cacheKey = `${rptCode}_T${gradeStr}`;

  if (rptCache.has(cacheKey)) {
    return rptCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(`/rpt/${rptCode}_T${gradeStr}.json`);
    if (!res.ok) {
      rptCache.set(cacheKey, []);
      return [];
    }
    const data: RptRecord[] = await res.json();
    rptCache.set(cacheKey, Array.isArray(data) ? data : []);
    return rptCache.get(cacheKey)!;
  } catch {
    rptCache.set(cacheKey, []);
    return [];
  }
}

/**
 * Extract clean numerical SK code from a string (e.g. "1.1", "4.1", "10.1")
 */
export function extractSkCode(text: string): string | null {
  if (!text) return null;
  // Match code after start of string, non-digit or closing parenthesis
  const m = text.match(/(?:^|[^\d\.])(\d+\.\d+)(?:[^\d\.]|$)/);
  if (m) {
    return m[1];
  }
  return null;
}

/**
 * Extract clean numerical SP code from a string (e.g. "1.1.1", "4.1.5", "10.1.2")
 */
export function extractSpCode(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(?:^|[^\d\.])(\d+\.\d+\.\d+)(?:[^\d\.]|$)/);
  if (m) {
    return m[1];
  }
  return null;
}

/**
 * Find matching SPs in a DSKP SK array that match target SP codes
 */
export function findMatchingSpsForSk(
  availableSps: string[],
  targetSpCodes: string[]
): string[] {
  if (!availableSps || availableSps.length === 0) return [];
  if (!targetSpCodes || targetSpCodes.length === 0) return availableSps.slice(0, 1);

  const matched: string[] = [];
  const normalizedTargets = targetSpCodes.map((c) => c.replace(/^[A-Za-z]+/, '').trim());

  for (const target of normalizedTargets) {
    if (!target) continue;
    for (const item of availableSps) {
      const itemCode = extractSpCode(item);
      if (
        (itemCode && itemCode === target) ||
        item.startsWith(target) ||
        item.startsWith(`K${target}`)
      ) {
        if (!matched.includes(item)) {
          matched.push(item);
        }
      }
    }
  }

  // Fallback to first SP if none matched
  if (matched.length === 0 && availableSps.length > 0) {
    matched.push(availableSps[0]);
  }

  return matched;
}

/**
 * Core Matcher: Match RPT weekly syllabus records with DSKP Standard Kandungan (SK) and Standard Pembelajaran (SP)
 */
export function matchRptWithDskp(
  rptList: RptRecord[],
  weekNumber: number,
  dskpGradeTree: Record<string, string[]> | null
): RptMatchResult {
  const emptyResult: RptMatchResult = {
    rptEntry: null,
    allWeekEntries: [],
    allWeekSkCodes: [],
    allWeekSpCodes: [],
    matchedSkKeys: [],
    selectedSk: '',
    matchedSps: [],
    theme: '',
    remarks: '',
    isMatched: false,
  };

  if (!rptList || rptList.length === 0) {
    if (dskpGradeTree) {
      const keys = Object.keys(dskpGradeTree);
      if (keys.length > 0) {
        emptyResult.selectedSk = keys[0];
        emptyResult.matchedSps = dskpGradeTree[keys[0]]?.slice(0, 1) || [];
      }
    }
    return emptyResult;
  }

  // 1. Filter entries for the target week
  let weekEntries = rptList.filter((e) => e.week_number === weekNumber);

  // If no entry for this exact week (e.g. week 35 when max is 25), pick closest entry
  if (weekEntries.length === 0) {
    const sorted = [...rptList].sort(
      (a, b) =>
        Math.abs(a.week_number - weekNumber) - Math.abs(b.week_number - weekNumber)
    );
    if (sorted.length > 0) {
      weekEntries = [sorted[0]];
    }
  }

  if (weekEntries.length === 0) {
    return emptyResult;
  }

  // Pick primary entry (prefer one that has sk_codes and sp_codes)
  const primaryEntry =
    weekEntries.find((e) => e.sk_codes?.length > 0 && e.sp_codes?.length > 0) ||
    weekEntries.find((e) => e.sk_codes?.length > 0) ||
    weekEntries[0];

  // Aggregate all unique sk_codes and sp_codes for the week
  const allWeekSkCodes: string[] = [];
  const allWeekSpCodes: string[] = [];
  let combinedTheme = primaryEntry.theme || '';
  let combinedRemarks = primaryEntry.remarks || '';

  for (const e of weekEntries) {
    if (e.sk_codes) {
      for (const sc of e.sk_codes) {
        // filter out date patterns like 03.06 or 26.05
        if (!/^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])$/.test(sc)) {
          const norm = sc.replace(/^[A-Za-z]+/, '').trim();
          if (norm && !allWeekSkCodes.includes(norm)) {
            allWeekSkCodes.push(norm);
          }
        }
      }
    }
    if (e.sp_codes) {
      for (const sp of e.sp_codes) {
        const norm = sp.replace(/^[A-Za-z]+/, '').trim();
        if (norm && !allWeekSpCodes.includes(norm)) {
          allWeekSpCodes.push(norm);
        }
      }
    }
    if (!combinedTheme && e.theme) combinedTheme = e.theme;
    if (!combinedRemarks && e.remarks) combinedRemarks = e.remarks;
  }

  // Add parent SK codes derived from SP codes (e.g. SP "1.1.1" -> SK "1.1")
  for (const sp of allWeekSpCodes) {
    const parts = sp.split('.');
    if (parts.length >= 2) {
      const parentSk = `${parts[0]}.${parts[1]}`;
      if (!allWeekSkCodes.includes(parentSk)) {
        allWeekSkCodes.push(parentSk);
      }
    }
  }

  if (!dskpGradeTree) {
    return {
      rptEntry: primaryEntry,
      allWeekEntries: weekEntries,
      allWeekSkCodes,
      allWeekSpCodes,
      matchedSkKeys: [],
      selectedSk: '',
      matchedSps: [],
      theme: combinedTheme,
      remarks: combinedRemarks,
      isMatched: true,
    };
  }

  const dskpKeys = Object.keys(dskpGradeTree);
  if (dskpKeys.length === 0) {
    return {
      ...emptyResult,
      rptEntry: primaryEntry,
      allWeekEntries: weekEntries,
      allWeekSkCodes,
      allWeekSpCodes,
      theme: combinedTheme,
      remarks: combinedRemarks,
    };
  }

  // Sort DSKP keys: standard keys first, PKJR keys after
  const sortedDskpKeys = [...dskpKeys].sort((a, b) => {
    const aPkjr = a.startsWith('(PKJR)') ? 1 : 0;
    const bPkjr = b.startsWith('(PKJR)') ? 1 : 0;
    return aPkjr - bPkjr;
  });

  // Find all DSKP SK keys that match this week's RPT
  const matchedSkKeys: string[] = [];

  for (const k of sortedDskpKeys) {
    const kc = extractSkCode(k);
    if (kc && allWeekSkCodes.includes(kc)) {
      if (!matchedSkKeys.includes(k)) {
        matchedSkKeys.push(k);
      }
      continue;
    }

    // Direct startsWith prefix check
    for (const sc of allWeekSkCodes) {
      if (k.startsWith(sc + ' ') || k.startsWith(sc + '.')) {
        if (!matchedSkKeys.includes(k)) {
          matchedSkKeys.push(k);
        }
        break;
      }
    }
  }

  // Fallback: If no numerical code matched, search theme keywords in DSKP keys
  if (matchedSkKeys.length === 0 && combinedTheme) {
    const cleanTheme = combinedTheme.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');
    const tokens = cleanTheme.split(/\s+/).filter((t) => t.length >= 3);
    for (const token of tokens) {
      for (const k of sortedDskpKeys) {
        if (k.includes(token) && !matchedSkKeys.includes(k)) {
          matchedSkKeys.push(k);
        }
      }
      if (matchedSkKeys.length > 0) break;
    }
  }

  // Determine primary selected SK
  const selectedSk = matchedSkKeys.length > 0 ? matchedSkKeys[0] : sortedDskpKeys[0];

  // Match SPs under the selected SK
  const availableSps = dskpGradeTree[selectedSk] || [];
  const matchedSps = findMatchingSpsForSk(availableSps, allWeekSpCodes);

  return {
    rptEntry: primaryEntry,
    allWeekEntries: weekEntries,
    allWeekSkCodes,
    allWeekSpCodes,
    matchedSkKeys,
    selectedSk,
    matchedSps,
    theme: combinedTheme,
    remarks: combinedRemarks,
    isMatched: matchedSkKeys.length > 0 || allWeekSkCodes.length > 0,
  };
}

/**
 * Teacher RPT Assignment definition
 */
export interface TeacherRptAssignment {
  id: string;
  teacherId: string;
  subjectSlug: string;
  grade: string;
  subjectName: string;
  className?: string;
  updatedAt?: string;
}

/**
 * Get customized RPT from localStorage if teacher adjusted it, otherwise fetch default public RPT JSON
 */
export async function getEffectiveRpt(
  teacherId: string,
  subjectSlug: string,
  grade: string | number
): Promise<RptRecord[]> {
  const gradeStr = String(grade).replace(/[^0-9]/g, '') || '1';
  if (typeof window !== 'undefined') {
    const customKey = `rph_custom_rpt_${teacherId}_${subjectSlug}_T${gradeStr}`;
    const customData = localStorage.getItem(customKey);
    if (customData) {
      try {
        const parsed = JSON.parse(customData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse custom RPT from localStorage', e);
      }
    }
  }
  return fetchRptJson(subjectSlug, gradeStr);
}

/**
 * Save customized RPT for a teacher to localStorage
 */
export function saveCustomRpt(
  teacherId: string,
  subjectSlug: string,
  grade: string | number,
  records: RptRecord[]
): void {
  if (typeof window !== 'undefined') {
    const gradeStr = String(grade).replace(/[^0-9]/g, '') || '1';
    const customKey = `rph_custom_rpt_${teacherId}_${subjectSlug}_T${gradeStr}`;
    localStorage.setItem(customKey, JSON.stringify(records));
  }
}

/**
 * Reset customized RPT to original public KPM JSON
 */
export function resetCustomRpt(
  teacherId: string,
  subjectSlug: string,
  grade: string | number
): void {
  if (typeof window !== 'undefined') {
    const gradeStr = String(grade).replace(/[^0-9]/g, '') || '1';
    const customKey = `rph_custom_rpt_${teacherId}_${subjectSlug}_T${gradeStr}`;
    localStorage.removeItem(customKey);
  }
}

/**
 * Check if teacher has customized this RPT
 */
export function isCustomRptModified(
  teacherId: string,
  subjectSlug: string,
  grade: string | number
): boolean {
  if (typeof window !== 'undefined') {
    const gradeStr = String(grade).replace(/[^0-9]/g, '') || '1';
    const customKey = `rph_custom_rpt_${teacherId}_${subjectSlug}_T${gradeStr}`;
    return !!localStorage.getItem(customKey);
  }
  return false;
}

/**
 * Retrieve teacher's active RPT subject assignments (auto-seeded from timetable if first time)
 */
export function getTeacherRptAssignments(
  teacherId: string,
  timetableSlots: { teacherId: string; subjectSlug: string; grade: string; subjectName: string; className?: string }[]
): TeacherRptAssignment[] {
  if (typeof window !== 'undefined') {
    const key = `rph_teacher_rpt_assignments_${teacherId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse teacher RPT assignments', e);
      }
    }
  }

  // Initial seed from teacher's own timetable slots
  const ownSlots = timetableSlots.filter((s) => s.teacherId === teacherId);
  const seen = new Set<string>();
  const initial: TeacherRptAssignment[] = [];

  for (const s of ownSlots) {
    const uniqueKey = `${s.subjectSlug}_${s.grade}`;
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      initial.push({
        id: `rpt_assign_${teacherId}_${uniqueKey}`,
        teacherId,
        subjectSlug: s.subjectSlug,
        grade: s.grade,
        subjectName: s.subjectName,
        className: s.className || `Tahun ${s.grade}`,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // If still empty (e.g. new teacher with no timetable slots yet), default to BC T4
  if (initial.length === 0) {
    initial.push({
      id: `rpt_assign_${teacherId}_bahasa_cina_sjkc_4`,
      teacherId,
      subjectSlug: 'bahasa_cina_sjkc',
      grade: '4',
      subjectName: 'BAHASA CINA SJKC 华校华语',
      className: '4 Merah',
      updatedAt: new Date().toISOString(),
    });
  }

  return initial;
}

/**
 * Save teacher's active RPT subject assignments
 */
export function saveTeacherRptAssignments(
  teacherId: string,
  assignments: TeacherRptAssignment[]
): void {
  if (typeof window !== 'undefined') {
    const key = `rph_teacher_rpt_assignments_${teacherId}`;
    localStorage.setItem(key, JSON.stringify(assignments));
  }
}

/**
 * Resolve full descriptive text of an SK code from DSKP tree
 */
export function resolveFullSkText(
  skCode: string,
  dskpGradeTree: Record<string, string[]> | null
): string {
  if (!dskpGradeTree || !skCode) return skCode;
  const norm = skCode.replace(/^[A-Za-z]+/, '').trim();
  for (const k of Object.keys(dskpGradeTree)) {
    const kc = extractSkCode(k);
    if (kc === norm || k.startsWith(norm + ' ') || k.startsWith(norm + '.')) {
      return k;
    }
  }
  return skCode;
}

/**
 * Resolve full descriptive text of an SP code from DSKP tree
 */
export function resolveFullSpText(
  spCode: string,
  dskpGradeTree: Record<string, string[]> | null
): string {
  if (!dskpGradeTree || !spCode) return spCode;
  const norm = spCode.replace(/^[A-Za-z]+/, '').trim();
  for (const spList of Object.values(dskpGradeTree)) {
    for (const item of spList) {
      const itemCode = extractSpCode(item);
      if (
        itemCode === norm ||
        item.startsWith(norm + ' ') ||
        item.startsWith(norm + '.') ||
        item.startsWith(`K${norm}`)
      ) {
        return item;
      }
    }
  }
  return spCode;
}

/**
 * Open printable formatted window for full year RPT
 */
export function openPrintableRptWindow(
  subjectName: string,
  grade: string | number,
  teacherName: string,
  schoolName: string,
  rptList: RptRecord[],
  dskpGradeTree?: Record<string, string[]> | null
): void {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Sila benarkan pop-up window pelayar anda untuk mencetak RPT.');
    return;
  }

  const rowsHtml = rptList
    .map((r) => {
      const skItems = (r.sk_codes || []).map((sc) => {
        const full = dskpGradeTree ? resolveFullSkText(sc, dskpGradeTree) : sc;
        return `<div style="margin-bottom: 4px;"><strong>${sc}</strong> ${full !== sc ? `<span style="color: #334155;">${full.replace(sc, '').trim()}</span>` : ''}</div>`;
      });

      const spItems = (r.sp_codes || []).map((sp) => {
        const full = dskpGradeTree ? resolveFullSpText(sp, dskpGradeTree) : sp;
        return `<div style="margin-bottom: 4px;">• <strong>${sp}</strong> ${full !== sp ? `<span style="color: #475569;">${full.replace(/^([A-Za-z0-9\.\-]+)\s*/, '')}</span>` : ''}</div>`;
      });

      return `
    <tr>
      <td style="text-align: center; font-weight: bold; width: 75px; vertical-align: top;">${r.week_label || `M.${r.week_number}`}</td>
      <td style="width: 220px; vertical-align: top; font-weight: 600;">${r.theme || '-'}</td>
      <td style="width: 220px; vertical-align: top; font-size: 8.5pt;">${skItems.length > 0 ? skItems.join('') : '-'}</td>
      <td style="width: 280px; vertical-align: top; font-size: 8.5pt;">${spItems.length > 0 ? spItems.join('') : '-'}</td>
      <td style="vertical-align: top; font-size: 8.5pt; color: #475569;">${r.remarks || '-'}</td>
    </tr>
  `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rancangan Pengajaran Tahunan - ${subjectName} (Tahun ${grade})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #0f172a; font-size: 10pt; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0284c7; padding-bottom: 12px; }
    .header h2 { margin: 0 0 6px 0; font-size: 14pt; color: #0369a1; text-transform: uppercase; }
    .header h3 { margin: 0 0 4px 0; font-size: 12pt; color: #334155; }
    .header p { margin: 2px 0; font-size: 9pt; color: #64748b; }
    .meta-box { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 9.5pt; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f1f5f9; color: #1e293b; font-weight: 800; border: 1px solid #cbd5e1; padding: 8px 6px; font-size: 9pt; text-transform: uppercase; }
    td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; font-size: 9pt; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9pt; page-break-inside: avoid; }
    .sign-box { width: 220px; text-align: center; border-top: 1px solid #334155; padding-top: 6px; }
    @media print {
      body { padding: 10px; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${schoolName || 'SJK(C) KEMENTERIAN PENDIDIKAN MALAYSIA'}</h2>
    <h3>RANCANGAN PENGAJARAN TAHUNAN (RPT) KPM</h3>
    <p>Kurikulum Standard Sekolah Rendah (KSSR Semakan) / Kurikulum Persekolahan 2027</p>
  </div>

  <div class="meta-box">
    <div><span>MATA PELAJARAN:</span> ${subjectName}</div>
    <div><span>TAHUN / DARJAH:</span> Tahun ${grade}</div>
    <div><span>GURU PENGAJAR:</span> ${teacherName}</div>
    <div><span>JUMLAH MINGGU:</span> ${rptList.length} Minggu</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 80px;">Minggu</th>
        <th style="width: 200px;">Tema / Topik / Unit</th>
        <th style="width: 140px;">Standard Kandungan (SK)</th>
        <th style="width: 180px;">Standard Pembelajaran (SP)</th>
        <th>Catatan / Sivik / EMK / Aktiviti</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div class="sign-box">
      Disediakan oleh:<br/><br/><br/>
      <strong>(${teacherName})</strong><br/>
      Guru Mata Pelajaran
    </div>
    <div class="sign-box">
      Disemak & Disahkan oleh:<br/><br/><br/>
      <strong>(GURU BESAR / GPK PENTADBIRAN)</strong><br/>
      ${schoolName || 'SJK(C)'}
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
