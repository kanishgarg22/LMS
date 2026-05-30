import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

export const reportRouter = Router();
reportRouter.use(authenticate);

// GET /api/reports/attendance?month=&year=&format=pdf|xlsx|json
reportRouter.get('/attendance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const format = req.query.format as string || 'json';
    const companyId = req.user!.companyId;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [workers, attendances, company] = await Promise.all([
      prisma.worker.findMany({ where: { companyId, isActive: true }, orderBy: { fullName: 'asc' } }),
      prisma.attendance.findMany({ where: { companyId, date: { gte: start, lte: end } } }),
      prisma.company.findUnique({ where: { id: companyId } }),
    ]);

    const reportData = workers.map(worker => {
      const workerAtts = attendances.filter(a => a.workerId === worker.id);
      const present = workerAtts.filter(a => a.status === 'PRESENT').length;
      const late = workerAtts.filter(a => a.status === 'LATE').length;
      const absent = workerAtts.filter(a => a.status === 'ABSENT').length;
      const halfDay = workerAtts.filter(a => a.status === 'HALF_DAY').length;
      const overtime = workerAtts.filter(a => a.overtime === 'OT').length;
      const overtimeHours = workerAtts.reduce((s, a) => s + (a.overtimeHours ? Number(a.overtimeHours) : 0), 0);

      return {
        name: worker.fullName,
        phone: worker.phone,
        category: worker.category,
        present,
        late,
        absent,
        halfDay,
        overtime,
        overtimeHours,
        totalDays: workerAtts.length,
      };
    });

    if (format === 'json') {
      res.json({ success: true, data: reportData });
      return;
    }

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename=attendance-${month}-${year}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
      return;
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Disposition', `attachment; filename=attendance-${month}-${year}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);

      doc.fontSize(20).text(`${company?.name || 'Company'} - Attendance Report`, { align: 'center' });
      doc.fontSize(12).text(`Month: ${month}/${year}`, { align: 'center' });
      doc.moveDown();

      reportData.forEach(row => {
        doc.fontSize(10)
          .text(`${row.name} | Present: ${row.present} | Absent: ${row.absent} | Late: ${row.late} | OT: ${row.overtimeHours}h`);
      });

      doc.end();
      return;
    }
  } catch (err) { next(err); }
});

