import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://')
);

// Create Supabase client singleton
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (null as unknown as SupabaseClient);

/**
 * Trigger Google OAuth sign-in via Supabase
 */
export async function signInWithGoogleOAuth() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase URL atau Anon Key belum dikonfigurasi dalam persekitaran (Environment Variables).');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Perform sign out via Supabase
 */
export async function signOutFromSupabase() {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
  }
}

/**
 * ==========================================
 * LIVE CLOUD DATABASE SYNCHRONIZATION (SUPABASE)
 * ==========================================
 */

/**
 * Fetch teachers from live Supabase database
 */
export async function fetchTeachersFromDb() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase.from('teachers').select('*');
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      chineseName: d.chinese_name || '',
      email: d.email,
      role: d.role || 'guru',
      jawatan: d.jawatan,
      panitia: d.panitia || 'Bahasa Cina',
      subjectSlug: d.subject_slug || 'bahasa_cina_sjkc',
    }));
  } catch (e) {
    console.warn('fetchTeachersFromDb note:', e);
    return [];
  }
}

/**
 * Upsert teacher to Supabase
 */
export async function saveTeacherToDb(t: any) {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase.from('teachers').upsert({
      id: t.id,
      name: t.name,
      chinese_name: t.chineseName,
      email: t.email,
      role: t.role,
      jawatan: t.jawatan,
      panitia: t.panitia,
      subject_slug: t.subjectSlug,
    });
    if (error) {
      console.warn('saveTeacherToDb error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('saveTeacherToDb note:', e);
    return false;
  }
}

/**
 * Delete teacher from Supabase
 */
export async function deleteTeacherFromDb(id: string) {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    await supabase.from('teachers').delete().eq('id', id);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Fetch all RPH records from Supabase
 */
export async function fetchRphRecordsFromDb() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase.from('rph_records').select('*');
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      slotId: d.slot_id || 'slot_' + d.id,
      teacherId: d.teacher_id,
      weekNumber: d.week_number,
      day: d.day_of_week || 'Isnin',
      date: d.date || '',
      subject: d.subject || 'Mata Pelajaran',
      subjectSlug: d.subject_slug || 'bahasa_cina_sjkc',
      subjectName: d.subject || 'Mata Pelajaran',
      grade: d.grade || '4',
      className: d.class_name || '4A',
      studentCount: d.student_count || 30,
      timeStart: d.start_time || '08:00',
      timeEnd: d.end_time || '09:00',
      theme: d.theme || '',
      topic: d.topic || '',
      sk: Array.isArray(d.sk) ? d.sk.join(', ') : (d.sk || ''),
      sps: Array.isArray(d.sp) ? d.sp : [],
      objectives: Array.isArray(d.objektif) ? d.objektif : [],
      criteria: Array.isArray(d.kriteria) ? d.kriteria : ['Murid dapat menguasai objektif pembelajaran.'],
      induction: d.induksi || 'Guru menarik perhatian murid dengan set induksi.',
      activities: Array.isArray(d.aktiviti) ? d.aktiviti : [],
      closure: d.penutup || 'Guru membuat rumusan PdP bersama murid.',
      emk: Array.isArray(d.emk) ? d.emk : ['Nilai Murni'],
      bbm: Array.isArray(d.bbm) ? d.bbm : ['Buku Teks SJK(C)'],
      assessment: d.penilaian || 'PBD',
      reflection: d.refleksi || '',
      status: d.status || 'DRAF',
      verifiedBy: d.verified_by || undefined,
      verifierFeedback: d.verifier_feedback || undefined,
      verifiedAt: d.verified_at || undefined,
      pedagogy: d.pedagogy || 'Biasa',
      updatedAt: d.status_updated_at || d.created_at,
    }));
  } catch (e) {
    console.warn('fetchRphRecordsFromDb note:', e);
    return [];
  }
}

/**
 * Upsert RPH record to Supabase
 */
export async function saveRphRecordToDb(r: any) {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase.from('rph_records').upsert({
      id: r.id,
      teacher_id: r.teacherId,
      slot_id: r.slotId,
      academic_year: '2026/2027',
      week_number: r.weekNumber,
      day_of_week: r.day,
      date: r.date,
      subject: r.subject || r.subjectName,
      subject_slug: r.subjectSlug,
      class_name: r.className,
      student_count: r.studentCount || 30,
      start_time: r.timeStart,
      end_time: r.timeEnd,
      theme: r.theme,
      topic: r.topic,
      sk: Array.isArray(r.sk) ? r.sk : [r.sk].filter(Boolean),
      sp: r.sps || [],
      objektif: r.objectives || [],
      kriteria: r.criteria || [],
      induksi: r.induction || '',
      aktiviti: r.activities || [],
      penutup: r.closure || '',
      emk: r.emk || [],
      bbm: r.bbm || [],
      penilaian: r.assessment || '',
      refleksi: r.reflection || '',
      status: r.status || 'DRAF',
      verified_by: r.verifiedBy || null,
      verifier_feedback: r.verifierFeedback || null,
      verified_at: r.verifiedAt || null,
      status_updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn('saveRphRecordToDb error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('saveRphRecordToDb note:', e);
    return false;
  }
}

/**
 * Fetch timetable slots from Supabase
 */
export async function fetchTimetableFromDb() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase.from('timetable_slots').select('*');
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      teacherId: d.teacher_id,
      day: d.day_of_week || d.day,
      timeStart: d.start_time || d.timeStart,
      timeEnd: d.end_time || d.timeEnd,
      subject: d.subject,
      subjectSlug: d.subject_slug || d.subjectSlug || 'bahasa_cina_sjkc',
      subjectName: d.subject || 'Mata Pelajaran',
      grade: d.grade || '1',
      className: d.class_name || d.className,
      studentCount: d.student_count || d.studentCount || 30,
      defaultSk: d.sk || '1.1 Kemahiran Asas',
      defaultSps: Array.isArray(d.sp) ? d.sp : [],
    }));
  } catch (e) {
    console.warn('fetchTimetableFromDb note:', e);
    return [];
  }
}

/**
 * Save timetable slot to Supabase
 */
export async function saveTimetableSlotToDb(s: any) {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase.from('timetable_slots').upsert({
      id: s.id,
      teacher_id: s.teacherId,
      day_of_week: s.day,
      start_time: s.timeStart,
      end_time: s.timeEnd,
      subject: s.subject || s.subjectName,
      subject_slug: s.subjectSlug,
      grade: s.grade,
      class_name: s.className,
      student_count: s.studentCount || 30,
    });
    if (error) {
      console.warn('saveTimetableSlotToDb error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('saveTimetableSlotToDb note:', e);
    return false;
  }
}

/**
 * Delete timetable slot from Supabase
 */
export async function deleteTimetableSlotFromDb(id: string) {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    await supabase.from('timetable_slots').delete().eq('id', id);
    return true;
  } catch (e) {
    return false;
  }
}
