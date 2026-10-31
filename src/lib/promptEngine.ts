import { TimetableSlot } from './mockData';
import { getKrmjById, getSivikById } from './krmjAndSivikData';

export interface SinglePromptConfig {
  grade: string;
  className?: string;
  subjectName: string;
  sk: string;
  sps: string[];
  pedagogy?: string;
  customNote?: string;
  // Optional Additional Criteria (KrMJ & Sivik KPM)
  includeKrmj?: boolean;
  krmjId?: string;
  includeSivik?: boolean;
  sivikCoreId?: string;
  sivikSubId?: string;
}

export interface ParsedRphContent {
  objectives: string[];
  criteria: string[];
  induction: string;
  activities: string[];
  closure: string;
  emk: string[];
  bbm: string[];
  assessment: string;
}

export function isPreschool(grade: string, subjectName?: string): boolean {
  const g = (grade || '').toUpperCase();
  const s = (subjectName || '').toLowerCase();
  return g.includes('PRA') || s.includes('prasekolah') || s.includes('kspk');
}

export function isChineseSubject(subjectName: string): boolean {
  const lower = subjectName.toLowerCase();
  return (
    subjectName.includes('华') ||
    lower.includes('cina') ||
    lower.includes('moral') ||
    lower.includes('matematik') ||
    lower.includes('sains') ||
    lower.includes('sejarah') ||
    lower.includes('rbt')
  );
}

export function isEnglishSubject(subjectName: string): boolean {
  return subjectName.toLowerCase().includes('inggeris') || subjectName.toLowerCase().includes('english');
}

export function isJawiOrArabicSubject(subjectName: string): boolean {
  const lower = (subjectName || '').toLowerCase();
  return (
    lower.includes('islam') ||
    lower.includes('pai') ||
    lower.includes('jawi') ||
    lower.includes('arab') ||
    subjectName.includes('ڤنديديقن اسلام') ||
    subjectName.includes('اسلام')
  );
}

/**
 * 1. DETERMINISTIC RULE-BASED RPH GENERATOR (0-API / Instant Offline Mode)
 * Automatically crafts SJK(C) compliant RPH in Chinese, Malay, or English
 * and injects KrMJ (JPNJ) & Nilai Sivik (KPM) when selected.
 */
