# e-RPH SJKC YOK POON (柔佛利民达育本华小)

> **Platform Pengurusan e-RPH Digital, Semakan Pentadbir & Penjana PdP Berasaskan DSKP KPM**  
> Disesuaikan khas untuk pengurusan kurikulum dan jadual waktu SJK(C) dengan antaramuka moden bertema **Murmura UI**, peralihan halaman lancar (*cubic-bezier smooth transition*), sokongan pelbagai bahasa (BC/BM/BI/PAI Jawi RTL), serta integrasi storan awan **Supabase** & **Google Sheets**.

---

## 🌟 Ciri-Ciri Utama Sistem

### 1. 🎨 Antaramuka Moden Bertema Murmura (Desktop & Mobile)
- **Fluid Route Transitions**: Animasi pertukaran tab berasaskan *View Transitions API* & *cubic-bezier(0.2, 0.8, 0.2, 1)* dengan kesan kemunculan berperingkat (*staggered card cascade*).
- **Desktop Floating Dock**: Bar sisi terapung gaya *charcoal dock* (`#16191d`) dengan butang membulat, *spring physics hover*, dan penunjuk aktif warna keemasan (*butter pill*).
- **Mobile Bottom Navigation Bar (`.mnav`)**: Navigasi pantas di bahagian bawah skrin telefon pintar lengkap dengan butang pintasan tengah bertingkat (*raised butter action pill*).
- **Logo Rasmi SJKC Yok Poon**: Logo sekolah disepadukan pada pengepala, bar sisi, halaman log masuk DELIMa, dan skrin pemuatan.

### 2. ⚡ Penjana & Import e-RPH (0-API & AI Engine)
- **DSKP Bertingkat Pantas**: Pemilihan **Tahun → Subjek SJK(C) → SK → SP** menggunakan data JSON statik tanpa sela masa (*0ms latency*).
- **Penjana RPH Pantas (0-API)**: Jana rangka PdP segera dalam Bahasa Cina (简体中文), Bahasa Melayu, Bahasa Inggeris, atau Pendidikan Islam (PAI).
- **Sokongan PAI Tulisan Jawi / Bahasa Arab (RTL)**: Prompt AI khusus yang menyokong penjanaan dan penyuntingan teks dari kanan ke kiri (*Right-to-Left*).
- **Import Mingguan Pukal (Batch 1-Minggu)**: Jana prompt gabungan token `[SLOT:id]` untuk keseluruhan jadual waktu seminggu, kemudian tampal semula hasil respons Gemini / ChatGPT untuk mengimport semua sesi serentak.
- **Penyuntingan Jadual Seperti MS Word**: Paparan jadual PdP anjal auto-skala (*auto-scaling multi-line editor*) yang menyokong enter / perenggan baharu secara lancar.

### 3. 📚 Semakan & Draf e-RPH Guru
- **Penapisan Mengikut Minggu & Hari**: Akses draf sesi PdP mengikut minggu takwim persekolahan (Minggu 1 – 45) dan hari mengajar (Isnin – Jumaat).
- **Hantar Pukal**: Butang satu-klik untuk menghantar semua draf sesi minggu berkenaan kepada pentadbir.
- **Eksport Dokumen**: Muat turun fail `.docx` (Microsoft Word) atau cetak terus ke format cetakan rasmi KPM / PDF.

### 4. 🛡️ Pusat Semakan & Cop Pengesahan Pentadbir (PK1 / Guru Besar)
- **Panel Semakan Guru**: Paparan senarai guru yang telah menghantar e-RPH mengikut minggu persekolahan.
- **Cop Pengesahan Digital**: Pentadbir boleh meletakkan cop pengesahan rasmi berserta tarikh dan ulasan penyeliaan secara individu mahupun pukal.
- **Matriks Tahunan (Yearly Matrix)**: Paparan rekod penghantaran tahunan penuh mengikut guru dan minggu dengan status penghantaran (Tepat, Lewat, Tidak Hantar, Cuti).

