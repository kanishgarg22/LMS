type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY' | 'LEAVE';
type OvertimeStatus = 'NONE' | 'OT';

export interface PayrollCalculationInput {
  category: 'DAILY_WAGE' | 'MONTHLY_SALARY';
  dailyWage?: number;
  monthlySalary?: number;
  joiningDate: Date;
  month: number;
  year: number;
  attendances: Array<{
    date: Date;
    status: AttendanceStatus;
    overtime: OvertimeStatus;
    overtimeHours?: number | null;
    lateMinutes?: number | null;
  }>;
  advances: number;
  /** Fixed OT rate per hour (₹/hr). If not set, auto-computed from daily/monthly wage. */
  overtimeRate?: number;
  /** Late charge amount. Unit depends on lateChargeUnit. */
  lateChargeRate?: number;
  /** Whether lateChargeRate is per minute or per hour. Default: PER_MINUTE */
  lateChargeUnit?: 'PER_MINUTE' | 'PER_HOUR';
}

export interface PayrollCalculationResult {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  overtimeHours: number;
  basicSalary: number;
  overtimePay: number;
  advanceDeduction: number;
  deductions: number;
  netSalary: number;
  carryForward: number;
  carryForwardNote: string;
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function getEffectiveStartDay(joiningDate: Date, month: number, year: number): number {
  const jYear = joiningDate.getFullYear();
  const jMonth = joiningDate.getMonth() + 1;
  if (jYear === year && jMonth === month) {
    return joiningDate.getDate();
  }
  return 1;
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const {
    category,
    dailyWage = 0,
    monthlySalary = 0,
    joiningDate,
    month,
    year,
    attendances,
    advances,
    overtimeRate,
    lateChargeRate = 0,
    lateChargeUnit = 'PER_MINUTE',
  } = input;

  const totalDaysInMonth = getDaysInMonth(month, year);
  const effectiveStart = getEffectiveStartDay(joiningDate, month, year);
  const workableDays = totalDaysInMonth - effectiveStart + 1;

  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let overtimeHours = 0;
  let totalLateMinutes = 0;

  for (const att of attendances) {
    const attDay = new Date(att.date).getDate();
    if (attDay < effectiveStart) continue;

    switch (att.status) {
      case 'PRESENT': presentDays++; break;
      case 'LATE':
        lateDays++;
        presentDays++;
        if (att.lateMinutes) totalLateMinutes += att.lateMinutes;
        break;
      case 'HALF_DAY': halfDays++; break;
      case 'ABSENT': absentDays++; break;
    }

    if (att.overtime === 'OT' && att.overtimeHours) {
      overtimeHours += Number(att.overtimeHours);
    }
  }

  let basicSalary = 0;
  let overtimePay = 0;
  let carryForward = 0;
  let carryForwardNote = '';

  if (category === 'DAILY_WAGE') {
    const effectivePresentDays = presentDays + halfDays * 0.5;
    basicSalary = effectivePresentDays * dailyWage;

    // OT pay: use fixed overtimeRate if provided, else 1.5× hourly
    const hourlyRate = overtimeRate != null ? overtimeRate : (dailyWage / 8) * 1.5;
    overtimePay = overtimeHours * hourlyRate;
  } else {
    // Monthly salary — pro-rate if joining mid-month
    const dailyRate = monthlySalary / workableDays;
    const effectivePresentDays = presentDays + halfDays * 0.5;
    basicSalary = effectivePresentDays * dailyRate;

    // OT pay: use fixed overtimeRate if provided, else 1.5× hourly
    const hourlyRate = overtimeRate != null ? overtimeRate : ((monthlySalary / workableDays) / 8) * 1.5;
    overtimePay = overtimeHours * hourlyRate;

    if (effectiveStart > 1) {
      carryForward = 0;
      carryForwardNote = `Salary calculated from joining date (${effectiveStart}th). Full salary starts next month.`;
    }
  }

  // Late charge deduction — convert to per-minute if rate is per-hour
  const effectiveLateRatePerMin = lateChargeUnit === 'PER_HOUR'
    ? lateChargeRate / 60
    : lateChargeRate;
  const lateDeduction = totalLateMinutes * effectiveLateRatePerMin;

  const netSalary = Math.max(0, basicSalary + overtimePay - advances - lateDeduction);

  return {
    totalDays: workableDays,
    presentDays,
    absentDays,
    lateDays,
    halfDays,
    overtimeHours,
    basicSalary: Math.round(basicSalary * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    advanceDeduction: advances,
    deductions: Math.round(lateDeduction * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
    carryForward,
    carryForwardNote,
  };
}