export function generateDeterministicRph(config: SinglePromptConfig): ParsedRphContent {
  const isPra = isPreschool(config.grade, config.subjectName);

  if (isPra) {
    const sLower = (config.subjectName || '').toLowerCase();
    
    // 1. Routine Slot: Perbualan Awal (100 Minit / Minggu)
    if (sLower.includes('perbualan')) {
      return {
        objectives: [
          'Murid dapat mempraktikkan rutin asas harian dan menyatakan perasaan diri dalam perbualan pagi.',
          'Murid dapat berkomunikasi dan berinteraksi secara sopan bersama guru dan rakan.'
        ],
        criteria: [
          'Murid dapat memberi salam, merekod kehadiran, dan menyatakan emosi harian.',
          'Murid dapat bertutur dengan sopan dan mematuhi peraturan asas kelas.'
        ],
        induction: '',
        activities: [
          '1. Beratur berdisiplin, memberi salam, bertukar ucapan selamat, dan membaca doa ringkas.',
          '2. Merekod kehadiran kendiri, membaca kalendar (hari, tarikh), dan mencatat cuaca semasa.',
          '3. Aktiviti "Roda Emosi" / semakan perasaan murid (meletakkan kad nama pada ikon emosi).',
          '4. Semakan kebersihan diri dan menyanyikan lagu Negaraku / lagu sekolah.',
          '5. Perkongsian idea mengikut tema mingguan dan peringatan peraturan kelas.'
        ],
        closure: '',
        emk: ['Nilai Murni (Disiplin, Hormat)', 'Sosioemosi', 'Patriotisme'],
        bbm: ['Carta Kalendar', 'Roda Emosi', 'Kad Nama Murid', 'Carta Kehadiran'],
        assessment: 'Pemerhatian sahsiah, interaksi lisan & senarai semak adab'
      };
    }

    // 2. Routine Slot: Rehat & Pengurusan Diri (200 Minit / Minggu)
    if (sLower.includes('rehat')) {
      return {
        objectives: [
          'Murid dapat mengamalkan adab pemakanan sihat dan kebersihan diri sebelum serta selepas makan.',
          'Murid dapat mengamalkan tanggungjawab kendiri dan konsep sifar pembaziran (zero waste).'
        ],
        criteria: [
          'Murid dapat mencuci tangan dengan teknik 7 langkah dan membaca doa makan dengan tertib.',
          'Murid dapat mengelap meja makan dan meletakkan alatan ke dalam besen bertingkat selepas makan.'
        ],
        induction: '',
        activities: [
          '1. Membasuh tangan menggunakan sabun mengikut teknik 7 langkah sebelum makan.',
          '2. Beratur mengambil makanan berkhasiat dengan tertib dan membaca doa makan bersama guru/PPM.',
          '3. Makan dengan sopan, menghargai makanan seimbang, dan mengelakkan pembaziran.',
          '4. Mengelap meja makan sendiri dengan tuala basah dan meletakkan alatan ke dalam besen bertingkat.',
          '5. Menggosok gigi/berkumur bersih serta mengisi semula air minuman.'
        ],
        closure: '',
        emk: ['Pendidikan Kesihatan & Kebersihan', 'Nilai Murni (Kesyukuran, Berdikari)', 'Kelestarian Global (Zero Waste)'],
        bbm: ['Sabun Cuci Tangan', 'Tuala Meja', 'Besen Bertingkat', 'Carta 7 Langkah Membasuh Tangan'],
        assessment: 'Pemerhatian amalan kebersihan, pengurusan kendiri & senarai semak adab'
      };
    }

    // 3. Routine Slot: Aktiviti Penutup (50 Minit / Minggu)
    if (sLower.includes('penutup')) {
      return {
        objectives: [
          'Murid dapat membuat refleksi ringkas tentang aktiviti pembelajaran yang dilalui sepanjang hari.',
          'Murid dapat mengemas ruang pembelajaran dan mengamalkan adab bersurai secara tertib.'
        ],
        criteria: [
          'Murid dapat menyatakan aktiviti pembelajaran yang paling digemari hari ini.',
          'Murid dapat mengemas barang peribadi dan alatan kelas serta bersalaman dengan guru/PPM.'
        ],
        induction: '',
        activities: [
          '1. Sesi soal jawab refleksi apa yang dipelajari dan aktiviti yang paling digemari murid hari ini.',
          '2. Guru memberi pujian/bintang atas tingkah laku positif, kerjasama, dan kerajinan murid.',
          '3. Mengemas alatan permainan/pembelajaran, menyusun kerusi meja, dan mengutip sampah di lantai.',
          '4. Memeriksa beg sekolah sendiri bagi memastikan buku, botol air, dan bekas makanan tidak tertinggal.',
          '5. Membaca doa penutup, menyanyikan lagu selamat pulang, dan bersalaman / handshake routine bersama guru & PPM.'
        ],
        closure: '',
        emk: ['Nilai Murni (Berdikari, Bertanggungjawab)', 'Sosioemosi', 'Komunikasi'],
        bbm: ['Carta Ganjaran / Bintang Karakter', 'Lagu Selamat Pulang', 'Doa Penutup'],
        assessment: 'Pemerhatian refleksi lisan, kekemasan kendiri & adab bersurai'
      };
    }
    const spText = config.sps.join('; ') || 'Standard Pembelajaran Prasekolah';
    const isChinese = isChineseSubject(config.subjectName);
    const isEnglish = isEnglishSubject(config.subjectName);

    if (isChinese) {
      return {
        objectives: [
          `在教学活动结束前，幼儿能够根据所学标准：${spText}。`,
          `幼儿能够在教师引导及同侪互动下，积极参与并完成课堂游戏或操作任务。`,
        ],
        criteria: [
          `幼儿能够听懂指令并尝试回答或完成 1 项关键操作任务。`,
          `幼儿能够自信地与同伴互动并展示学习成果。`,
        ],
        induction: '',
        activities: [
          `1. 教师展示趣味实物/多媒体绘本图片，激发幼儿对主题的好奇心与旧经验。`,
          `2. 教师示范关键技能与动作，引导幼儿轮流模仿与观察。`,
          `3. 幼儿分组或个别进行趣味感官探索与操作活动，体验学习乐趣。`,
          `4. 幼儿在教师鼓励下展示自己的作品或表达想法，建立自信心。`,
          `5. 教师与幼儿回顾今日活动重点，给予星级赞赏与正向回馈。`,
        ],
        closure: '',
        emk: ['道德价值（合作、礼貌）', '创造与革新', '语言能力'],
        bbm: ['实物教具', '词卡与图卡', '感官教具/绘本'],
        assessment: '观察评估（Checklist）、口头问答与幼儿作品展示（Pentaksiran PBD Prasekolah）',
      };
    }

    if (isEnglish) {
      return {
        objectives: [
          `By the end of the lesson, pupils will be able to: ${spText}.`,
          `Pupils will participate actively in guided communicative and hands-on activities.`,
        ],
        criteria: [
          `Pupils can recognize and respond to simple verbal cues or target words with guidance.`,
          `Pupils can perform the hands-on task or sing/chant confidently.`,
        ],
        induction: '',
        activities: [
          `1. Teacher sings a catchy action song or shows flashcards to capture children's interest.`,
          `2. Teacher demonstrates the key skill/target vocabulary through interactive role-play.`,
          `3. Pupils explore learning materials in small groups with teacher guidance.`,
          `4. Pupils take turns to present their work or perform actions to peers.`,
          `5. Teacher recaps target words and praises pupils' active participation.`,
        ],
        closure: '',
        emk: ['Language', 'Values', 'Creativity and Innovation'],
        bbm: ['Flashcards', 'Real-world Objects', 'Storybook / Multimedia'],
        assessment: 'Continuous Classroom Observation & Pupil Artifacts (Preschool PBD)',
      };
    }

    // Default Malay Prasekolah
    return {
      objectives: [
        `Pada akhir pembelajaran, murid dapat: ${spText}.`,
        `Murid dapat melibatkan diri secara aktif dalam aktiviti bermain sambil belajar dengan bimbingan guru.`,
      ],
      criteria: [
        `Murid dapat menyebut atau melakukan sekurang-kurangnya 1 kemahiran asas berdasarkan SP.`,
        `Murid dapat menyempurnakan aktiviti penerokaan atau lembaran kerja secara berdikari atau bersama rakan.`,
      ],
      induction: '',
      activities: [
        `1. Guru memperdengarkan lagu kanak-kanak / menunjukkan objek maujud bagi menarik minat murid terhadap tema pembelajaran.`,
        `2. Guru memberi bimbingan awal, menunjuk cara pelaksanaan aktiviti, dan bersoal jawab secara interaktif.`,
        `3. Murid menjalankan aktiviti penerokaan / manipulatif secara hands-on dalam kumpulan kecil.`,
        `4. Murid berkongsi dan menunjukkan hasil aktiviti kepada rakan sekelas dengan dorongan guru.`,
        `5. Guru mengimbas kembali pembelajaran hari ini serta memberi pujian dan token bintang atas usaha murid.`,
      ],
      closure: '',
      emk: ['Nilai Murni (Berdikari, Kerjasama)', 'Kreativiti dan Inovasi', 'Bahasa'],
      bbm: ['Bahan Maujud', 'Kad Imbasan Bergambar', 'Alatan Manipulatif'],
      assessment: 'Pemerhatian Senarai Semak & Hasil Kerja Murid (Pentaksiran Perkembangan Prasekolah)',
    };
  }

  const spSummary = config.sps.map((s) => s.replace(/^[\d.]+\s*/, '')).join('；');
  const strategy = config.pedagogy || 'PAK-21 Think-Pair-Share & 合作学习';

  const krmj = config.includeKrmj ? getKrmjById(config.krmjId) : null;
  const sivik = config.includeSivik ? getSivikById(config.sivikCoreId, config.sivikSubId) : null;

  if (isChineseSubject(config.subjectName)) {
    const objectives = [
      `在本课结束前，学生能够准确理解并掌握：${spSummary}。`,
      `学生能够在小组活动（${strategy}）中积极参与并完成至少 3 项课堂巩固任务。`,
    ];
    const activities = [
      `步骤 1（概念讲解与示范）：教师结合课本与多媒体演示，详细讲解「${config.sk.slice(0, 28)}...」的核心概念。`,
      `步骤 2（${strategy}）：学生分组针对「${spSummary.slice(0, 35)}...」进行互动探究，并在迷你白板上记录讨论结果。`,
      `步骤 3（展示与评估）：各组代表汇报成果，教师利用 Traffic Light 信号卡进行即时形成性评估（PBD）并给予反馈。`,
    ];
    const emk = ['道德价值（分工合作、礼貌）', '创造与革新元素', '信息与通信技术 (TMK)'];

    if (krmj) {
      activities.push(
        `步骤 4（柔佛学生品格 KrMJ - ${krmj.id}）：${krmj.contoh_catatan_rph} — ${krmj.amalan_praktikal_rph[0]}。`
      );
      emk.push(`Nilai KrMJ (${krmj.id}: ${krmj.nama_dimensi})`);
    }
    if (sivik) {
      objectives.push(
        `[公民教育 Sivik - ${sivik.core.nilai_teras} (${sivik.sub.tajuk})] 认知：${sivik.core.dimensi.pengetahuan} | 情感：${sivik.core.dimensi.sosioemosi} | 行动：${sivik.core.dimensi.tindakan}`
      );
      activities.push(
        `公民素养实践（Amalan Sivik - ${sivik.sub.tajuk}）：学生在活动与生活中实践「${sivik.sub.fokus.join('、')}」。`
      );
      emk.push(`Nilai Sivik KPM: ${sivik.core.nilai_teras} (${sivik.sub.tajuk})`);
    }

    return {
      objectives,
      criteria: [
        `低阶达标（Aras Rendah）：在教师引导下完成至少 1 项基本概念辨识。`,
        `中阶达标（Aras Sederhana）：独立完成课堂练习并达到 80% 准确率。`,
        `高阶达标（Aras Tinggi）：能向同侪解释学习重点并完成高阶思维（KBAT）延伸题。`,
      ],
      induction: `教师展示与本课主题相关的生活情境图/短视频，通过提问激发学生的已有经验并导入今日课题（5分钟）。`,
      activities,
      closure: `师生共同总结今日所学重点，教师表扬表现优异的组别并布置巩固作业（5分钟）。`,
      emk,
      bbm: ['SJK(C) 课本与作业簿', '多媒体演示文稿 (PPT)', '迷你白板与马克笔', '活动学习单'],
      assessment: '随堂观察、口头问答及书面练习评估 (PBD TP1–TP6)',
    };
  }

  if (isEnglishSubject(config.subjectName)) {
    const objectives = [
      `By the end of the lesson, pupils will be able to: ${config.sps.join('; ')}.`,
      `Pupils will be able to participate actively in ${strategy} and complete at least 3 guided tasks accurately.`,
    ];
    const activities = [
      `Step 1 (Presentation): Teacher introduces key language structures based on "${config.sk}" using interactive slides.`,
      `Step 2 (Practice - ${strategy}): Pupils work in pairs/groups to practice the target language and complete the information-gap activity.`,
      `Step 3 (Production & PBD): Pupils present their work to the class; teacher conducts formative assessment and provides feedback.`,
    ];
    const emk = ['Language', 'Values (Cooperation)', 'Creativity and Innovation'];

    if (krmj) {
      activities.push(
        `Step 4 (KrMJ Integration - ${krmj.id}): ${krmj.contoh_catatan_rph} (${krmj.amalan_praktikal_rph[0]}).`
      );
      emk.push(`Nilai KrMJ (${krmj.id}: ${krmj.nama_dimensi})`);
    }
    if (sivik) {
      objectives.push(
        `[Civic Education - ${sivik.core.nilai_teras}: ${sivik.sub.tajuk}] Knowledge: ${sivik.core.dimensi.pengetahuan} | Socioemotional: ${sivik.core.dimensi.sosioemosi} | Action: ${sivik.core.dimensi.tindakan}`
      );
      activities.push(
        `Civic Practice (${sivik.sub.tajuk}): Pupils demonstrate civic values focusing on ${sivik.sub.fokus.join(', ')}.`
      );
      emk.push(`Nilai Sivik KPM: ${sivik.core.nilai_teras} (${sivik.sub.tajuk})`);
    }

    return {
      objectives,
      criteria: [
        `Low Level: Identify at least 2 key vocabulary items with teacher support.`,
        `Mid Level: Construct and present 3 simple sentences accurately in pairs.`,
        `High Level: Complete the extended communicative task independently with confidence.`,
      ],
      induction: `Teacher shows visual flashcards/short video clip related to the topic and asks warm-up questions to activate prior knowledge (5 mins).`,
      activities,
      closure: `Pupils recap key vocabulary learned today through a quick exit-ticket game (5 mins).`,
      emk,
      bbm: ['CEFR English Textbook', 'Presentation Slides', 'Flashcards', 'Task Worksheet'],
      assessment: 'Observation, Oral Presentation & Written Worksheet (PBD TP1–TP6)',
    };
  }

  // Default: Bahasa Melayu SJK(C)
  const objectives = [
    `Pada akhir PdP, murid dapat: ${config.sps.join('; ')}.`,
    `Murid dapat melaksanakan aktiviti ${strategy} secara berkumpulan dengan betul dan bertatasusila.`,
  ];
  const activities = [
    `Langkah 1 (Penerangan): Guru menerangkan konsep "${config.sk}" menggunakan slaid interaktif dan buku teks.`,
    `Langkah 2 (Aktiviti PAK-21 - ${strategy}): Murid bergerak dalam kumpulan kecil untuk berbincang dan melengkapkan tugasan berdasarkan SP.`,
    `Langkah 3 (Pengukuhan & PBD): Wakil kumpulan membentangkan hasil kerja; guru membuat pentaksiran bilik darjah (PBD) dan ulasan.`,
  ];
  const emk = ['Nilai Murni (Kerjasama, Kerajinan)', 'Bahasa', 'Kemahiran Berfikir Aras Tinggi (KBAT)'];

  if (krmj) {
    activities.push(
      `Langkah 4 (Penerapan KrMJ - ${krmj.id}): ${krmj.contoh_catatan_rph} — ${krmj.amalan_praktikal_rph[0]}.`
    );
    emk.push(`Nilai KrMJ (${krmj.id}: ${krmj.nama_dimensi})`);
  }
  if (sivik) {
    objectives.push(
      `[Pendidikan Sivik - ${sivik.core.nilai_teras} (${sivik.sub.tajuk})] Pengetahuan: ${sivik.core.dimensi.pengetahuan} | Sosioemosi: ${sivik.core.dimensi.sosioemosi} | Tindakan: ${sivik.core.dimensi.tindakan}`
    );
    activities.push(
      `Aktiviti Sivik (${sivik.sub.tajuk}): Murid mengaplikasikan amalan sivik berfokuskan ${sivik.sub.fokus.join(', ')}.`
    );
    emk.push(`Nilai Sivik KPM: ${sivik.core.nilai_teras} (${sivik.sub.tajuk})`);
  }

  return {
    objectives,
    criteria: [
      `Aras Rendah: Menyatakan sekurang-kurangnya 1 isi penting dengan bimbingan guru.`,
      `Aras Sederhana: Menjawab 3 soalan pemahaman atau latihan dengan tepat.`,
      `Aras Tinggi: Membina ayat / menghuraikan isi pelajaran secara berdikari tanpa kesalahan.`,
    ],
    induction: `Guru memaparkan gambar rangsangan berkaitan tajuk dan bersoal jawab dengan murid untuk mengaitkan pengetahuan sedia ada (5 minit).`,
    activities,
    closure: `Murid merumuskan isi pelajaran hari ini dengan bimbingan guru serta menerapkan nilai murni (5 minit).`,
    emk,
    bbm: ['Buku Teks BM SJK(C)', 'Slaid Pembentangan', 'Kad Imbasan', 'Lembaran Kerja'],
    assessment: 'Pemerhatian, Lisan & Lembaran Kerja Bertulis (PBD TP1–TP6)',
  };
}

