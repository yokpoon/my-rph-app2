-- ============================================================================
-- e-RPH SJK(C) - PLAN A+ DATABASE SCHEMA (SUPABASE / POSTGRESQL)
-- Scope: Schools, Teacher/Admin RBAC, Master Timetable, Weekly e-RPH, Relief
-- ============================================================================

-- 1. School Tenant
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- e.g. JBC1001 (SJKC)
    name TEXT NOT NULL,
    academic_year VARCHAR(20) DEFAULT '2026/2027',
    current_week INT DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Teacher & Admin Profiles
CREATE TYPE user_role AS ENUM ('guru', 'pk_pentadbiran', 'guru_besar', 'guru_ict_data');

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    chinese_name TEXT,
    email TEXT UNIQUE NOT NULL,
    panitia TEXT NOT NULL,
    role user_role DEFAULT 'guru',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Master Timetable (Jadual Waktu Induk)
CREATE TABLE timetable_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    day VARCHAR(10) NOT NULL,         -- 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'
    period_number INT NOT NULL,       -- 1 to 10
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    grade VARCHAR(5) NOT NULL,        -- '1' to '6'
    class_name VARCHAR(50) NOT NULL,  -- e.g. '4 Merah (四红班)'
    subject_slug VARCHAR(50) NOT NULL,-- e.g. 'bahasa_cina_sjkc'
    subject_name TEXT NOT NULL        -- e.g. 'Bahasa Cina SJKC 华校华语'
);

-- 4. Weekly e-RPH Records
CREATE TYPE rph_status AS ENUM ('draft', 'submitted', 'verified', 'revision');

CREATE TABLE rph_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES timetable_slots(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    date DATE NOT NULL,
    sk TEXT NOT NULL,
    sps TEXT[] NOT NULL,
    objectives TEXT[] NOT NULL,
    criteria TEXT[] NOT NULL,
    induction TEXT,
    activities TEXT[] NOT NULL,
    closure TEXT,
    emk TEXT[],
    bbm TEXT[],
    assessment TEXT,
    reflection TEXT,
    status rph_status DEFAULT 'draft',
    verified_by UUID REFERENCES profiles(id),
    verifier_feedback TEXT,
    verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, slot_id, week_number)
);

-- 5. Teacher Absences (Rekod Cuti / Kursus)
CREATE TABLE teacher_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day VARCHAR(10) NOT NULL,
    reason TEXT NOT NULL, -- 'Cuti Sakit (MC)', 'CRK', 'Kursus PPD/JPN', 'Urusan Rasmi'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Relief Teacher Assignments (Jadual Guru Ganti)
CREATE TABLE relief_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    slot_id UUID REFERENCES timetable_slots(id) ON DELETE CASCADE,
    absent_teacher_id UUID REFERENCES profiles(id),
    relief_teacher_id UUID REFERENCES profiles(id),
    relief_note TEXT,
    status VARCHAR(20) DEFAULT 'assigned',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
