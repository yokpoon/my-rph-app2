// ============================================================================
// MODUL INTEGRASI KARAKTER MURID JOHOR (KrMJ - JPNJ) & NILAI SIVIK KPM
// ============================================================================

export interface KrmjDimension {
  id: string;
  nama_dimensi: string;
  objektif: string;
  nilai_teras: string[];
  amalan_praktikal_rph: string[];
  contoh_catatan_rph: string;
}

export interface SivikSubValue {
  id: string;
  tajuk: string;
  fokus: string[];
}

export interface SivikCoreValue {
  id: string;
  nilai_teras: string;
  penerangan: string;
  sub_nilai: SivikSubValue[];
  dimensi: {
    pengetahuan: string;
    sosioemosi: string;
    tindakan: string;
  };
}

export const KRMJ_METADATA = {
  program: 'Karakter Murid Johor (KrMJ)',
  organisasi: 'Jabatan Pendidikan Negeri Johor (JPNJ)',
  slogan: 'Melahirkan Sahsiah Terpuji, Jati Diri Terserlah',
  deskripsi:
    'Struktur nilai dan dimensi KrMJ untuk integrasi dalam Rancangan Pengajaran Harian (RPH) dan aktiviti persekolahan di negeri Johor.',
  versi: '1.0',
};

export const KRMJ_DIMENSIONS: KrmjDimension[] = [
  {
    id: 'KRMJ-01',
    nama_dimensi: 'Etika & Kerohanian (Adab KrMJ)',
    objektif:
      'Menerapkan nilai adab bertatasusila, kerohanian mampan, dan keikhlasan dalam pergaulan harian.',
    nilai_teras: [
      'Hormat-menghormati',
      'Berterima kasih / Bersyukur',
      'Merendah diri',
      'Keikhlasan',
      'Kesantunan berbahasa',
    ],
    amalan_praktikal_rph: [
      'Amalan 3S (Salam, Syukur, Sayang)',
      'Budaya tunduk hormat ketika berinteraksi dengan guru atau tetamu',
      'Adab mendengar secara aktif dan bertutur secara sopan semasa perbincangan',
      'Mengucapkan terima kasih dan penghargaan sesama rakan kumpulan',
    ],
    contoh_catatan_rph:
      '#KrMJ Etika (Mempraktikkan adab santun berbicara dan menghormati pandangan rakan)',
  },
  {
    id: 'KRMJ-02',
    nama_dimensi: 'Keterampilan & Disiplin Diri',
    objektif:
      'Membentuk sahsiah diri yang kemas, berdisiplin, menepati masa, dan bertanggungjawab terhadap persekitaran.',
    nilai_teras: [
      'Kekemasan diri',
      'Pengurusan masa',
      'Tanggungjawab',
      'Kebersihan',
      'Kepatuhan kepada peraturan',
    ],
    amalan_praktikal_rph: [
      'Memastikan ruang pembelajaran dan meja sentiasa bersih sebelum dan selepas aktiviti',
      'Menepati masa giliran aktiviti stesen/perbentangan PAK-21',
      'Tertib bergerak dan amalan beratur (Keep Left) ketika keluar/masuk kelas',
      'Etika pemakaian baju kemeja KrMJ / uniform yang kemas dan berbutang lengkap',
    ],
    contoh_catatan_rph:
      '#KrMJ Disiplin (Menyelesaikan tugasan mengikut ketetapan masa dan mengemas stesen kerja)',
  },
  {
    id: 'KRMJ-03',
    nama_dimensi: 'Identiti & Budaya Johor',
    objektif:
      'Menyemai rasa bangga terhadap warisan, sejarah Kesultanan Johor, serta memperkukuh semangat muafakat.',
    nilai_teras: [
      'Patriotisme',
      'Muafakat (Kerjasama)',
      'Menghargai warisan & seni budaya',
      'Keharmonian kaum',
      'Kesetiaan kepada raja dan negeri',
    ],
    amalan_praktikal_rph: [
      'Menghayati seni zapin, ghazal, atau warisan tradisi Johor dalam PdP yang berkaitan',
      'Menghayati semangat Lagu Bangsa Johor dengan penuh hormat dan tertib',
      "Menerapkan konsep 'Muafakat Itu Berkat' dalam aktiviti kerja berpasukan",
      'Memahami kepelbagaian kaum dan memelihara perpaduan murid pelbagai latar belakang',
    ],
    contoh_catatan_rph:
      '#KrMJ Identiti (Semangat muafakat dan kerjasama sepasukan dalam menyelesaikan tugasan)',
  },
  {
    id: 'KRMJ-04',
    nama_dimensi: 'Kepimpinan & Komunikasi (Jauhar)',
    objektif:
      'Melahirkan pemimpin muda yang dinamik, berani bersuara secara matang, dan berkebolehan dwibahasa.',
    nilai_teras: [
      'Keberanian berhujah',
      'Dwibahasa (BM & BI)',
      'Kepimpinan teladan',
      'Pemikiran kritis & kreatif',
      'Musyawarah',
    ],
    amalan_praktikal_rph: [
      'Perbentangan kumpulan dengan keyakinan tinggi menggunakan bahasa baku atau Bahasa Inggeris',
      'Mengambil peranan sebagai ketua kumpulan secara bergilir-gilir',
      'Mengemukakan soalan KBAT secara tertib dan bernas',
      'Mendengar pandangan ahli sebelum membuat keputusan kolektif',
    ],
    contoh_catatan_rph:
      '#KrMJ Kepimpinan (Memimpin sesi perbincangan dan membentang dapatan secara dwibahasa)',
  },
  {
    id: 'KRMJ-05',
    nama_dimensi: 'Cergas & Prihatin',
    objektif:
      'Memastikan kecergasan fizikal, kesejahteraan emosi, dan kepekaan sosial terhadap komuniti.',
    nilai_teras: [
      'Kecergasan fizikal & mental',
      'Empati & kasih sayang',
      'Kesukarelawanan',
      'Semangat kesukanan',
      'Prihatin persekitaran',
    ],
    amalan_praktikal_rph: [
      'Penglibatan aktif dalam aktiviti J-Robik dan regangan fizikal',
      'Membantu rakan sekelas yang memerlukan bimbingan tambahan (Rakan Sebaya Membantu)',
      'Menunjukkan sikap toleransi dan adil semasa permainan atau aktiviti simulasi',
      'Menjaga kebajikan dan kelestarian persekitaran sekolah',
    ],
    contoh_catatan_rph:
      '#KrMJ Prihatin (Membantu rakan yang memerlukan bimbingan secara rakan sebaya)',
  },
];

