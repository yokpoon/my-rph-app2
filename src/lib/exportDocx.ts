import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import {
  RphRecord,
  TeacherProfile,
  AcademicWeek,
  MatrixCellRecord,
  PenyemakGroupDef,
} from './mockData';

const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '94A3B8',
};

const tableBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

function createDocxRow(label: string, content: string | string[], isBulleted: boolean = false): TableRow {
  const items = Array.isArray(content) ? content : [content];
  const paragraphs = items.map((item, idx) => {
    const prefix = Array.isArray(content) ? (isBulleted ? '• ' : `${idx + 1}. `) : '';
    return new Paragraph({
      children: [
        new TextRun({
          text: `${prefix}${item}`,
          size: 20, // 10pt
          font: 'Arial',
        }),
      ],
      spacing: { after: 60 },
    });
  });

  return new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        borders: tableBorders,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 20,
                font: 'Arial',
                color: '1E293B',
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 72, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: paragraphs,
      }),
    ],
  });
}

export async function exportSingleRphToDocx(rph: RphRecord, schoolName: string = 'SJK(C) FOON YEW 1') {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `RANCANGAN PENGAJARAN HARIAN (e-RPH) — ${schoolName}`,
                bold: true,
                size: 24,
                font: 'Arial',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createDocxRow('Minggu / Hari / Masa', `Minggu ${rph.weekNumber} | ${rph.day} (${rph.date}) | ${rph.timeStart} - ${rph.timeEnd}`),
              createDocxRow('Kelas & Mata Pelajaran', `${rph.className} — ${rph.subjectName}`),
              createDocxRow('Standard Kandungan (SK)', rph.sk),
              createDocxRow('Standard Pembelajaran (SP)', rph.sps, true),
              createDocxRow('Objektif Pembelajaran', rph.objectives, true),
              createDocxRow('Kriteria Kejayaan', rph.criteria, true),
              createDocxRow('Set Induksi', rph.induction),
              createDocxRow('Aktiviti Utama PdP (PAK-21)', rph.activities, false),
              createDocxRow('Penutup', rph.closure),
              createDocxRow('Elemen Merentas Kurikulum (EMK)', rph.emk.join(', ')),
              createDocxRow('Bahan Bantu Mengajar (BBM)', rph.bbm.join(', ')),
              createDocxRow('Pentaksiran Bilik Darjah (PBD)', rph.assessment),
              createDocxRow('Refleksi / Impak', rph.reflection || '___ / ___ murid mencapai objektif PdP.'),
              createDocxRow(
                'Status Pengesahan Pentadbir',
                rph.status === 'DISAHKAN'
                  ? `DISAHKAN OLEH: ${rph.verifiedBy || 'PK Pentadbiran'} (${rph.verifierFeedback || 'Disemak'})`
                  : `Status Semasa: ${rph.status}`
              ),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeClass = rph.className.replace(/[^a-zA-Z0-9]/g, '_');
  saveAs(blob, `eRPH_M${rph.weekNumber}_${rph.day}_${safeClass}.docx`);
}

