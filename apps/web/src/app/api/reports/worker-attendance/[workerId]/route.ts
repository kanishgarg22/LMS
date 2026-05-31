import { NextRequest } from 'next/server';
import { prisma, getCompanyId, err } from '@/lib/db';
// eslint-disable-next-line @typescript-eslint/no-require-imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = require('pdfkit') as new (opts?: object) => any;

export async function GET(req: NextRequest, { params }: { params: { workerId: string } }) {
  try {
    const companyId = await getCompanyId();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'pdf';

    const toDate   = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date();
    const fromDate = searchParams.get('from') ? new Date(searchParams.get('from')!) : (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d; })();
    toDate.setHours(23, 59, 59, 999);

    const [worker, company, attendances, advances] = await Promise.all([
      prisma.worker.findFirst({ where: { id: params.workerId, companyId } }),
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.attendance.findMany({ where: { workerId: params.workerId, companyId, date: { gte: fromDate, lte: toDate } }, orderBy: { date: 'asc' } }),
      prisma.advance.findMany({ where: { workerId: params.workerId, companyId, date: { gte: fromDate, lte: toDate } } }),
    ]);

    if (!worker) return err('Worker not found', 404);

    // Build months for payroll lookup
    const monthSet = new Set<string>();
    const tmp = new Date(fromDate);
    while (tmp <= toDate) { monthSet.add(`${tmp.getFullYear()}-${tmp.getMonth()+1}`); tmp.setMonth(tmp.getMonth()+1); }
    const payrolls = await prisma.payrollRecord.findMany({
      where: { workerId: params.workerId, companyId, OR: Array.from(monthSet).map(s => { const [y,m] = s.split('-').map(Number); return {year:y,month:m}; }) },
      orderBy: [{ year:'asc' },{ month:'asc' }],
    });

    const advByDate: Record<string, number> = {};
    for (const a of advances) { const ds = a.date.toISOString().split('T')[0]; advByDate[ds] = (advByDate[ds]||0) + Number(a.amount); }

    const days: { date:string; day:string; status:string; lateMinutes:number; overtimeHours:number; advance:number }[] = [];
    const cur = new Date(fromDate);
    while (cur <= toDate) {
      const ds = cur.toISOString().split('T')[0];
      const att = attendances.find(a => a.date.toISOString().split('T')[0] === ds);
      days.push({ date:ds, day: cur.toLocaleDateString('en-IN',{weekday:'short'}), status: att ? att.status : 'NOT MARKED', lateMinutes: att?.lateMinutes??0, overtimeHours: att?.overtimeHours?Number(att.overtimeHours):0, advance: advByDate[ds]??0 });
      cur.setDate(cur.getDate()+1);
    }

    const totalAdv = advances.reduce((s,a) => s+Number(a.amount), 0);
    const totals = { present: days.filter(d=>d.status==='PRESENT').length, absent: days.filter(d=>d.status==='ABSENT').length, late: days.filter(d=>d.status==='LATE').length, halfDay: days.filter(d=>d.status==='HALF_DAY').length, otHours: days.reduce((s,d)=>s+d.overtimeHours,0), totalAdv };

    if (format === 'json') return Response.json({ success:true, data:{ worker, days, totals, payrolls } });

    // ── PDF ──────────────────────────────────────────────────────────────────
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    doc.on('data', (c: Buffer) => chunks.push(c));

    const ML=36, PW=595-72, BOTTOM=806;
    const txt = (text: string, x: number, y: number, w: number, opts: { bold?:boolean; size?:number; color?:string; align?:'left'|'center'|'right' }={}) => {
      doc.font(opts.bold?'Helvetica-Bold':'Helvetica').fontSize(opts.size??9).fillColor(opts.color??'#111').text(text, x, y, { width:w, lineBreak:false, align: opts.align??'left' });
    };

    let y = 30;
    doc.rect(0,0,595,52).fill('#1F2937');
    txt(company?.name||'Company', ML, 10, PW, {bold:true,size:16,color:'#fff',align:'center'});
    txt('Attendance & Payment Report', ML, 32, PW, {size:10,color:'#9CA3AF',align:'center'});
    y=62;
    doc.rect(ML,y,PW,40).fill('#F3F4F6');
    txt(`Name: ${worker.fullName}`, ML+8,y+6,150,{bold:true,size:9});
    txt(`Phone: ${worker.phone}`,   ML+8,y+20,150,{size:9,color:'#555'});
    txt(`Type: ${worker.category==='DAILY_WAGE'?'Daily Wage':'Monthly Salary'}`, ML+175,y+6,160,{size:9});
    txt(`From: ${fromDate.toLocaleDateString('en-IN')}`, ML+175,y+20,160,{size:9,color:'#555'});
    txt(`To:   ${toDate.toLocaleDateString('en-IN')}`,   ML+340,y+20,160,{size:9,color:'#555'});
    y+=48;

    const cards=[{label:'Present',val:String(totals.present),bg:'#DCFCE7',fg:'#14532D'},{label:'Absent',val:String(totals.absent),bg:'#FEE2E2',fg:'#991B1B'},{label:'Late',val:String(totals.late),bg:'#FEF3C7',fg:'#92400E'},{label:'Half Day',val:String(totals.halfDay),bg:'#DBEAFE',fg:'#1E3A8A'},{label:'OT Hours',val:totals.otHours.toFixed(1),bg:'#F3E8FF',fg:'#4C1D95'},{label:'Advances',val:`Rs.${totalAdv.toFixed(0)}`,bg:'#FFE4E6',fg:'#9F1239'}];
    const cW=Math.floor(PW/cards.length),cardY=y;
    cards.forEach((c,i)=>{const cx=ML+i*cW;doc.rect(cx,cardY,cW-2,38).fill(c.bg);txt(c.val,cx+2,cardY+5,cW-4,{bold:true,size:13,color:c.fg,align:'center'});txt(c.label,cx+2,cardY+24,cW-4,{size:7,color:c.fg,align:'center'});});
    y=cardY+44;

    const COL={date:{x:ML,w:62},day:{x:ML+62,w:26},status:{x:ML+88,w:72},late:{x:ML+160,w:50},ot:{x:ML+210,w:46},adv:{x:ML+256,w:65},sal:{x:ML+321,w:PW-321}};
    const HDR_H=18,ROW_H=15;
    const SFG:Record<string,string>={PRESENT:'#14532D',ABSENT:'#991B1B',LATE:'#92400E',HALF_DAY:'#1E3A8A','NOT MARKED':'#9CA3AF'};
    const SBG:Record<string,string>={PRESENT:'#F0FDF4',ABSENT:'#FEF2F2',LATE:'#FFFBEB',HALF_DAY:'#EFF6FF','NOT MARKED':'#F9FAFB'};
    const payrollMap:Record<string,typeof payrolls[0]>={};
    for(const pr of payrolls) payrollMap[`${pr.year}-${pr.month}`]=pr;

    const drawHdr=(startY:number)=>{
      doc.rect(ML,startY,PW,HDR_H).fill('#1F2937');
      const hy=startY+5;
      txt('Date',COL.date.x+2,hy,COL.date.w-2,{bold:true,size:8,color:'#fff'});txt('Day',COL.day.x+2,hy,COL.day.w-2,{bold:true,size:8,color:'#fff'});txt('Status',COL.status.x+2,hy,COL.status.w-2,{bold:true,size:8,color:'#fff'});txt('Late',COL.late.x+2,hy,COL.late.w-4,{bold:true,size:8,color:'#fff',align:'right'});txt('OT Hrs',COL.ot.x+2,hy,COL.ot.w-4,{bold:true,size:8,color:'#fff',align:'right'});txt('Advance',COL.adv.x+2,hy,COL.adv.w-4,{bold:true,size:8,color:'#fff',align:'right'});txt('Salary',COL.sal.x+2,hy,COL.sal.w-4,{bold:true,size:8,color:'#fff',align:'right'});
      return startY+HDR_H;
    };
    y=drawHdr(y);

    days.forEach((d,i)=>{
      if(y+ROW_H>BOTTOM){doc.addPage();y=30;doc.rect(0,0,595,26).fill('#1F2937');txt(company?.name||'',ML,8,PW,{bold:true,size:10,color:'#fff',align:'center'});y=32;y=drawHdr(y);}
      const bg=i%2===0?(SBG[d.status]||'#F9FAFB'):'#fff';
      doc.rect(ML,y,PW,ROW_H).fill(bg);
      doc.moveTo(ML,y+ROW_H).lineTo(ML+PW,y+ROW_H).strokeColor('#E5E7EB').lineWidth(0.3).stroke();
      const ty=y+3,fg=SFG[d.status]||'#374151';
      txt(d.date,COL.date.x+2,ty,COL.date.w-2,{size:8,color:'#374151'});txt(d.day,COL.day.x+2,ty,COL.day.w-2,{size:8,color:'#6B7280'});
      txt(d.status.replace(/_/g,' '),COL.status.x+2,ty,COL.status.w-2,{bold:true,size:8,color:fg});
      txt(d.lateMinutes>0?`${d.lateMinutes}m`:'—',COL.late.x+2,ty,COL.late.w-4,{size:8,color:d.lateMinutes>0?'#92400E':'#9CA3AF',align:'right'});
      txt(d.overtimeHours>0?d.overtimeHours.toFixed(1):'—',COL.ot.x+2,ty,COL.ot.w-4,{size:8,color:d.overtimeHours>0?'#4C1D95':'#9CA3AF',align:'right'});
      txt(d.advance>0?`Rs.${d.advance}`:'—',COL.adv.x+2,ty,COL.adv.w-4,{size:8,color:d.advance>0?'#9F1239':'#9CA3AF',align:'right'});
      const [dY,dM]=d.date.split('-').map(Number);
      const pr=payrollMap[`${dY}-${dM}`];
      const isFirst=days.findIndex(x=>{const[xy,xm]=x.date.split('-').map(Number);return xy===dY&&xm===dM;})=== i;
      if(pr&&isFirst)txt(pr.isPaid?`Rs.${Number(pr.netSalary).toFixed(0)} PAID`:`Rs.${Number(pr.netSalary).toFixed(0)} DUE`,COL.sal.x+2,ty,COL.sal.w-4,{size:7,bold:pr.isPaid,color:pr.isPaid?'#14532D':'#92400E',align:'right'});
      y+=ROW_H;
    });

    if(payrolls.length>0){
      if(y+20+payrolls.length*14>BOTTOM){doc.addPage();y=36;}
      y+=10;doc.rect(ML,y,PW,14).fill('#1F2937');txt('SALARY SUMMARY',ML+4,y+3,PW-8,{bold:true,size:8,color:'#fff'});y+=14;
      payrolls.forEach((pr,i)=>{
        const mn=new Date(pr.year,pr.month-1).toLocaleString('en-IN',{month:'long',year:'numeric'});
        doc.rect(ML,y,PW,14).fill(i%2===0?'#F9FAFB':'#fff');
        txt(mn,ML+4,y+3,130,{size:8});txt(`Basic: Rs.${Number(pr.basicSalary).toFixed(0)}`,ML+138,y+3,90,{size:8});txt(`OT: Rs.${Number(pr.overtimePay).toFixed(0)}`,ML+232,y+3,70,{size:8,color:'#4C1D95'});txt(`Adv: Rs.${Number(pr.advanceDeduction).toFixed(0)}`,ML+306,y+3,70,{size:8,color:'#9F1239'});txt(`Net: Rs.${Number(pr.netSalary).toFixed(0)}`,ML+378,y+3,70,{size:8,bold:true});txt(pr.isPaid?'PAID':'PENDING',ML+450,y+3,PW-454,{size:8,bold:true,color:pr.isPaid?'#14532D':'#92400E',align:'right'});
        y+=14;
      });
    }
    y+=8;txt(`Generated on ${new Date().toLocaleString('en-IN')}`,ML,y,PW,{size:7,color:'#9CA3AF',align:'right'});

    doc.end();
    const pdfBuffer = await new Promise<string>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    });

    return new Response(Buffer.from(pdfBuffer, 'base64'), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=report-${worker.fullName.replace(/\s+/g,'-')}.pdf`,
      },
    });
  } catch (e) { return err(String(e)); }
}
