import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import OpenAI from 'openai';

export const aiRouter = Router();
aiRouter.use(authenticate);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Tools that the AI assistant can call
const AI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'mark_attendance',
      description: 'Mark attendance for a worker on a specific date',
      parameters: {
        type: 'object',
        properties: {
          workerName: { type: 'string', description: 'Full or partial name of the worker' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format, defaults to today' },
          status: { type: 'string', enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'], description: 'Attendance status' },
          overtime: { type: 'string', enum: ['NONE', 'OT'], description: 'Overtime status' },
          overtimeHours: { type: 'number', description: 'Number of overtime hours' },
        },
        required: ['workerName', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payroll_summary',
      description: 'Get payroll summary for a specific month',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'number', description: 'Month number 1-12' },
          year: { type: 'number', description: 'Year' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_worker_info',
      description: 'Get information about a specific worker including attendance and salary',
      parameters: {
        type: 'object',
        properties: {
          workerName: { type: 'string', description: 'Full or partial name of the worker' },
        },
        required: ['workerName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_absent_workers',
      description: 'Get list of absent workers for a date or date range',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Specific date YYYY-MM-DD or "today" or "this week"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_salaries',
      description: 'Get list of workers with pending unpaid salaries',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_advance_info',
      description: 'Get advance payment details for a worker',
      parameters: {
        type: 'object',
        properties: {
          workerName: { type: 'string', description: 'Worker name' },
        },
        required: ['workerName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_payroll',
      description: 'Generate payroll for all workers for a given month',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'number' },
          year: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dashboard_stats',
      description: 'Get current dashboard statistics',
      parameters: { type: 'object', properties: {} },
    },
  },
];

async function executeTool(toolName: string, args: Record<string, unknown>, companyId: string, userId: string) {
  const today = new Date().toISOString().split('T')[0];

  switch (toolName) {
    case 'mark_attendance': {
      const { workerName, date = today, status, overtime = 'NONE', overtimeHours } = args as {
        workerName: string; date?: string; status: string; overtime?: string; overtimeHours?: number;
      };
      const workers = await prisma.worker.findMany({
        where: {
          companyId,
          fullName: { contains: workerName, mode: 'insensitive' },
          isActive: true,
        },
      });
      if (!workers.length) return { error: `Worker "${workerName}" not found` };

      const results: Array<{ worker: string; status: string; date: string }> = [];
      for (const worker of workers.slice(0, 1)) {
        const att = await prisma.attendance.upsert({
          where: { workerId_date: { workerId: worker.id, date: new Date(date) } },
          create: {
            workerId: worker.id,
            date: new Date(date),
            status: status as 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY',
            overtime: overtime as 'NONE' | 'OT',
            overtimeHours: overtimeHours || null,
            markedById: userId,
            companyId,
          },
          update: {
            status: status as 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY',
            overtime: overtime as 'NONE' | 'OT',
            overtimeHours: overtimeHours || null,
          },
        });
        results.push({ worker: worker.fullName, status: att.status, date });
      }
      return { success: true, message: `Marked ${status} for ${workers[0].fullName} on ${date}`, data: results };
    }

    case 'get_payroll_summary': {
      const month = (args.month as number) || new Date().getMonth() + 1;
      const year = (args.year as number) || new Date().getFullYear();
      const payrolls = await prisma.payrollRecord.findMany({
        where: { companyId, month, year },
        include: { worker: { select: { fullName: true } } },
      });
      return {
        month, year,
        totalWorkers: payrolls.length,
        totalNet: payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
        paid: payrolls.filter(p => p.isPaid).length,
        pending: payrolls.filter(p => !p.isPaid).length,
        pendingAmount: payrolls.filter(p => !p.isPaid).reduce((s, p) => s + Number(p.netSalary), 0),
        workers: payrolls.map(p => ({ name: p.worker.fullName, net: Number(p.netSalary), paid: p.isPaid })),
      };
    }

    case 'get_worker_info': {
      const { workerName } = args as { workerName: string };
      const worker = await prisma.worker.findFirst({
        where: { companyId, fullName: { contains: workerName, mode: 'insensitive' } },
        include: {
          attendances: { orderBy: { date: 'desc' }, take: 30 },
          payrolls: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 3 },
          advances: { where: { isFullyRepaid: false } },
        },
      });
      if (!worker) return { error: `Worker "${workerName}" not found` };
      const pendingAdvance = worker.advances.reduce(
        (s, a) => s + Number(a.amount) - Number(a.repaidAmount), 0
      );
      return {
        name: worker.fullName,
        phone: worker.phone,
        category: worker.category,
        wage: worker.category === 'DAILY_WAGE' ? `₹${worker.dailyWage}/day` : `₹${worker.monthlySalary}/month`,
        pendingAdvance,
        recentAttendance: worker.attendances.slice(0, 7).map(a => ({ date: a.date, status: a.status })),
        recentPayrolls: worker.payrolls.map(p => ({ month: p.month, year: p.year, net: Number(p.netSalary), paid: p.isPaid })),
      };
    }

    case 'get_absent_workers': {
      const dateStr = (args.date as string) || today;
      const searchDate = dateStr === 'today' ? today : dateStr;
      const d = new Date(searchDate);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const [activeWorkers, atts] = await Promise.all([
        prisma.worker.findMany({ where: { companyId, isActive: true }, select: { id: true, fullName: true } }),
        prisma.attendance.findMany({
          where: { companyId, date: { gte: d, lt: nextD } },
          select: { workerId: true, status: true },
        }),
      ]);

      const absent = atts.filter(a => a.status === 'ABSENT').map(a => ({
        name: activeWorkers.find(w => w.id === a.workerId)?.fullName || 'Unknown',
      }));
      const notMarked = activeWorkers.filter(w => !atts.find(a => a.workerId === w.id)).map(w => w.fullName);

      return { date: searchDate, absentWorkers: absent, notMarked, totalAbsent: absent.length + notMarked.length };
    }

    case 'get_pending_salaries': {
      const pending = await prisma.payrollRecord.findMany({
        where: { companyId, isPaid: false },
        include: { worker: { select: { fullName: true, phone: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
      return {
        count: pending.length,
        totalAmount: pending.reduce((s, p) => s + Number(p.netSalary), 0),
        workers: pending.map(p => ({
          name: p.worker.fullName,
          month: p.month,
          year: p.year,
          amount: Number(p.netSalary),
        })),
      };
    }

    case 'get_advance_info': {
      const { workerName } = args as { workerName: string };
      const worker = await prisma.worker.findFirst({
        where: { companyId, fullName: { contains: workerName, mode: 'insensitive' } },
        include: { advances: { orderBy: { date: 'desc' } } },
      });
      if (!worker) return { error: `Worker "${workerName}" not found` };
      const pending = worker.advances.reduce((s, a) => s + Number(a.amount) - Number(a.repaidAmount), 0);
      return {
        name: worker.fullName,
        totalAdvances: worker.advances.reduce((s, a) => s + Number(a.amount), 0),
        pendingAmount: pending,
        advances: worker.advances.map(a => ({
          date: a.date,
          amount: Number(a.amount),
          repaid: Number(a.repaidAmount),
          pending: Number(a.amount) - Number(a.repaidAmount),
          purpose: a.purpose,
        })),
      };
    }

    case 'generate_payroll': {
      return { message: 'Please use the payroll generation feature in the app to generate payroll.', action: 'NAVIGATE_PAYROLL' };
    }

    case 'get_dashboard_stats': {
      const today2 = new Date();
      today2.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today2);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [total, active, todayAtts, pending] = await Promise.all([
        prisma.worker.count({ where: { companyId } }),
        prisma.worker.count({ where: { companyId, isActive: true } }),
        prisma.attendance.findMany({ where: { companyId, date: { gte: today2, lt: tomorrow } } }),
        prisma.payrollRecord.findMany({ where: { companyId, isPaid: false } }),
      ]);

      return {
        totalWorkers: total,
        activeWorkers: active,
        presentToday: todayAtts.filter(a => ['PRESENT', 'LATE'].includes(a.status)).length,
        absentToday: todayAtts.filter(a => a.status === 'ABSENT').length,
        notMarked: active - todayAtts.length,
        pendingPayrolls: pending.length,
        pendingAmount: pending.reduce((s, p) => s + Number(p.netSalary), 0),
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// POST /api/ai/chat
aiRouter.post('/chat', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(503).json({ success: false, error: 'AI service not configured' });
      return;
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ success: false, error: 'messages array required' });
      return;
    }

    const systemPrompt = `You are an AI assistant for a Labour Management System (LMS).
You help factory owners, contractors, and site managers manage their workforce.
You can mark attendance, get payroll info, find absent workers, check advances, and more.
Always respond in the same language the user is using (Hindi or English).
When marking attendance or performing actions, use the available tools.
Be concise, helpful, and professional. Use Indian currency (₹) for amounts.
Today's date is ${new Date().toLocaleDateString('en-IN')}.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      tools: AI_TOOLS,
      tool_choice: 'auto',
    });

    const responseMessage = completion.choices[0].message;
    const toolResults: Array<{ tool: string; result: unknown }> = [];

    if (responseMessage.tool_calls) {
      const toolCallMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
        responseMessage,
      ];

      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolName, toolArgs, req.user!.companyId, req.user!.userId);
        toolResults.push({ tool: toolName, result });

        toolCallMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: toolCallMessages,
      });

      res.json({
        success: true,
        data: {
          message: finalCompletion.choices[0].message.content,
          toolResults,
          actions: toolResults.map(t => t.result).filter(r => (r as Record<string, unknown>)?.action),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: { message: responseMessage.content, toolResults: [], actions: [] },
    });
  } catch (err) { next(err); }
});

// POST /api/ai/voice — Transcribe voice and process
aiRouter.post('/voice', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(503).json({ success: false, error: 'AI service not configured' });
      return;
    }

    const audioFile = req.file;
    if (!audioFile) {
      res.status(400).json({ success: false, error: 'Audio file required' });
      return;
    }

    const fs = await import('fs');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.path) as unknown as File,
      model: 'whisper-1',
      language: 'hi',
    });

    res.json({
      success: true,
      data: { transcript: transcription.text },
    });
  } catch (err) { next(err); }
});