/**
 * 2. SINGLE RPH PROMPT BUILDER FOR GEMINI / CHATGPT WEB (0-API Copy-Paste)
 */
export function buildSingleGeminiPrompt(config: SinglePromptConfig): string {
  const isChinese = isChineseSubject(config.subjectName);
  const isEnglish = isEnglishSubject(config.subjectName);
  const isJawi = isJawiOrArabicSubject(config.subjectName);

  let langRule = 'Gunakan Bahasa Melayu standard KPM sepenuhnya.';
  if (isJawi) {
    langRule = `WAJIB DAN KRITIKAL: Subjek ini adalah Pendidikan Islam (PAI) / Bahasa Arab / Jawi.
1. Hasilkan KESELURUHAN kandungan RPH (Objektif, Kriteria Kejayaan, Set Induksi, Langkah Aktiviti, Penutup, BBM, EMK) dalam Tulisan Jawi (خط جاوي) atau Bahasa Arab yang standard mengikut DSKP Pendidikan Islam KPM.
2. Gunakan aksara Jawi yang tepat dan susun atur mengikut kaedah penulisan Jawi dari KANAN KE KIRI (Right-to-Left / RTL).
3. Kekalkan format tag [OBJEKTIF], [KRITERIA_KEJAYAAN], dan lain-lain tepat seperti yang diminta.`;
  } else if (isChinese) {
    langRule = 'Gunakan Bahasa Cina (Simplified Chinese / 简体中文) sepenuhnya yang sesuai untuk SJK(C).';
  } else if (isEnglish) {
    langRule = 'Use English exclusively conforming to the KPM CEFR syllabus.';
  }

  const extraCriteriaBlocks: string[] = [];

  if (config.includeKrmj) {
    const krmj = getKrmjById(config.krmjId);
    extraCriteriaBlocks.push(`KRITERIA TAMBAHAN 1 — INTEGRASI KARAKTER MURID JOHOR (KrMJ - JPNJ):
- Dimensi Dipilih: [${krmj.id}] ${krmj.nama_dimensi}
- Objektif KrMJ: ${krmj.objektif}
- Nilai Teras KrMJ: ${krmj.nilai_teras.join(', ')}
- Amalan Praktikal PdP: ${krmj.amalan_praktikal_rph.join(' / ')}
- Arahan Wajib RPH:
  1. Dalam bahagian [EMK], masukkan "${krmj.id}: ${krmj.nama_dimensi}".
  2. Dalam bahagian [LANGKAH_AKTIVITI], selitkan tindakan murid yang mencerminkan amalan KrMJ berserta tag "${krmj.contoh_catatan_rph}".`);
  }

  if (config.includeSivik) {
    const { core, sub } = getSivikById(config.sivikCoreId, config.sivikSubId);
    extraCriteriaBlocks.push(`KRITERIA TAMBAHAN 2 — INTEGRASI PENDIDIKAN SIVIK KPM:
- Nilai Teras Sivik: [${core.id}] ${core.nilai_teras} (${core.penerangan})
- Tajuk Sub-Nilai: [${sub.id}] ${sub.tajuk} — Fokus: ${sub.fokus.join(', ')}
- 3 Dimensi Penerapan Sivik:
  • Literasi Sivik (Pengetahuan): ${core.dimensi.pengetahuan}
  • Karakter Sivik (Sosioemosi): ${core.dimensi.sosioemosi}
  • Amalan Sivik (Tindakan): ${core.dimensi.tindakan}
- Arahan Wajib RPH:
  1. Dalam [OBJEKTIF], sertakan objektif Literasi Sivik (Pengetahuan, Sosioemosi, Tindakan).
  2. Dalam [LANGKAH_AKTIVITI], masukkan aktiviti penerapan sivik "${sub.tajuk}".
  3. Dalam [EMK], senaraikan "Nilai Sivik KPM: ${core.nilai_teras} (${sub.tajuk})".`);
  }

  const extraSection =
    extraCriteriaBlocks.length > 0
      ? `\n${extraCriteriaBlocks.join('\n\n')}\n`
      : '';

  const isPra = isPreschool(config.grade, config.subjectName);

  if (isPra) {
    return `Anda adalah pakar perancang kurikulum Prasekolah Kebangsaan KPM (KSPK).
Sila bina Rancangan Pengajaran Harian (RPH) Prasekolah berdasarkan maklumat berikut:

- Peringkat: Prasekolah (KSPK) ${config.className ? `(${config.className})` : ''}
- Mata Pelajaran / Tunjang: ${config.subjectName}
- Standard Kandungan (SK): ${config.sk}
- Standard Pembelajaran (SP):
${config.sps.map((sp, i) => `  ${i + 1}. ${sp}`).join('\n')}
- Pendekatan PdP: ${config.pedagogy || 'Belajar Melalui Bermain & Bertema'}
${config.customNote ? `- Nota Guru: ${config.customNote}` : ''}
${extraSection}
PANDUAN BAHASA:
${langRule}

PANDUAN FORMAT KHAS PRASEKOLAH (KSPK):
1. [OBJEKTIF]: 1-2 objektif pembelajaran prasekolah yang ringkas dan bersesuaian dengan perkembangan kanak-kanak.
2. [KRITERIA_KEJAYAAN]: CUKUP 1 HINGGA 2 KRITERIA SAHAJA (JANGAN buat beza aras Rendah/Sederhana/Tinggi; murid prasekolah tidak dibezakan aras tegar).
3. [LANGKAH_AKTIVITI]: Hasilkan format aliran hari berterusan dalam bentuk senarai nombor 1 hingga 5 (nombor listing 1., 2., 3., 4., 5. SAHAJA, JANGAN masukkan perkataan "Langkah") yang MERANGKUMI KESELURUHAN aktiviti.
4. [EMK], [BBM], [PENTAKSIRAN]: Lengkapkan mengikut DSKP Prasekolah (pemerhatian, senarai semak, hasil kerja).

ARAHAN FORMAT WAJIB:
Balas dengan MENGEKALKAN TAG DI BAWAH secara tepat tanpa teks perbualan tambahan:

===MULA_RPH===
[OBJEKTIF]
• [Objektif 1 ringkas & boleh dicapai]
• [Objektif 2]

[KRITERIA_KEJAYAAN]
• [Kriteria 1 yang jelas]
• [Kriteria 2]

[LANGKAH_AKTIVITI]
1. [Menarik perhatian murid menggunakan bahan maujud/lagu/soal jawab]
2. [Penerangan & tunjuk cara guru secara interaktif]
3. [Murid menjalankan aktiviti hands-on/bermain sambil belajar secara manipulatif]
4. [Murid berkongsi hasil kerja atau bercerita]
5. [Imbas kembali pembelajaran & pujian peneguhan positif]

[EMK]
• [Senaraikan 2-3 Elemen Merentas Kurikulum]

[BBM]
• [Bahan maujud / kad imbasan / alatan sensori]

[PENTAKSIRAN]
• [Pemerhatian / Senarai Semak / Hasil Kerja]
===TAMAT_RPH===`;
  }

  return `Anda adalah pakar perancang kurikulum KPM untuk Sekolah Jenis Kebangsaan Cina (SJKC).
Sila bina Rancangan Pengajaran Harian (RPH) berdasarkan maklumat berikut:

- Sekolah: SJK(C)
- Tahun / Kelas: Tahun ${config.grade} ${config.className ? `(${config.className})` : ''}
- Mata Pelajaran: ${config.subjectName}
- Standard Kandungan (SK): ${config.sk}
- Standard Pembelajaran (SP):
${config.sps.map((sp, i) => `  ${i + 1}. ${sp}`).join('\n')}
- Strategi PAK-21: ${config.pedagogy || 'PAK-21 Berpusatkan Murid'}
${config.customNote ? `- Nota Guru: ${config.customNote}` : ''}
${extraSection}
PANDUAN BAHASA:
${langRule}

ARAHAN FORMAT WAJIB:
Balas dengan MENGEKALKAN TAG DI BAWAH secara tepat tanpa teks perbualan tambahan.

===MULA_RPH===
[OBJEKTIF]
• [Objektif 1 yang spesifik dan boleh diukur]
• [Objektif 2]

[KRITERIA_KEJAYAAN]
• [Kriteria 1 - Aras Rendah]
• [Kriteria 2 - Aras Sederhana]
• [Kriteria 3 - Aras Tinggi]

[SET_INDUKSI]
• [Aktiviti rangsangan 3-5 minit]

[LANGKAH_AKTIVITI]
1. [Langkah 1: Pengenalan & pemodelan]
2. [Langkah 2: Aktiviti PAK-21 murid]
3. [Langkah 3: Latihan pengukuhan & pentaksiran PBD]

[PENUTUP]
• [Rumusan pembelajaran 3-5 minit]

[EMK]
• [Senaraikan 2-3 Elemen Merentas Kurikulum]

[BBM]
• [Senaraikan Bahan Bantu Mengajar]

[PENTAKSIRAN]
• [Kaedah PBD: Pemerhatian / Lisan / Bertulis]
===TAMAT_RPH===`;
}