// GET /api/reports/salary-slip/:workerId?month=&year=&format=pdf
reportRouter.get('/salary-slip/:workerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workerId } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const format = req.query.format as string || 'json';

    const [worker, payroll, company] = await Promise.all([
      prisma.worker.findFirst({ where: { id: workerId, companyId: req.user!.companyId } }),
      prisma.payrollRecord.findFirst({ where: { workerId, month, year, companyId: req.user!.companyId } }),
      prisma.company.findUnique({ where: { id: req.user!.companyId } }),
    ]);

    if (!worker || !payroll) {
      res.status(404).json({ success: false, error: 'Worker or payroll record not found' });
      return;
    }

    if (format === 'json') {
      res.json({ success: true, data: { worker, payroll, company } });
      return;
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Disposition', `attachment; filename=salary-slip-${worker.fullName}-${month}-${year}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);

      // Header
      doc.fontSize(22).font('Helvetica-Bold').text(company?.name || 'Company', { align: 'center' });
      doc.fontSize(14).font('Helvetica').text('SALARY SLIP', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11).text(`Month: ${month}/${year}   |   Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();
      doc.text(`Employee: ${worker.fullName}`);
      doc.text(`Phone: ${worker.phone}`);
      doc.text(`Category: ${worker.category}`);
      doc.text(`Joining Date: ${new Date(worker.joiningDate).toLocaleDateString()}`);
      doc.moveDown();
      doc.text(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      doc.moveDown();
      doc.text(`ATTENDANCE SUMMARY`).font('Helvetica-Bold');
      doc.font('Helvetica').text(`Working Days: ${payroll.totalDays}`);
      doc.text(`Present Days: ${payroll.presentDays}`);
      doc.text(`Absent Days: ${payroll.absentDays}`);
      doc.text(`Late Days: ${payroll.lateDays}`);
      doc.text(`Half Days: ${payroll.halfDays}`);
      doc.text(`Overtime Hours: ${payroll.overtimeHours}`);
      doc.moveDown();
      doc.text(`SALARY DETAILS`).font('Helvetica-Bold');
      doc.font('Helvetica').text(`Basic Salary: ₹${Number(payroll.basicSalary).toFixed(2)}`);
      doc.text(`Overtime Pay: ₹${Number(payroll.overtimePay).toFixed(2)}`);
      doc.text(`Bonuses: ₹${Number(payroll.bonuses).toFixed(2)}`);
      doc.text(`Advance Deduction: -₹${Number(payroll.advanceDeduction).toFixed(2)}`);
      doc.text(`Other Deductions: -₹${Number(payroll.deductions).toFixed(2)}`);
      doc.moveDown();
      doc.font('Helvetica-Bold').fontSize(14).text(`NET SALARY: ₹${Number(payroll.netSalary).toFixed(2)}`);
      if (payroll.carryForwardNote) {
        doc.fontSize(10).font('Helvetica').text(`Note: ${payroll.carryForwardNote}`);
      }
      doc.text(`Status: ${payroll.isPaid ? '✓ PAID' : '⏳ PENDING'}`);

      doc.end();
      return;
    }
  } catch (err) { next(err); }
});

// GET /api/reports/payroll-summary?month=&year=&format=xlsx
reportRouter.get('/payroll-summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const format = req.query.format as string || 'json';

    const payrolls = await prisma.payrollRecord.findMany({
      where: { companyId: req.user!.companyId, month, year },
      include: { worker: true },
      orderBy: { worker: { fullName: 'asc' } },
    });

    const data = payrolls.map(p => ({
      Name: p.worker.fullName,
      Phone: p.worker.phone,
      Category: p.worker.category,
      'Present Days': p.presentDays,
      'Absent Days': p.absentDays,
      'OT Hours': Number(p.overtimeHours),
      'Basic Salary': Number(p.basicSalary),
      'OT Pay': Number(p.overtimePay),
      'Advance Deduction': Number(p.advanceDeduction),
      'Net Salary': Number(p.netSalary),
      'Status': p.isPaid ? 'Paid' : 'Pending',
    }));

    if (format === 'json') {
      res.json({ success: true, data });
      return;
    }

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename=payroll-${month}-${year}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    }
  } catch (err) { next(err); }
});

// GET /api/reports/worker-attendance/:workerId?from=YYYY-MM-DD&to=YYYY-MM-DD&format=pdf|json
reportRouter.get('/worker-attendance/:workerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workerId } = req.params;
    const format = (req.query.format as string) || 'pdf';

    const toDate   = req.query.to   ? new Date(req.query.to   as string) : new Date();
    const fromDate = req.query.from ? new Date(req.query.from as string)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d; })();
    toDate.setHours(23, 59, 59, 999);

    // Determine which months fall in the range (for payroll lookup)
    const monthSet = new Set<string>();
    const tmp = new Date(fromDate);
    while (tmp <= toDate) {
      monthSet.add(`${tmp.getFullYear()}-${tmp.getMonth() + 1}`);
      tmp.setMonth(tmp.getMonth() + 1);
    }
    const monthFilters = Array.from(monthSet).map(s => {
      const [y, m] = s.split('-').map(Number);
      return { year: y, month: m };
    });

    const [worker, company, attendances, advances, payrolls] = await Promise.all([
      prisma.worker.findFirst({ where: { id: workerId, companyId: req.user!.companyId } }),
      prisma.company.findUnique({ where: { id: req.user!.companyId } }),
      prisma.attendance.findMany({
        where: { workerId, companyId: req.user!.companyId, date: { gte: fromDate, lte: toDate } },
        orderBy: { date: 'asc' },
      }),
      prisma.advance.findMany({
        where: { workerId, companyId: req.user!.companyId, date: { gte: fromDate, lte: toDate } },
        orderBy: { date: 'asc' },
      }),
      monthFilters.length > 0
        ? prisma.payrollRecord.findMany({
            where: { workerId, companyId: req.user!.companyId, OR: monthFilters },
            orderBy: [{ year: 'asc' }, { month: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    if (!worker) { res.status(404).json({ success: false, error: 'Worker not found' }); return; }

    // Group advances by date string
    const advByDate: Record<string, number> = {};
    for (const adv of advances) {
      const ds = adv.date.toISOString().split('T')[0];
      advByDate[ds] = (advByDate[ds] ?? 0) + Number(adv.amount);
    }

    // Build day rows
    const days: { date: string; day: string; status: string; lateMinutes: number; overtimeHours: number; advance: number }[] = [];
    const cur = new Date(fromDate);
    while (cur <= toDate) {
      const ds = cur.toISOString().split('T')[0];
      const att = attendances.find(a => a.date.toISOString().split('T')[0] === ds);
      days.push({
        date: ds,
        day: cur.toLocaleDateString('en-IN', { weekday: 'short' }),
        status: att ? att.status : 'NOT MARKED',
        lateMinutes:  att?.lateMinutes ?? 0,
        overtimeHours: att?.overtimeHours ? Number(att.overtimeHours) : 0,
        advance: advByDate[ds] ?? 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    const totalAdv = advances.reduce((s, a) => s + Number(a.amount), 0);
    const totals = {
      present:   days.filter(d => d.status === 'PRESENT').length,
      absent:    days.filter(d => d.status === 'ABSENT').length,
      late:      days.filter(d => d.status === 'LATE').length,
      halfDay:   days.filter(d => d.status === 'HALF_DAY').length,
      otHours:   days.reduce((s, d) => s + d.overtimeHours, 0),
      totalAdv,
    };

    if (format === 'json') { res.json({ success: true, data: { worker, days, totals, payrolls } }); return; }

    // ─── PDF — strict manual-Y layout (no doc.y drift) ──────────────────
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    res.setHeader('Content-Disposition',
      `attachment; filename=report-${worker.fullName.replace(/\s+/g, '-')}-${req.query.from || 'recent'}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const ML = 36, MR = 36;
    const PW = 595 - ML - MR;   // 523
    const PAGE_H = 842;
    const BOTTOM = PAGE_H - 36; // bottom margin

    // Helper: draw text at exact x,y without any side-effects on doc.y
    const txt = (text: string, x: number, y: number, w: number,
                 opts: { bold?: boolean; size?: number; color?: string; align?: 'left'|'center'|'right' } = {}) => {
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(opts.size ?? 9)
         .fillColor(opts.color ?? '#111111')
         .text(text, x, y, { width: w, lineBreak: false, align: opts.align ?? 'left' });
    };

    let y = 30;

    // ── Page header ─────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 52).fill('#1F2937');
    txt(company?.name || 'Company', ML, 10, PW, { bold: true, size: 16, color: '#FFFFFF', align: 'center' });
    txt('Attendance & Payment Report', ML, 32, PW, { size: 10, color: '#9CA3AF', align: 'center' });
    y = 62;

    // ── Worker info strip ───────────────────────────────────────────────
    doc.rect(ML, y, PW, 40).fill('#F3F4F6');
    txt(`Name: ${worker.fullName}`,  ML + 8, y + 6,  150, { bold: true,  size: 9 });
    txt(`Phone: ${worker.phone}`,    ML + 8, y + 20, 150, { size: 9, color: '#555' });
    txt(`Type: ${worker.category === 'DAILY_WAGE' ? 'Daily Wage' : 'Monthly Salary'}`, ML + 175, y + 6,  160, { size: 9 });
    txt(`From: ${fromDate.toLocaleDateString('en-IN')}`, ML + 175, y + 20, 160, { size: 9, color: '#555' });
    txt(`To:   ${toDate.toLocaleDateString('en-IN')}`,   ML + 340, y + 20, 160, { size: 9, color: '#555' });
    y += 48;

    // ── Summary cards ───────────────────────────────────────────────────
    const cards = [
      { label: 'Present',   val: String(totals.present),              bg: '#DCFCE7', fg: '#14532D' },
      { label: 'Absent',    val: String(totals.absent),               bg: '#FEE2E2', fg: '#991B1B' },
      { label: 'Late',      val: String(totals.late),                  bg: '#FEF3C7', fg: '#92400E' },
      { label: 'Half Day',  val: String(totals.halfDay),              bg: '#DBEAFE', fg: '#1E3A8A' },
      { label: 'OT Hours',  val: totals.otHours.toFixed(1),           bg: '#F3E8FF', fg: '#4C1D95' },
      { label: 'Advances',  val: `Rs.${totalAdv.toFixed(0)}`,         bg: '#FFE4E6', fg: '#9F1239' },
    ];
    const cW = Math.floor(PW / cards.length);
    const cardY = y;
    cards.forEach((card, i) => {
      const cx = ML + i * cW;
      doc.rect(cx, cardY, cW - 2, 38).fill(card.bg);
      txt(card.val,   cx + 2, cardY + 5,  cW - 4, { bold: true, size: 13, color: card.fg, align: 'center' });
      txt(card.label, cx + 2, cardY + 24, cW - 4, { size: 7,  color: card.fg, align: 'center' });
    });
    y = cardY + 44;

    // ── Table setup ─────────────────────────────────────────────────────
    // Columns: Date | Day | Status | Late | OT | Advance | Salary
    const COL = {
      date:   { x: ML,           w: 62 },
      day:    { x: ML + 62,      w: 26 },
      status: { x: ML + 88,      w: 72 },
      late:   { x: ML + 160,     w: 50 },
      ot:     { x: ML + 210,     w: 46 },
      adv:    { x: ML + 256,     w: 65 },
      sal:    { x: ML + 321,     w: PW - 321 + ML - ML }, // fill rest = 523-321=202
    };
    COL.sal.w = PW - (COL.sal.x - ML);

    const HDR_H = 18, ROW_H = 15;
    const SFG: Record<string, string> = { PRESENT: '#14532D', ABSENT: '#991B1B', LATE: '#92400E', HALF_DAY: '#1E3A8A', 'NOT MARKED': '#9CA3AF' };
    const SBG: Record<string, string> = { PRESENT: '#F0FDF4', ABSENT: '#FEF2F2', LATE: '#FFFBEB', HALF_DAY: '#EFF6FF', 'NOT MARKED': '#F9FAFB' };

    // Build a map: "YYYY-M" → payroll record, for the salary column
    const payrollMap: Record<string, typeof payrolls[0]> = {};
    for (const pr of payrolls) { payrollMap[`${pr.year}-${pr.month}`] = pr; }

    const drawTableHeader = (startY: number) => {
      doc.rect(ML, startY, PW, HDR_H).fill('#1F2937');
      const hy = startY + 5;
      txt('Date',      COL.date.x + 2, hy, COL.date.w - 2,   { bold: true, size: 8, color: '#fff' });
      txt('Day',       COL.day.x  + 2, hy, COL.day.w  - 2,   { bold: true, size: 8, color: '#fff' });
      txt('Status',    COL.status.x+2, hy, COL.status.w - 2, { bold: true, size: 8, color: '#fff' });
      txt('Late',      COL.late.x + 2, hy, COL.late.w - 4,   { bold: true, size: 8, color: '#fff', align: 'right' });
      txt('OT Hrs',    COL.ot.x   + 2, hy, COL.ot.w   - 4,   { bold: true, size: 8, color: '#fff', align: 'right' });
      txt('Advance',   COL.adv.x  + 2, hy, COL.adv.w  - 4,   { bold: true, size: 8, color: '#fff', align: 'right' });
      txt('Salary',    COL.sal.x  + 2, hy, COL.sal.w  - 4,   { bold: true, size: 8, color: '#fff', align: 'right' });
      return startY + HDR_H;
    };

    y = drawTableHeader(y);

    days.forEach((d, i) => {
      if (y + ROW_H > BOTTOM) {
        doc.addPage();
        y = 30;
        doc.rect(0, 0, 595, 26).fill('#1F2937');
        txt(company?.name || 'Company', ML, 8, PW, { bold: true, size: 10, color: '#fff', align: 'center' });
        y = 32;
        y = drawTableHeader(y);
      }

      // Alternating row bg tinted by status on even rows
      const bg = i % 2 === 0 ? (SBG[d.status] ?? '#F9FAFB') : '#FFFFFF';
      doc.rect(ML, y, PW, ROW_H).fill(bg);
      // thin bottom border
      doc.moveTo(ML, y + ROW_H).lineTo(ML + PW, y + ROW_H)
         .strokeColor('#E5E7EB').lineWidth(0.3).stroke();

      const ty = y + 3;
      const fg = SFG[d.status] ?? '#374151';

      txt(d.date, COL.date.x + 2, ty, COL.date.w - 2, { size: 8, color: '#374151' });
      txt(d.day,  COL.day.x  + 2, ty, COL.day.w  - 2, { size: 8, color: '#6B7280' });
      txt(d.status.replace(/_/g, ' '), COL.status.x + 2, ty, COL.status.w - 2, { bold: true, size: 8, color: fg });
      txt(d.lateMinutes > 0    ? `${d.lateMinutes}m` : '—',
          COL.late.x + 2, ty, COL.late.w - 4, { size: 8, color: d.lateMinutes > 0 ? '#92400E' : '#9CA3AF', align: 'right' });
      txt(d.overtimeHours > 0  ? d.overtimeHours.toFixed(1) : '—',
          COL.ot.x + 2, ty, COL.ot.w - 4,   { size: 8, color: d.overtimeHours > 0 ? '#4C1D95' : '#9CA3AF', align: 'right' });
      txt(d.advance > 0        ? `Rs.${d.advance}` : '—',
          COL.adv.x + 2, ty, COL.adv.w - 4, { size: 8, color: d.advance > 0 ? '#9F1239' : '#9CA3AF', align: 'right' });

      // Salary column: show month's payroll status if this is the 1st day of the month entry
      const [dYear, dMon] = d.date.split('-').map(Number);
      const pr = payrollMap[`${dYear}-${dMon}`];
      const isFirstDayOfMonth = d.date.endsWith('-01') || days.findIndex(x => {
        const [xy, xm] = x.date.split('-').map(Number);
        return xy === dYear && xm === dMon;
      }) === i;

      if (pr && isFirstDayOfMonth) {
        const salLabel = pr.isPaid ? `Rs.${Number(pr.netSalary).toFixed(0)} PAID` : `Rs.${Number(pr.netSalary).toFixed(0)} DUE`;
        txt(salLabel, COL.sal.x + 2, ty, COL.sal.w - 4,
            { size: 7, bold: pr.isPaid, color: pr.isPaid ? '#14532D' : '#92400E', align: 'right' });
      }

      y += ROW_H;
    });

    // ── Payroll summary footer ───────────────────────────────────────────
    if (payrolls.length > 0) {
      if (y + 20 + payrolls.length * 14 + 24 > BOTTOM) { doc.addPage(); y = 36; }
      y += 10;
      doc.rect(ML, y, PW, 14).fill('#1F2937');
      txt('SALARY SUMMARY', ML + 4, y + 3, PW - 8, { bold: true, size: 8, color: '#fff' });
      y += 14;

      payrolls.forEach((pr, i) => {
        const monthName = new Date(pr.year, pr.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        const bg2 = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
        doc.rect(ML, y, PW, 14).fill(bg2);
        txt(monthName, ML + 4, y + 3, 130, { size: 8 });
        txt(`Basic: Rs.${Number(pr.basicSalary).toFixed(0)}`, ML + 138, y + 3, 90, { size: 8, color: '#374151' });
        txt(`OT: Rs.${Number(pr.overtimePay).toFixed(0)}`,   ML + 232, y + 3, 70, { size: 8, color: '#4C1D95' });
        txt(`Adv: Rs.${Number(pr.advanceDeduction).toFixed(0)}`, ML + 306, y + 3, 70, { size: 8, color: '#9F1239' });
        txt(`Net: Rs.${Number(pr.netSalary).toFixed(0)}`, ML + 378, y + 3, 70, { size: 8, bold: true });
        txt(pr.isPaid ? '✓ PAID' : 'PENDING', ML + 450, y + 3, PW - 454,
            { size: 8, bold: true, color: pr.isPaid ? '#14532D' : '#92400E', align: 'right' });
        y += 14;
      });
    }

    // ── Footer ───────────────────────────────────────────────────────────
    y += 8;
    txt(`Generated on ${new Date().toLocaleString('en-IN')}`, ML, y, PW,
        { size: 7, color: '#9CA3AF', align: 'right' });

    doc.end();
  } catch (err) { next(err); }
});