### 5. ⚙️ Pengurusan Takwim & Data Guru (Superadmin & Pentadbir)
- **Kawalan Takwim Persekolahan**: Tetapan tarikh Jumaat setiap minggu akademik dan penetapan minggu semasa.
- **Kawalan Keselamatan Pembaharuan Sesi**: Pengesahan bertulis wajib (`BUKA SESI BAHARU`) untuk mengelakkan pemadaman data tahun semasa tanpa sengaja.
- **Pengurusan Roster Guru**: Penetapan peranan sistem (Superadmin, Guru Besar, PK Pentadbiran, Guru ICT/Data, Guru Subjek), No. Kad Pengenalan, dan Panitia Utama dengan sekatan kebenaran mengikut tahap akses.

### 6. 🔐 Keselamatan & Integrasi Awan
- **Log Masuk DELIMa KPM / Google OAuth**: Perlindungan pengesahan pengguna berasaskan senarai putih e-mel rasmi (*whitelisted users*) di pangkalan data Supabase.
- **Penyegerakan Dwi-Arah**: Menggunakan storan tempatan (*instant localStorage fallback*) digandingkan dengan storan awan masa nyata **Supabase Cloud**.
- **Arkib e-RPH Bertahun**: Integrasi Google Apps Script (GAS) untuk mengarkib dan mengguna semula data e-RPH sesi lepas.

---

## 🛠️ Stack Teknologi

- **Frontend Framework**: [Next.js 14](https://nextjs.org/) (App Router, React 18, TypeScript)
- **Gaya & UI**: [Tailwind CSS](https://tailwindcss.com/), CSS Variables bertema Murmura UI, Lucide Icons
- **Tipografi**: Google Font `Urbanist` & Sistem Fon Antarabangsa KPM
- **Pangkalan Data & Autentikasi**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Google OAuth)
- **Format Eksport**: [docx](https://docx.js.org/) (Penjanaan fail Microsoft Word .docx klien)
- **Pelayan / Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 Pemasangan & Pembangunan Tempatan

### 1. Klon Repositori
```bash
git clone https://github.com/yokpoon/my-rph-app2.git
cd my-rph-app2
```

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Konfigurasi Pembolehubah Persekitaran (`.env.local`)
Cipta fail `.env.local` di direktori utama:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Jalankan Pelayan Pembangunan
```bash
npm run dev
```
Buka pelayar anda di [http://localhost:3000](http://localhost:3000).

### 5. Pembinaan Pengeluaran (Build)
```bash
npm run build
npm run start
```

---

## 📂 Struktur Projek Ringkas

```text
my-rph-app2/
├── public/
│   └── dskp/                   # Fail JSON DSKP KPM untuk semua subjek SJKC
├── src/
│   ├── app/
│   │   ├── globals.css         # Tema Murmura UI, animasi cubic-bezier, radial mesh
│   │   ├── layout.tsx          # Pengepala HTML, font Urbanist & tajuk e-RPH SJKC YOK POON
│   │   └── page.tsx            # Aplikasi tunggal e-RPH (SPA berkepantasan tinggi)
│   ├── components/
│   │   └── SidebarIcons.tsx    # Komponen butang dock Murmura & ikon navigasi
│   ├── lib/
│   │   ├── promptEngine.ts     # Penjana prompt AI, format batch mingguan, sokongan RTL PAI
│   │   ├── supabaseClient.ts   # Integrasi pangkalan data Supabase & Google OAuth
│   │   └── wordExport.ts       # Penjana dokumen fail .docx rasmi
│   └── types/
│       └── rph.ts              # Definisi TypeScript untuk profil guru, slot & rekod PdP
└── README.md
```

---

## 📄 Hak Cipta & Lesen

Hak Cipta Terpelihara © SJKC YOK POON (JBC3019).  
Dibangunkan untuk kemudahan para pendidik dan pengurusan pentadbiran sekolah.