export function openPrintableRphWindow(rph: RphRecord, schoolName: string, teacherName: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cetak e-RPH - ${teacherName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 11pt; }
    h2, h4 { text-align: center; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    td { border: 1px solid #64748b; padding: 8px 12px; vertical-align: top; }
    .label { width: 28%; background: #f1f5f9; font-weight: bold; }
    .stamp { margin-top: 20px; padding: 12px; border: 2px dashed #10b981; background: #ecfdf5; color: #065f46; font-size: 10pt; }
  </style>
</head>
<body onload="window.print()">
  <h2>${schoolName}</h2>
  <h4>RANCANGAN PENGAJARAN HARIAN (e-RPH) • MINGGU ${rph.weekNumber}</h4>
  <table>
    <tr><td class="label">Nama Guru</td><td>${teacherName}</td></tr>
    <tr><td class="label">Hari / Tarikh / Masa</td><td>${rph.day} (${rph.date}) • ${rph.timeStart} – ${rph.timeEnd}</td></tr>
    <tr><td class="label">Kelas & Subjek</td><td>${rph.className} • ${rph.subjectName}</td></tr>
    <tr><td class="label">Standard Kandungan (SK)</td><td>${rph.sk}</td></tr>
    <tr><td class="label">Standard Pembelajaran (SP)</td><td>${rph.sps.map((s) => `• ${s}`).join('<br/>')}</td></tr>
    <tr><td class="label">Objektif Pembelajaran</td><td>${rph.objectives.map((o) => `• ${o}`).join('<br/>')}</td></tr>
    <tr><td class="label">Kriteria Kejayaan</td><td>${rph.criteria.map((c) => `• ${c}`).join('<br/>')}</td></tr>
    <tr><td class="label">Set Induksi</td><td>${rph.induction}</td></tr>
    <tr><td class="label">Aktiviti Utama (PAK-21)</td><td>${rph.activities.map((a, i) => `${i + 1}. ${a}`).join('<br/>')}</td></tr>
    <tr><td class="label">Penutup</td><td>${rph.closure}</td></tr>
    <tr><td class="label">EMK & BBM</td><td><b>EMK:</b> ${rph.emk.join(', ')}<br/><b>BBM:</b> ${rph.bbm.join(', ')}</td></tr>
    <tr><td class="label">Pentaksiran (PBD)</td><td>${rph.assessment}</td></tr>
    <tr><td class="label">Refleksi</td><td>${rph.reflection}</td></tr>
  </table>
  ${
    rph.status === 'DISAHKAN'
      ? `<div class="stamp"><b>✓ COP PENGESAHAN DIGITAL PK PENTADBIRAN / GURU BESAR</b><br/>Disahkan oleh: ${rph.verifiedBy}<br/>Ulasan: ${rph.verifierFeedback || '-'}</div>`
      : ''
  }
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}


export function exportYearlyMatrixToCSV(
  schoolName: string,
  academicYear: string,
  teachers: TeacherProfile[],
  weeks: AcademicWeek[],
  matrixRecords: Record<string, Record<number, MatrixCellRecord>>,
  activeWeeksCount: number = 24
) {
  const activeWeeks = weeks.filter((w) => w.dueDateFriday && w.dueDateFriday.trim() !== '');

  const rows: string[][] = [
    [`REKOD PENGHANTARAN E-RPH SESI ${academicYear} - ${schoolName}`],
    ['TARIKH AKHIR HANTAR: SETIAP KHAMIS (KUMP A) / SETIAP JUMAAT (KUMP B)'],
    ['TARIKH JANA LAPORAN', new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })],
    [],
    [
      'BIL',
      'NO KP / PENGENALAN',
      'NAMA GURU',
      'JAWATAN',
      'KUMPULAN PENYEMAK',
      'NAMA PENYEMAK',
      ...activeWeeks.map((w) => {
        const parts = (w.dueDateFriday || '').split('-');
        const dm = parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';
        return `M${w.weekNumber} (${dm})`;
      }),
      'JUMLAH HANTAR',
      'TEPAT MASA',
      'LEWAT HANTAR',
      'TIDAK HANTAR',
      '% KEPATUHAN TEPAT MASA',
    ],
  ];

  teachers.forEach((t, idx) => {
    const tCells = matrixRecords[t.id] || {};
    let onTime = 0;
    let late = 0;
    let missed = 0;

    const weekValues = activeWeeks.map((w) => {
      const cell = tCells[w.weekNumber];
      if (!cell || cell.status === 'BELUM') return '-';
      if (cell.status === 'TEPAT') {
        onTime++;
        return `[✓] ${cell.statusLabel || 'Tepat'}`;
      }
      if (cell.status === 'LEWAT') {
        late++;
        return `[✓] ${cell.statusLabel || 'Lewat'}`;
      }
      if (cell.status === 'TIDAK_HANTAR') {
        missed++;
        return '[X] Tidak Hantar';
      }
      if (cell.status === 'CUTI') {
        return '[Cuti]';
      }
      return '-';
    });

    const totalHantar = onTime + late;
    const denom = totalHantar + missed;
    const pct = denom > 0 ? `${((onTime / denom) * 100).toFixed(1)}%` : '100%';

    rows.push([
      String(idx + 1),
      `\t${t.icNo || ''}`, // tab prefix prevents Excel stripping leading zeros
      t.name,
      t.jawatan || 'GAB',
      t.penyemakGroupName || '',
      t.penyemakName || '',
      ...weekValues,
      String(totalHantar),
      String(onTime),
      String(late),
      String(missed),
      pct,
    ]);
  });

  const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const safeSchool = schoolName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeYear = academicYear.replace('/', '_');
  saveAs(blob, `Rekod_Penghantaran_eRPH_${safeYear}_${safeSchool}.csv`);
}

export function openPrintableYearlyMatrix(
  schoolName: string,
  schoolCode: string,
  schoolAddress: string,
  academicYear: string,
  teachers: TeacherProfile[],
  weeks: AcademicWeek[],
  matrixRecords: Record<string, Record<number, MatrixCellRecord>>,
  penyemakGroups: PenyemakGroupDef[],
  filterGroupName: string = 'SEMUA GURU'
) {
  const activeWeeks = weeks.filter((w) => w.dueDateFriday && w.dueDateFriday.trim() !== '').slice(0, 24);

  const filterLabel = filterGroupName === 'SEMUA GURU' ? 'Semua Guru' : filterGroupName;

  const filteredTeachers =
    filterGroupName === 'SEMUA GURU'
      ? teachers
      : teachers.filter((t) => t.penyemakGroupName === filterGroupName);

  const groupsHtml = penyemakGroups
    .slice(0, 5)
    .map(
      (g) => `
      <div style="flex: 1; min-width: 130px; border: 1px solid ${g.borderHex}; border-radius: 6px; padding: 6px; font-size: 9px; background: #fafafa;">
        <div style="font-weight: 800; color: #1e293b;">${g.title}</div>
        <div style="color: #64748b; font-size: 8px;">${g.code}</div>
        <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">${g.supervisorName}</div>
      </div>
    `
    )
    .join('');

  const tableHeaderDates = activeWeeks
    .map((w) => {
      const parts = (w.dueDateFriday || '').split('-');
      const dm = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}` : '';
      return `<th style="border: 1px solid #cbd5e1; padding: 4px; font-size: 8px; text-align: center; white-space: nowrap;">${dm}</th>`;
    })
    .join('');

  const tableHeaderWeeks = activeWeeks
    .map((w) => {
      return `<th style="border: 1px solid #cbd5e1; padding: 3px; font-size: 8px; text-align: center; background: #f8fafc;">M${w.weekNumber}</th>`;
    })
    .join('');

  const rowsHtml = filteredTeachers
    .map((t, idx) => {
      const tCells = matrixRecords[t.id] || {};
      let onTime = 0;
      let late = 0;
      let missed = 0;

      const cellsHtml = activeWeeks
        .map((w) => {
          const cell = tCells[w.weekNumber];
          if (!cell || cell.status === 'BELUM') {
            return `<td style="border: 1px solid #e2e8f0; padding: 3px; text-align: center; font-size: 8px; color: #94a3b8;">-</td>`;
          }
          if (cell.status === 'TEPAT') {
            onTime++;
            return `<td style="border: 1px solid #86efac; background: #dcfce7; padding: 3px; text-align: center; font-size: 8px; font-weight: 700; color: #166534; white-space: nowrap;">✓ ${cell.statusLabel || 'tepat'}</td>`;
          }
          if (cell.status === 'LEWAT') {
            late++;
            return `<td style="border: 1px solid #67e8f9; background: #cffafe; padding: 3px; text-align: center; font-size: 8px; font-weight: 700; color: #155e75; white-space: nowrap;">✓ ${cell.statusLabel || 'lewat'}</td>`;
          }
          if (cell.status === 'TIDAK_HANTAR') {
            missed++;
            return `<td style="border: 1px solid #fca5a5; background: #fee2e2; padding: 3px; text-align: center; font-size: 8px; font-weight: 700; color: #991b1b; white-space: nowrap;">✗ X</td>`;
          }
          if (cell.status === 'CUTI') {
            return `<td style="border: 1px solid #fde68a; background: #fef3c7; padding: 3px; text-align: center; font-size: 8px; font-weight: 700; color: #92400e;">Cuti</td>`;
          }
          return `<td style="border: 1px solid #e2e8f0; padding: 3px; text-align: center; font-size: 8px; color: #94a3b8;">-</td>`;
        })
        .join('');

      const totalHantar = onTime + late;
      const denom = totalHantar + missed;
      const pct = denom > 0 ? `${((onTime / denom) * 100).toFixed(1)}%` : '100%';

      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 9px; font-weight: bold;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; font-size: 8.5px; font-family: monospace;">${t.icNo || '—'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9px; font-weight: 700; white-space: nowrap;">${t.name}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; font-size: 8.5px; text-align: center;">${t.jawatan || 'GAB'}</td>
          ${cellsHtml}
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 9px; font-weight: bold; background: #f8fafc;">${totalHantar}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 9px; font-weight: 800; color: #166534; background: #f0fdf4;">${pct}</td>
        </tr>
      `;
    })
    .join('');

  const todayStr = new Date().toLocaleDateString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rekod Penghantaran e-RPH Tahunan - ${schoolName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 6mm 8mm 6mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 4px;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .header-left {
      background: #1e3a8a;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
    }
    .header-title {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .header-sub {
      font-size: 8px;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .school-info {
      text-align: center;
    }
    .school-name {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
    }
    .school-sub {
      font-size: 9px;
      color: #475569;
    }
    .current-date {
      background: #ea580c;
      color: #ffffff;
      padding: 4px 8px;
      border-radius: 6px;
      text-align: center;
      font-size: 9px;
      font-weight: 800;
    }
    .legend-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 8px;
      margin: 6px 0;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
    }
    .badge-tepat {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .badge-lewat {
      background: #cffafe;
      color: #155e75;
      border: 1px solid #67e8f9;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .badge-x {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
      padding: 1px 4px;
      border-radius: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      font-size: 9px;
      page-break-inside: avoid;
    }
    .sig-col {
      width: 30%;
      text-align: left;
    }
    .sig-line {
      height: 38px;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-left">
      <div class="header-title">REKOD PENGHANTARAN E-RPH SESI ${academicYear}</div>
      <div class="header-sub">TARIKH AKHIR HANTAR: SETIAP KHAMIS (KUMP A) / SETIAP JUMAAT (KUMP B)</div>
    </div>
    <div class="school-info">
      <div class="school-name">${schoolName}</div>
      <div class="school-sub">${schoolAddress} • KOD SEKOLAH: ${schoolCode}</div>
    </div>
    <div class="current-date">
      <div>TARIKH CETAKAN</div>
      <div style="font-size: 11px; margin-top: 2px;">${todayStr}</div>
    </div>
  </div>


  <div class="legend-bar">
    <span style="font-weight: 800;">PETUNJUK :</span>
    <span class="legend-item"><span class="badge-tepat">[/] tepat</span> TEPAT MASA</span>
    <span class="legend-item"><span class="badge-lewat">[/] lewat</span> LEWAT HANTAR</span>
    <span class="legend-item"><span class="badge-x">[X]</span> TIDAK HANTAR</span>
    <span style="margin-left: auto; color: #64748b;">Tapisan: <b>${filterLabel}</b> (${filteredTeachers.length} Guru)</span>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9px;">BIL</th>
        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9px;">NO KP/PENGENALAN</th>
        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9px;">NAMA GURU</th>
        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9px;">JAWATAN</th>
        ${tableHeaderDates}
        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9px;">JUM HANTAR</th>
        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 4px; font-size: 9px;">% TEPAT</th>
      </tr>
      <tr>
        ${tableHeaderWeeks}
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="sig-row">
    <div class="sig-col">
      <div>Disediakan oleh:</div>
      <div class="sig-line"></div>
      <div style="border-top: 1px solid #475569; padding-top: 2px;">
        <b>Guru Penyelaras ICT & Data / Penolong Kanan</b><br/>
        Tarikh: ${todayStr}
      </div>
    </div>
    <div class="sig-col">
      <div>Disemak oleh:</div>
      <div class="sig-line"></div>
      <div style="border-top: 1px solid #475569; padding-top: 2px;">
        <b>PK Pentadbiran (GPK 1)</b><br/>
        SJK(C) Yok Poon
      </div>
    </div>
    <div class="sig-col">
      <div>Disahkan oleh:</div>
      <div class="sig-line"></div>
      <div style="border-top: 1px solid #475569; padding-top: 2px;">
        <b>Guru Besar / Pengetua</b><br/>
        Cop Rasmi Sekolah
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}