export const NILAI_SIVIK_KPM: SivikCoreValue[] = [
  {
    id: 'KS',
    nilai_teras: 'Kasih Sayang',
    penerangan:
      'Memupuk perasaan cinta, simpati, empati dan belas kasihan kepada diri, keluarga, komuniti serta alam.',
    sub_nilai: [
      {
        id: 'KS_01',
        tajuk: 'Sayangi Diri',
        fokus: ['Penjagaan Kesihatan Diri', 'Kebersihan Fizikal & Mental', 'Keselamatan Diri'],
      },
      {
        id: 'KS_02',
        tajuk: 'Sayangi Keluarga',
        fokus: [
          'Menghormati Ibu Bapa / Ahli Keluarga',
          'Hubungan Kekeluargaan yang Erat',
          'Membantu Keluarga',
        ],
      },
      {
        id: 'KS_03',
        tajuk: 'Sayangi Komuniti & Masyarakat',
        fokus: [
          'Semangat Kejiranan',
          'Empati Golongan Rentan (OKU & Warga Emas)',
          'Prihatin Terhadap Masyarakat',
        ],
      },
      {
        id: 'KS_04',
        tajuk: 'Sayangi Alam Sekitar',
        fokus: [
          'Amalan 3R (Reduce, Reuse, Recycle)',
          'Pemuliharaan Flora & Fauna',
          'Penjimatan Sumber (Air & Elektrik)',
        ],
      },
      {
        id: 'KS_05',
        tajuk: 'Cinta akan Negara',
        fokus: [
          'Bangga dengan Identiti Nasional',
          'Menghargai Warisan Budaya',
          'Mempertahankan Nama Baik Negara',
        ],
      },
    ],
    dimensi: {
      pengetahuan:
        'Mengetahui hak, tanggungjawab, dan peranan dalam menyayangi diri, keluarga, masyarakat serta alam sekitar.',
      sosioemosi:
        'Menzahirkan perasaan sayang, simpati, empati, dan bangga terhadap identiti diri dan komuniti.',
      tindakan:
        'Mengamalkan gaya hidup sihat, menjaga alam sekitar, dan membantu komuniti secara praktikal.',
    },
  },
  {
    id: 'HM',
    nilai_teras: 'Hormat-Menghormati',
    penerangan:
      'Membina sikap menerima, menghargai perbezaan dan mematuhi etika perhubungan serta undang-undang.',
    sub_nilai: [
      {
        id: 'HM_01',
        tajuk: 'Menghormati Kepelbagaian',
        fokus: [
          'Toleransi Kaum & Agama',
          'Menerima Perbezaan Budaya & Bahasa',
          'Kepelbagaian Pendapat',
        ],
      },
      {
        id: 'HM_02',
        tajuk: 'Menghargai Golongan Tertentu',
        fokus: [
          'Menghormati Guru & Pemimpin',
          'Menghargai Warga Emas',
          'Menghormati Rakan Sebaya',
        ],
      },
      {
        id: 'HM_03',
        tajuk: 'Pematuhan Undang-Undang & Peraturan',
        fokus: [
          'Mematuhi Peraturan Sekolah',
          'Etika & Keselamatan Jalan Raya',
          'Undang-Undang Negara',
        ],
      },
      {
        id: 'HM_04',
        tajuk: 'Etika Komunikasi & Digital',
        fokus: [
          'Kesopanan Berbahasa',
          'Etika Media Sosial / Siber',
          'Menolak Buli Siber & Berita Palsu',
        ],
      },
    ],
    dimensi: {
      pengetahuan:
        'Memahami kepentingan mematuhi peraturan, adab berinteraksi, dan kepelbagaian sosiobudaya.',
      sosioemosi:
        'Menghargai pandangan orang lain, berfikiran terbuka, dan peka terhadap sensitiviti kaum/agama.',
      tindakan:
        'Berkomunikasi secara sopan, mematuhi peraturan harian, dan berinteraksi secara harmoni.',
    },
  },
  {
    id: 'BZ',
    nilai_teras: 'Bertanggungjawab',
    penerangan:
      'Memupuk akauntabiliti, disiplin diri, amanah, dan integriti dalam setiap peranan yang digalas.',
    sub_nilai: [
      {
        id: 'BZ_01',
        tajuk: 'Tanggungjawab Sivik & Harta Awam',
        fokus: [
          'Memelihara Kemudahan Awam (Anti-Vandalisme)',
          'Kesedaran Cukai',
          'Mempertahankan Hak Asasi',
        ],
      },
      {
        id: 'BZ_02',
        tajuk: 'Integriti & Kejujuran',
        fokus: [
          'Amanah Melaksanakan Tugas',
          'Menolak Amalan Rasuah & Penipuan',
          'Kejujuran Akademik',
        ],
      },
      {
        id: 'BZ_03',
        tajuk: 'Rajin & Berdisiplin',
        fokus: ['Pengurusan Masa', 'Komitmen Terhadap Tugasan', 'Ketekunan Belajar'],
      },
      {
        id: 'BZ_04',
        tajuk: 'Kesihatan Awam & Kebersihan',
        fokus: [
          'Menjaga Kebersihan Tandas & Bilik Darjah',
          'Mengelakkan Pembaziran Makanan',
          'Amalan Sanitasi',
        ],
      },
    ],
    dimensi: {
      pengetahuan:
        'Mengenal pasti peranan diri, kesan tindakan individu terhadap masyarakat, dan kepentingan integriti.',
      sosioemosi:
        'Rasa bersalah jika melanggar amanah dan bersemangat menyempurnakan tanggungjawab yang diberikan.',
      tindakan:
        'Menyiapkan tugasan tepat pada masa, menjaga harta benda sekolah, dan bertindak secara telus.',
    },
  },
  {
    id: 'KG',
    nilai_teras: 'Kegembiraan',
    penerangan:
      'Mewujudkan suasana positif, rasa syukur, interaksi sihat, dan sokongan moral sesama insan.',
    sub_nilai: [
      {
        id: 'KG_01',
        tajuk: 'Bersyukur',
        fokus: [
          'Menghargai Keamanan Negara',
          'Menghargai Kemudahan & Bantuan',
          'Mensyukuri Nikmat Kehidupan',
        ],
      },
      {
        id: 'KG_02',
        tajuk: 'Berfikiran Positif',
        fokus: [
          'Optimis Menghadapi Masalah',
          'Minda Berkembang (Growth Mindset)',
          'Menangani Tekanan Belajar',
        ],
      },
      {
        id: 'KG_03',
        tajuk: 'Interaksi & Hubungan Mesra',
        fokus: [
          'Budaya Senyum, Sapa & Salam',
          'Komunikasi Ceria & Mesra',
          'Kerjasama Berpasukan yang Positif',
        ],
      },
      {
        id: 'KG_04',
        tajuk: 'Semangat Kesukarelawanan',
        fokus: [
          'Membantu Tanpa Mengharapkan Ganjaran',
          'Menyertai Khidmat Komuniti',
          'Memberi Sokongan Moral',
        ],
      },
    ],
    dimensi: {
      pengetahuan:
        'Memahami konsep emosi positif, rasa syukur, dan nilai menyebarkan kegembiraan kepada orang lain.',
      sosioemosi:
        'Merasai ketenangan jiwa, kepuasan emosi apabila membantu, dan menghargai kebaikan insan lain.',
      tindakan:
        'Mengamalkan budaya 3S (Senyum, Sapa, Salam), memberi pujian ikhlas, dan bekerjasama dengan ceria.',
    },
  },
];

export function getKrmjById(id?: string): KrmjDimension {
  return KRMJ_DIMENSIONS.find((d) => d.id === id) || KRMJ_DIMENSIONS[0];
}

export function getSivikById(coreId?: string, subId?: string): {
  core: SivikCoreValue;
  sub: SivikSubValue;
} {
  const core = NILAI_SIVIK_KPM.find((c) => c.id === coreId) || NILAI_SIVIK_KPM[0];
  const sub = core.sub_nilai.find((s) => s.id === subId) || core.sub_nilai[0];
  return { core, sub };
}
