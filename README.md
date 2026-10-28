# e-RPH SJK(C) — Sistem e-RPH, Semakan Pentadbir

Sistem pengurusan kurikulum & pentadbiran sekolah rendah jenis kebangsaan Cina (**SJKC**) berasaskan **Plan A+**:
1. **e-RPH Dashboard**: Kad metrik gradien, status penghantaran e-RPH mingguan, dan widget Guru Ganti harian.
2. **Penjana e-RPH Pantas (0-API & Gemini Copy-Paste)**:
   - Dropdown bertingkat (**Tahun → Subjek SJK(C) → SK → SP**) menggunakan fail JSON statik (`public/dskp/*.json`) dengan kependaman 0ms.
   - **Jana RPH Pintar Segera (0-API)** dalam Bahasa Cina (简体中文), Bahasa Melayu, atau Bahasa Inggeris mengikut subjek.
   - **Eksport .DOCX (MS Word)** & cetakan PDF mengikut jadual rasmi KPM.
3. **Import RPH Mingguan Sekaligus (Batch 1-Minggu)**:
   - Jana satu prompt gabungan (`[SLOT:id]`) untuk semua waktu mengajar seminggu, tampal semula respons daripada Gemini/ChatGPT, dan siap untuk seluruh minggu dalam 1 klik.
4. **Pusat Semakan & Cop Digital PK Pentadbiran (PK1 / Guru Besar)**:
   - Semak semua sesi RPH guru dalam panel *slide-over*, tulis ulasan pentadbir, dan turunkan **Cop Pengesahan Digital** secara pukal atau individu.
---

## Cara Menjalankan Aplikasi

```bash
cd /Users/jackiewong/Desktop/my-rph-app2
npm install
npm run dev
```

Kemudian buka **[http://localhost:3000](http://localhost:3000)** di pelayar anda.