/**
 * 3. PARSE SINGLE GEMINI RESPONSE
 */
export function parseSingleGeminiResponse(rawText: string, fallbackConfig?: SinglePromptConfig): ParsedRphContent {
  const clean = rawText
    .replace(/```[a-z]*/gi, '')
    .replace(/```/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  const extractSection = (tag: string, nextTagPattern: string): string => {
    const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[(${nextTagPattern})\\]|===TAMAT_RPH===|$)`, 'i');
    const match = clean.match(regex);
    return match ? match[1].trim() : '';
  };

  const cleanList = (block: string): string[] =>
    block
      .split('\n')
      .map((line) => line.replace(/^[\s•\*\-\–\—\d.]+\s*/, '').trim())
      .filter((line) => line.length > 0);

  const objectives = cleanList(extractSection('OBJEKTIF', 'KRITERIA_KEJAYAAN'));
  // Kriteria Kejayaan may directly transition to SET_INDUKSI (KSSR) or LANGKAH_AKTIVITI (Prasekolah)
  const criteria = cleanList(extractSection('KRITERIA_KEJAYAAN', 'SET_INDUKSI|LANGKAH_AKTIVITI'));
  const induction = extractSection('SET_INDUKSI', 'LANGKAH_AKTIVITI').replace(/^[\s•\*\-\–\—]+\s*/, '').trim();
  // Langkah Aktiviti may transition to PENUTUP (KSSR) or EMK (Prasekolah)
  const activities = cleanList(extractSection('LANGKAH_AKTIVITI', 'PENUTUP|EMK'));
  const closure = extractSection('PENUTUP', 'EMK').replace(/^[\s•\*\-\–\—]+\s*/, '').trim();
  const emk = cleanList(extractSection('EMK', 'BBM'));
  const bbm = cleanList(extractSection('BBM', 'PENTAKSIRAN'));
  const assessment = extractSection('PENTAKSIRAN', 'TAMAT').replace(/^[\s•\*\-\–\—]+\s*/, '').trim();

  // If user pasted unstructured text or incomplete tags, merge gracefully with fallback
  if (objectives.length === 0 && activities.length === 0 && fallbackConfig) {
    return generateDeterministicRph(fallbackConfig);
  }

  return {
    objectives: objectives.length > 0 ? objectives : ['Mencapai objektif pembelajaran berdasarkan SP yang ditetapkan.'],
    criteria: criteria.length > 0 ? criteria : ['Murid dapat menyelesaikan tugasan pembelajaran dengan betul.'],
    induction: induction || 'Set induksi 5 minit mengaitkan pengetahuan sedia ada murid.',
    activities: activities.length > 0 ? activities : ['Langkah 1: Penerangan konsep.', 'Langkah 2: Aktiviti kumpulan PAK-21.', 'Langkah 3: Latihan penilaian.'],
    closure: closure || 'Rumusan isi pelajaran dan penerapan nilai murni (5 minit).',
    emk: emk.length > 0 ? emk : ['Nilai Murni', 'Kemahiran Berfikir'],
    bbm: bbm.length > 0 ? bbm : ['Buku Teks', 'Slaid Pembentangan', 'Lembaran Kerja'],
    assessment: assessment || 'Pemerhatian, Lisan & Lembaran Kerja (PBD)',
  };
}

/**
 * 4. WEEKLY BATCH PROMPT BUILDER (Entire Week in One Copy-Paste)
 */
export function buildWeeklyBatchPrompt(
  weekNumber: number,
  teacherName: string,
  slots: TimetableSlot[],
  extraOpts?: {
    includeKrmj?: boolean;
    krmjId?: string;
    includeSivik?: boolean;
    sivikCoreId?: string;
    sivikSubId?: string;
  }
): string {
  const blocks = slots
    .map(
      (s) => `
=== MULA_SESI ===
SLOT_ID: ${s.id}
HARI: ${s.day} (${s.timeStart} - ${s.timeEnd})
KELAS: ${s.className} | SUBJEK: ${s.subjectName}
SK: ${s.defaultSk}
SP: ${s.defaultSps.join('; ')}
=== TAMAT_SESI ===`
    )
    .join('\n');

  const extraLines: string[] = [];
  if (extraOpts?.includeKrmj) {
    const krmj = getKrmjById(extraOpts.krmjId);
    extraLines.push(
      `- INTEGRASI KrMJ (JPNJ): Masukkan elemen [${krmj.id} - ${krmj.nama_dimensi}] serta catatan "${krmj.contoh_catatan_rph}" dalam langkah aktiviti setiap sesi.`
    );
  }
  if (extraOpts?.includeSivik) {
    const { core, sub } = getSivikById(extraOpts.sivikCoreId, extraOpts.sivikSubId);
    extraLines.push(
      `- INTEGRASI PENDIDIKAN SIVIK KPM: Masukkan Nilai Teras "${core.nilai_teras} (${sub.tajuk})" merangkumi Literasi Sivik (Pengetahuan, Sosioemosi, Tindakan) bagi subjek berkaitan.`
    );
  }

  const extraBlock =
    extraLines.length > 0 ? `\nKRITERIA TAMBAHAN WAJIB:\n${extraLines.join('\n')}\n` : '';

  return `Anda adalah pakar perancang RPH KPM untuk SJK(C).
Sila jana Rancangan Pengajaran Harian (RPH) MINGGU ${weekNumber} untuk ${teacherName} bagi SEMUA ${slots.length} sesi di bawah sekaligus.

PERATURAN BAHASA:
- Subjek Pendidikan Islam (PAI) / Bahasa Arab / Jawi: WAJIB jana kandungan dalam Tulisan Jawi (خط جاوي) atau Bahasa Arab mengikut format DSKP dari kanan ke kiri (RTL).
- Subjek Bahasa Cina / Matematik / Sains / Moral / Sejarah / RBT SJK(C): Gunakan Bahasa Cina (简体中文).
- Subjek Bahasa Melayu: Gunakan Bahasa Melayu.
- Subjek Bahasa Inggeris: Gunakan English.
${extraBlock}
SENARAI SESI JADUAL WAKTU:${blocks}

FORMAT BALASAN WAJIB (Ulang blok [SLOT:id] di bawah bagi SETIAP sesi):
=== HASIL_MINGGUAN_MULA ===
[SLOT:id_sesi_di_sini]
[OBJEKTIF]
• Objektif 1
• Objektif 2
[KRITERIA]
• Kriteria 1 (Aras Rendah)
• Kriteria 2 (Aras Sederhana)
• Kriteria 3 (Aras Tinggi)
[INDUKSI]
• Aktiviti set induksi (3-5 minit)
[LANGKAH]
1. Langkah 1
2. Langkah 2 (PAK-21)
3. Langkah 3 (Penilaian PBD)
[PENUTUP]
• Aktiviti penutup (3-5 minit)
[SLOT_SELESAI]
=== HASIL_MINGGUAN_TAMAT ===`;
}

export interface ParsedWeeklyBatchItem {
  slotId: string;
  objectives: string[];
  criteria: string[];
  induction: string;
  activities: string[];
  closure: string;
}

/**
 * 5. PARSE WEEKLY BATCH RESPONSE FROM GEMINI / CHATGPT
 */
export function parseWeeklyBatchResponse(rawText: string): ParsedWeeklyBatchItem[] {
  const clean = rawText.replace(/```[a-z]*/gi, '').replace(/```/g, '').trim();
  const results: ParsedWeeklyBatchItem[] = [];

  const parts = clean.split(/\[SLOT:([a-zA-Z0-9_-]+)\]/i);
  for (let i = 1; i < parts.length; i += 2) {
    const slotId = parts[i].trim();
    const content = parts[i + 1] || '';

    const extract = (tag: string, nextPattern: string): string => {
      const m = content.match(
        new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[(${nextPattern})\\]|\\[SLOT_SELESAI\\]|$)`, 'i')
      );
      return m ? m[1].trim() : '';
    };

    const cleanLines = (b: string): string[] =>
      b
        .split('\n')
        .map((l) => l.replace(/^[\s•\*\-\–\—\d.]+\s*/, '').trim())
        .filter(Boolean);

    results.push({
      slotId,
      objectives: cleanLines(extract('OBJEKTIF', 'KRITERIA')),
      criteria: cleanLines(extract('KRITERIA', 'INDUKSI')),
      induction: extract('INDUKSI', 'LANGKAH').replace(/^[\s•\*\-\–\—]+\s*/, '').trim(),
      activities: cleanLines(extract('LANGKAH', 'PENUTUP')),
      closure: extract('PENUTUP', 'SLOT_SELESAI').replace(/^[\s•\*\-\–\—]+\s*/, '').trim(),
    });
  }

  return results;
}
