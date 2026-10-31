/**
 * kspkPresets.ts - Complete Activity Bank & Routines for Prasekolah (KSPK)
 * Covers the 3 mandatory whole-day preschool routine blocks:
 * 1. Perbualan Awal (100 Minit / Minggu)
 * 2. Rehat & Pengurusan Diri (200 Minit / Minggu)
 * 3. Aktiviti Penutup (50 Minit / Minggu)
 */

export interface KspkRoutinePresetItem {
  id: string;
  category: string;
  text: string;
  isDefault?: boolean;
}

export interface KspkRoutineBlock {
  type: 'PERBUALAN_AWAL' | 'REHAT' | 'PENUTUP';
  title: string;
  timeAllocation: string;
  description: string;
  presets: KspkRoutinePresetItem[];
}

export const KSPK_ROUTINE_PRESETS: Record<'PERBUALAN_AWAL' | 'REHAT' | 'PENUTUP', KspkRoutineBlock> = {
  PERBUALAN_AWAL: {
    type: 'PERBUALAN_AWAL',
    title: 'Perbualan Awal (Rutin Pagi)',
    timeAllocation: '100 Minit / Minggu (20 minit sehari)',
    description: 'Rutin asas, sahsiah diri, semakan kehadiran/cuaca, dan sosioemosi pagi.',
    presets: [
      {
        id: 'pa_1',
        category: 'Rutin Asas & Sahsiah',
        text: 'Beratur berdisiplin, memberi salam, bertukar ucapan selamat pagi, dan membaca doa penerang hati.',
        isDefault: true,
      },
      {
        id: 'pa_2',
        category: 'Patriotisme',
        text: 'Menyanyikan lagu Negaraku, lagu negeri, dan lagu prasekolah/sekolah dengan tertib.',
        isDefault: false,
      },
      {
        id: 'pa_3',
        category: 'Pengurusan Kendiri & Kalendar',
        text: 'Merekod kehadiran kendiri, membaca kalendar harian (hari, tarikh, bulan), dan mencatat pemerhatian cuaca semasa.',
        isDefault: true,
      },
      {
        id: 'pa_4',
        category: 'Sosioemosi (Fokus KP2027)',
        text: 'Aktiviti "Roda Emosi" / semakan perasaan (murid meletakkan kad nama pada ikon gembira/sedih/bersemangat).',
        isDefault: true,
      },
      {
        id: 'pa_5',
        category: 'Pemeriksaan Kesihatan & Kebersihan',
        text: 'Semakan kebersihan kuku, rambut, pakaian, dan pemakaian lencana/tanda nama.',
        isDefault: false,
      },
      {
        id: 'pa_6',
        category: 'Literasi Awal & Tema',
        text: 'Perkongsian idea mengikut tema mingguan, tayangan slaid/gambar rangsangan, atau aktiviti "Show and Tell".',
        isDefault: false,
      },
      {
        id: 'pa_7',
        category: 'Peraturan Kelas',
        text: 'Mengingati 5 peraturan asas kelas, ikrar prasekolah, dan pesanan ringkas guru.',
        isDefault: false,
      },
    ],
  },

  REHAT: {
    type: 'REHAT',
    title: 'Rehat & Pengurusan Diri',
    timeAllocation: '200 Minit / Minggu (30-40 minit sehari)',
    description: 'Blok pembelajaran adab pemakanan sihat, kebersihan diri, dan tanggungjawab sifar pembaziran.',
    presets: [
      {
        id: 'rh_1',
        category: 'Kebersihan Tangan',
        text: 'Membasuh tangan menggunakan sabun mengikut teknik 7 langkah sebelum dan selepas makan.',
        isDefault: true,
      },
      {
        id: 'rh_2',
        category: 'Disiplin & Kesabaran',
        text: 'Beratur mengambil hidangan makanan berkhasiat dengan tertib dan duduk di tempat masing-masing.',
        isDefault: false,
      },
      {
        id: 'rh_3',
        category: 'Adab & Nilai Murni',
        text: 'Membaca doa makan bersama guru/PPM, mengamalkan adab sopan, serta tidak bercakap semasa mulut penuh.',
        isDefault: true,
      },
      {
        id: 'rh_4',
        category: 'Pemakanan Sihat & Zero Waste',
        text: 'Memupuk amalan sifar pembaziran (zero waste), menghargai makanan seimbang, dan mengasingkan sisa.',
        isDefault: true,
      },
      {
        id: 'rh_5',
        category: 'Tanggungjawab Kendiri',
        text: 'Mengelap meja makan sendiri dengan tuala basah dan meletakkan mangkuk/sudu ke dalam besen bertingkat.',
        isDefault: true,
      },
      {
        id: 'rh_6',
        category: 'Penjagaan Gigi & Mulut',
        text: 'Menggosok gigi berpandukan carta demonstrasi atau berkumur bersih selepas makan.',
        isDefault: false,
      },
      {
        id: 'rh_7',
        category: 'Hidrasi',
        text: 'Mengisi semula dan minum air kosong daripada botol air masing-masing.',
        isDefault: false,
      },
    ],
  },

  PENUTUP: {
    type: 'PENUTUP',
    title: 'Aktiviti Penutup & Refleksi Harian',
    timeAllocation: '50 Minit / Minggu (10 minit sehari)',
    description: 'Rumusan pembelajaran, penghargaan karakter KP2027, kekemasan ruang, dan adab bersurai.',
    presets: [
      {
        id: 'pn_1',
        category: 'Refleksi Pembelajaran',
        text: 'Sesi soal jawab refleksi apa yang dipelajari dan aktiviti yang paling digemari murid hari ini.',
        isDefault: true,
      },
      {
        id: 'pn_2',
        category: 'Penghargaan Karakter (KP2027)',
        text: 'Guru memberi pujian/bintang atas tingkah laku positif, kerjasama, dan kerajinan murid sepanjang hari.',
        isDefault: true,
      },
      {
        id: 'pn_3',
        category: 'Tanggungjawab Ruang',
        text: 'Mengemas alatan pembelajaran/mainan, menyusun kerusi meja ke tempat asal, dan mengutip sampah di persekitaran.',
        isDefault: true,
      },
      {
        id: 'pn_4',
        category: 'Kekemasan Beg Kendiri',
        text: 'Memeriksa beg sekolah sendiri bagi memastikan buku latihan, botol air, dan bekas makanan tidak tertinggal.',
        isDefault: false,
      },
      {
        id: 'pn_5',
        category: 'Pesanan Keselamatan',
        text: 'Pesanan guru mengenai keselamatan semasa pulang, waktu ketibaan ibu bapa, serta persediaan pakaian/aktiviti esok.',
        isDefault: false,
      },
      {
        id: 'pn_6',
        category: 'Adab Bersurai',
        text: 'Membaca doa penutup, menyanyikan lagu selamat pulang, dan bersalaman / handshake routine dengan guru & PPM.',
        isDefault: true,
      },
    ],
  },
};

/**
 * Helper to get default routines
 */
export function getDefaultKspkRoutineState() {
  return {
    perbualanAwal: KSPK_ROUTINE_PRESETS.PERBUALAN_AWAL.presets.filter((p) => p.isDefault).map((p) => p.text),
    perbualanAwalNote: '',
    rehat: KSPK_ROUTINE_PRESETS.REHAT.presets.filter((p) => p.isDefault).map((p) => p.text),
    rehatNote: '',
    penutup: KSPK_ROUTINE_PRESETS.PENUTUP.presets.filter((p) => p.isDefault).map((p) => p.text),
    penutupNote: '',
  };
}
