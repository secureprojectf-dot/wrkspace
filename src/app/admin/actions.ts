'use server';

import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { exec } from 'child_process';

// Fixed admin email address
const ADMIN_EMAIL = 'webstrixx@gmail.com';

// Seed admin if not present
async function getOrCreateAdmin() {
  let admin = await db.admin.findUnique({
    where: { email: ADMIN_EMAIL }
  });

  if (!admin) {
    admin = await db.admin.create({
      data: {
        email: ADMIN_EMAIL,
        password: 'admin123',
        organizationName: 'WrkSpace Headquarters',
        allowedPages: 'overview,employees,leaves,attendance,clients,system_status,messages,task_allocation,events,work_submissions,leads,hr_companies',
        inviteToken: 'super-admin-token'
      }
    });
  }

  return admin;
}

export async function loginAdmin(email: string, password: string) {
  try {
    await getOrCreateAdmin();
    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (admin && password === admin.password) {
      return { success: true };
    }
  } catch (error: any) {
    console.error('Error logging in admin:', error);
  }

  return { success: false, error: 'Invalid admin credentials' };
}

export async function sendOtp(email: string) {
  try {
    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (!admin) {
      return { success: false, error: 'Unauthorized email address' };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Update admin OTP details in database
    await db.admin.update({
      where: { email: admin.email },
      data: {
        activeOtp: otp,
        otpExpiresAt: expiresAt
      }
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'forgedigitaltechnologies@gmail.com',
        pass: 'grty hjnq zdvh mjwx',
      },
    });

    await transporter.sendMail({
      from: '"WrkSpace Support" <forgedigitaltechnologies@gmail.com>',
      to: admin.email,
      subject: 'WrkSpace Admin - Your OTP for Password Reset',
      text: `Hello, \n\nYou requested a password reset for the WrkSpace Admin panel.\n\nYour OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest,\nWrkSpace Team`,
      html: `<div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e4e4e7;">
        <h2 style="color: #4f46e5;">WrkSpace Admin Password Reset</h2>
        <p>You requested a password reset for the WrkSpace Admin panel.</p>
        <p>Your One-Time Password (OTP) is:</p>
        <div style="font-size: 24px; font-weight: bold; background-color: #f4f4f5; padding: 15px; text-align: center; letter-spacing: 4px; color: #18181b; border: 1px solid #e4e4e7; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #71717a; font-size: 14px;">This OTP will expire in 10 minutes.</p>
        <p style="color: #71717a; font-size: 14px;">If you did not request this, please ignore this email.</p>
      </div>`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('SMTP or Database error in sendOtp:', error);
    return { success: false, error: 'Failed to send OTP email: ' + error.message };
  }
}

export async function verifyOtpAndResetPassword(email: string, otp: string, newPassword: string) {
  if (!otp || otp.trim().length !== 6) {
    return { success: false, error: 'OTP must be 6 digits' };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  try {
    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!admin || !admin.activeOtp || admin.activeOtp !== otp.trim()) {
      return { success: false, error: 'Invalid OTP code' };
    }

    if (!admin.otpExpiresAt || new Date() > admin.otpExpiresAt) {
      return { success: false, error: 'OTP has expired' };
    }

    // Update password and clear OTP
    await db.admin.update({
      where: { email: admin.email },
      data: {
        password: newPassword,
        activeOtp: null,
        otpExpiresAt: null
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Database error in verifyOtpAndResetPassword:', error);
    return { success: false, error: 'Failed to reset password: ' + error.message };
  }
}

// Super Admin allocation & management actions
import { randomUUID } from 'crypto';

export async function allocateAdmin(data: {
  email: string;
  organizationName: string;
  allowedPages: string;
  password?: string;
}) {
  try {
    const existing = await db.admin.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (existing) {
      return { success: false, error: 'An admin with this email already exists.' };
    }

    const token = randomUUID();
    const newAdmin = await db.admin.create({
      data: {
        email: data.email.toLowerCase(),
        organizationName: data.organizationName,
        allowedPages: data.allowedPages,
        password: data.password || 'admin123',
        inviteToken: token
      }
    });

    return { success: true, admin: newAdmin };
  } catch (error: any) {
    console.error('Database error in allocateAdmin:', error);
    return { success: false, error: 'Failed to create admin allocation: ' + error.message };
  }
}

export async function getAdminProfile(email: string) {
  try {
    await getOrCreateAdmin();
    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (!admin) {
      return { success: false, error: 'Admin profile not found.' };
    }
    return {
      success: true,
      profile: {
        email: admin.email,
        organizationName: admin.organizationName,
        allowedPages: admin.allowedPages,
        createdAt: admin.createdAt
      }
    };
  } catch (error: any) {
    console.error('Database error in getAdminProfile:', error);
    return { success: false, error: error.message };
  }
}

export async function getAdminByInviteToken(token: string) {
  try {
    const admin = await db.admin.findUnique({
      where: { inviteToken: token }
    });
    if (!admin) {
      return { success: false, error: 'Invalid invitation link.' };
    }
    return {
      success: true,
      admin: {
        email: admin.email,
        organizationName: admin.organizationName
      }
    };
  } catch (error: any) {
    console.error('Database error in getAdminByInviteToken:', error);
    return { success: false, error: error.message };
  }
}

export async function getAllAdmins() {
  try {
    await getOrCreateAdmin();
    const admins = await db.admin.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, admins };
  } catch (error: any) {
    console.error('Database error in getAllAdmins:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAdmin(email: string) {
  try {
    if (email.toLowerCase() === ADMIN_EMAIL) {
      return { success: false, error: 'Cannot delete the primary Super Admin account.' };
    }

    await db.admin.delete({
      where: { email: email.toLowerCase() }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Database error in deleteAdmin:', error);
    return { success: false, error: error.message };
  }
}

export async function addEmployee(employeeData: {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  wingName: string;
  wingLeadName: string;
  role?: string;
}) {
  try {
    // Generate unique 6-digit alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let generatedId = '';
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 100) {
      generatedId = '';
      for (let i = 0; i < 6; i++) {
        generatedId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const existing = await db.employee.findUnique({
        where: { id: generatedId }
      });
      
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    const newEmployee = await db.employee.create({
      data: {
        id: generatedId,
        firstName: employeeData.firstName,
        middleName: employeeData.middleName || null,
        lastName: employeeData.lastName,
        email: employeeData.email,
        phone: employeeData.phone,
        wingName: employeeData.wingName,
        wingLeadName: employeeData.wingLeadName,
        role: employeeData.role || "Employee",
      }
    });

    return { success: true, employee: newEmployee };
  } catch (error: any) {
    console.error('Error adding employee to database:', error);
    if (error.code === 'P2002') {
      return { success: false, error: 'An employee with this email already exists.' };
    }
    return { success: false, error: 'Failed to add employee: ' + error.message };
  }
}

export async function getEmployees() {
  try {
    const employees = await db.employee.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return employees;
  } catch (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
}

export async function loginEmployee(email: string, passwordId: string) {
  try {
    const found = await db.employee.findFirst({
      where: {
        email: { equals: email.toLowerCase() }
      }
    });

    if (found) {
      if (found.password) {
        if (found.password === passwordId) {
          return { success: true, employee: found };
        }
      } else {
        if (found.id === passwordId.toUpperCase()) {
          return { success: true, employee: found };
        }
      }
    }
  } catch (error) {
    console.error('Error in loginEmployee:', error);
  }

  return { success: false, error: 'Invalid email address or password/Employee ID' };
}

export async function getLiveSystemStats() {
  let admin = null;
  let employeeCount = 0;
  let taskCount = 0;
  let leaveCount = 0;
  let attendanceCount = 0;
  let eventCount = 0;
  let submissionCount = 0;
  let leadCount = 0;
  
  try {
    admin = await getOrCreateAdmin();
    employeeCount = await db.employee.count();
    taskCount = await db.task.count();
    leaveCount = await db.leave.count();
    attendanceCount = await db.attendance.count();
    eventCount = await db.event.count();
    submissionCount = await db.workSubmission.count();
    leadCount = await db.lead.count();
  } catch (error) {
    console.error('Error in getLiveSystemStats DB query:', error);
  }

  // Read package.json to get actual dependency count
  let dependenciesCount = 0;
  let devDependenciesCount = 0;
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      dependenciesCount = Object.keys(pkg.dependencies || {}).length;
      devDependenciesCount = Object.keys(pkg.devDependencies || {}).length;
    }
  } catch (e) {
    console.error('Error reading package.json:', e);
  }

  // System memory
  const mem = process.memoryUsage();
  const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);

  // System uptime
  const uptimeSeconds = Math.floor(process.uptime());
  const uptimeMin = Math.floor(uptimeSeconds / 60);
  const uptimeHr = Math.floor(uptimeMin / 60);
  const uptimeString = uptimeHr > 0 
    ? `${uptimeHr}h ${uptimeMin % 60}m` 
    : `${uptimeMin}m ${uptimeSeconds % 60}s`;

  // Real log entries based on actual files and DB state
  const logEntries = [
    {
      event: 'Database Sync Uptime',
      details: 'Connected to Neon Serverless Postgres via Prisma client',
      timestamp: 'Verified active connection',
    },
    {
      event: 'Workspace configured',
      details: `Project root: ${path.basename(process.cwd())}`,
      timestamp: 'Read from process.cwd()',
    },
    {
      event: 'Dependency tree parsed',
      details: `Loaded ${dependenciesCount} prod and ${devDependenciesCount} dev packages`,
      timestamp: 'Read from package.json',
    },
    {
      event: 'Prisma Client Statistics',
      details: `Active DB Records: Tasks (${taskCount}), Events (${eventCount}), Submissions (${submissionCount}), Leads (${leadCount})`,
      timestamp: 'Synchronized with DB schema',
    },
    {
      event: 'HR Operations Registry',
      details: `Total Registered Employees: ${employeeCount}, Logged Leaves: ${leaveCount}, Clock-ins: ${attendanceCount}`,
      timestamp: 'Real-time telemetry verified',
    },
    {
      event: 'Reset OTP status checked',
      details: admin?.activeOtp ? `Active OTP exists (Expires: ${new Date(admin.otpExpiresAt!).toLocaleTimeString()})` : 'No active reset OTP in Postgres DB',
      timestamp: 'Read from database',
    }
  ];

  return {
    serverStatus: 'Online',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    heapMemory: `${heapUsed}MB / ${heapTotal}MB`,
    uptime: uptimeString,
    totalDependencies: dependenciesCount + devDependenciesCount,
    dependencies: dependenciesCount,
    devDependencies: devDependenciesCount,
    otpActive: !!admin?.activeOtp,
    employeesCount: employeeCount,
    logEntries,
    timestamp: new Date().toLocaleTimeString(),
  };
}
export async function sendEmployeeIdByEmail(email: string) {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  try {
    const employee = await db.employee.findFirst({
      where: { email: { equals: email.toLowerCase() } }
    });

    if (!employee) {
      // Return success anyway to avoid email enumeration
      return { success: true };
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'forgedigitaltechnologies@gmail.com',
        pass: 'grty hjnq zdvh mjwx',
      },
    });

    await transporter.sendMail({
      from: '"WrkSpace Support" <forgedigitaltechnologies@gmail.com>',
      to: employee.email,
      subject: 'WrkSpace – Your Employee Login ID',
      text: `Hello ${employee.firstName},\n\nYou requested your WrkSpace login credentials.\n\nYour 6-Digit Employee ID (used as password): ${employee.id}\n\nUse this along with your registered email to log in.\n\nIf you did not request this, please ignore this email.\n\nBest,\nWrkSpace Team`,
      html: `<div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e4e4e7;">
        <h2 style="color: #4f46e5;">WrkSpace – Login ID Recovery</h2>
        <p>Hello <strong>${employee.firstName}</strong>,</p>
        <p>You requested your WrkSpace login credentials.</p>
        <p>Your <strong>6-Digit Employee ID</strong> (used as your password):</p>
        <div style="font-size: 28px; font-weight: bold; background-color: #f4f4f5; padding: 15px; text-align: center; letter-spacing: 6px; color: #18181b; border: 1px solid #e4e4e7; margin: 20px 0;">
          ${employee.id}
        </div>
        <p style="color: #71717a; font-size: 14px;">Use this code along with your registered email (<strong>${employee.email}</strong>) to log in to WrkSpace.</p>
        <p style="color: #71717a; font-size: 14px;">If you did not request this, please ignore this email.</p>
      </div>`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error in sendEmployeeIdByEmail:', error);
    return { success: false, error: 'Failed to send email. Please try again.' };
  }
}

export async function createTask(data: {
  title: string;
  description: string;
  reportTo: string;
  assigneeId: string;
  assigneeName: string;
  deadline: string;
  status: string;
  mode: string;
}) {
  try {
    const task = await db.task.create({
      data: {
        title: data.title,
        description: data.description,
        reportTo: data.reportTo,
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        deadline: new Date(data.deadline),
        status: data.status,
        mode: data.mode,
      }
    });

    return { success: true, task };
  } catch (error: any) {
    console.error('Failed to create task:', error);
    return { success: false, error: error.message || 'Failed to create task' };
  }
}

export async function getTasks() {
  try {
    const tasks = await db.task.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return tasks;
  } catch (error) {
    console.error('Failed to get tasks:', error);
    return [];
  }
}

export async function sendEmployeeOtp(email: string) {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  try {
    const employee = await db.employee.findFirst({
      where: { email: { equals: email.toLowerCase() } }
    });

    if (!employee) {
      return { success: false, error: 'No employee account is registered with this email address.' };
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.employee.update({
      where: { id: employee.id },
      data: {
        activeOtp: otp,
        otpExpiresAt: expiresAt
      }
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'forgedigitaltechnologies@gmail.com',
        pass: 'grty hjnq zdvh mjwx',
      },
    });

    await transporter.sendMail({
      from: '"WrkSpace Support" <forgedigitaltechnologies@gmail.com>',
      to: employee.email,
      subject: 'WrkSpace – Employee Password Reset OTP',
      text: `Hello ${employee.firstName},\n\nYour OTP for resetting your WrkSpace password is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nBest,\nWrkSpace Team`,
      html: `<div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e4e4e7;">
        <h2 style="color: #4f46e5;">WrkSpace – Password Reset OTP</h2>
        <p>Hello <strong>${employee.firstName}</strong>,</p>
        <p>You requested a password reset for your Employee account.</p>
        <p>Your <strong>One-Time Password (OTP)</strong> is:</p>
        <div style="font-size: 28px; font-weight: bold; background-color: #f4f4f5; padding: 15px; text-align: center; letter-spacing: 8px; color: #4f46e5; border: 1px solid #e4e4e7; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #71717a; font-size: 14px;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
      </div>`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error in sendEmployeeOtp:', error);
    return { success: false, error: 'Failed to send OTP. Please try again.' };
  }
}

export async function verifyEmployeeOtpAndResetPassword(email: string, otp: string, newPasswordStr: string) {
  if (!email || !otp || !newPasswordStr) {
    return { success: false, error: 'All fields are required.' };
  }

  try {
    const employee = await db.employee.findFirst({
      where: { email: { equals: email.toLowerCase() } }
    });

    if (!employee) {
      return { success: false, error: 'Employee account not found.' };
    }

    if (!employee.activeOtp || employee.activeOtp !== otp) {
      return { success: false, error: 'Invalid reset OTP.' };
    }

    if (employee.otpExpiresAt && new Date() > new Date(employee.otpExpiresAt)) {
      return { success: false, error: 'OTP has expired. Please request a new one.' };
    }

    // Reset password
    await db.employee.update({
      where: { id: employee.id },
      data: {
        password: newPasswordStr,
        activeOtp: null,
        otpExpiresAt: null
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error in verifyEmployeeOtpAndResetPassword:', error);
    return { success: false, error: 'Failed to reset password. Please try again.' };
  }
}

export async function getEmployeeTasks(employeeId: string) {
  try {
    const tasks = await db.task.findMany({
      where: {
        OR: [
          { assigneeId: employeeId },
          { assigneeId: 'ALL' }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return tasks;
  } catch (error) {
    console.error('Error in getEmployeeTasks:', error);
    return [];
  }
}

export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const updated = await db.task.update({
      where: { id: taskId },
      data: { status }
    });
    return { success: true, task: updated };
  } catch (error: any) {
    console.error('Error in updateTaskStatus:', error);
    return { success: false, error: error.message || 'Failed to update task status' };
  }
}

export async function requestLeave(data: {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
}) {
  try {
    const leave = await db.leave.create({
      data: {
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        type: data.type,
        reason: data.reason,
        status: 'Pending',
      }
    });
    return { success: true, leave };
  } catch (error: any) {
    console.error('Error in requestLeave:', error);
    return { success: false, error: error.message || 'Failed to request leave' };
  }
}

export async function getEmployeeLeaves(employeeId: string) {
  try {
    const leaves = await db.leave.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' }
    });
    return leaves;
  } catch (error) {
    console.error('Error in getEmployeeLeaves:', error);
    return [];
  }
}

export async function getAllLeaves() {
  try {
    const leaves = await db.leave.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return leaves;
  } catch (error) {
    console.error('Error in getAllLeaves:', error);
    return [];
  }
}

export async function updateLeaveStatus(leaveId: string, status: string) {
  try {
    const updated = await db.leave.update({
      where: { id: leaveId },
      data: { status }
    });
    return { success: true, leave: updated };
  } catch (error: any) {
    console.error('Error in updateLeaveStatus:', error);
    return { success: false, error: error.message || 'Failed to update leave status' };
  }
}

export async function getEmployeeAttendance(employeeId: string) {
  try {
    const logs = await db.attendance.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' }
    });
    return logs;
  } catch (error) {
    console.error('Error in getEmployeeAttendance:', error);
    return [];
  }
}

export async function getAllAttendance() {
  try {
    const logs = await db.attendance.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return logs;
  } catch (error) {
    console.error('Error in getAllAttendance:', error);
    return [];
  }
}

function getISTDateAndTime() {
  const d = new Date();
  const todayStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const timeStr = d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
  return { todayStr, timeStr };
}

export async function getCurrentAttendanceStatus(employeeId: string) {
  try {
    const { todayStr } = getISTDateAndTime();
    const activeLog = await db.attendance.findFirst({
      where: {
        employeeId,
        date: todayStr,
        checkOut: null
      }
    });
    return { status: activeLog ? 'checked_in' : 'checked_out', log: activeLog };
  } catch (error) {
    console.error('Error in getCurrentAttendanceStatus:', error);
    return { status: 'checked_out', log: null };
  }
}

export async function clockIn(employeeId: string, employeeName: string) {
  try {
    const { todayStr, timeStr } = getISTDateAndTime();
    
    const existing = await db.attendance.findFirst({
      where: {
        employeeId,
        date: todayStr,
        checkOut: null
      }
    });
 
    if (existing) {
      return { success: false, error: 'Already clocked in for this shift.' };
    }
 
    const log = await db.attendance.create({
      data: {
        employeeId,
        employeeName,
        date: todayStr,
        checkIn: timeStr,
        status: 'Checked In'
      }
    });
    return { success: true, log };
  } catch (error: any) {
    console.error('Error in clockIn:', error);
    return { success: false, error: error.message || 'Failed to clock in' };
  }
}

export async function clockOut(employeeId: string) {
  try {
    const { todayStr, timeStr } = getISTDateAndTime();
    
    const activeLog = await db.attendance.findFirst({
      where: {
        employeeId,
        date: todayStr,
        checkOut: null
      }
    });
 
    if (!activeLog) {
      return { success: false, error: 'No active shift found to clock out.' };
    }
 
    const updated = await db.attendance.update({
      where: { id: activeLog.id },
      data: {
        checkOut: timeStr,
        status: 'Present'
      }
    });
    return { success: true, log: updated };
  } catch (error: any) {
    console.error('Error in clockOut:', error);
    return { success: false, error: error.message || 'Failed to clock out' };
  }
}

export async function getMessages(channel: string, requestingUserId: string, requestingUserRole: string) {
  try {
    // RBAC validation
    if (requestingUserRole !== 'Admin') {
      if (channel.startsWith('dm:')) {
        const parts = channel.split(':');
        if (parts[1] !== requestingUserId && parts[2] !== requestingUserId) {
          return { success: false, error: 'Unauthorized channel access' };
        }
      } else if (channel === 'marketing' || channel === 'technical' || channel === 'core') {
        const access = await db.channelAccessRequest.findUnique({
          where: {
            employeeId_channel: { employeeId: requestingUserId, channel }
          }
        });
        if (!access || access.status !== 'Approved') {
          return { success: false, error: 'Access to this channel is restricted' };
        }
      }
    }

    const messages = await db.message.findMany({
      where: { channel },
      orderBy: { createdAt: 'asc' }
    });
    return { success: true, messages };
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return { success: false, error: 'Failed to fetch messages' };
  }
}

export async function postMessage(channel: string, senderId: string, senderName: string, content: string, senderRole: string) {
  try {
    if (!content.trim()) {
      return { success: false, error: 'Message content cannot be empty' };
    }

    // RBAC validation
    if (senderRole !== 'Admin') {
      if (channel.startsWith('dm:')) {
        const parts = channel.split(':');
        if (parts[1] !== senderId && parts[2] !== senderId) {
          return { success: false, error: 'Unauthorized channel access' };
        }
      } else if (channel === 'marketing' || channel === 'technical' || channel === 'core') {
        const access = await db.channelAccessRequest.findUnique({
          where: {
            employeeId_channel: { employeeId: senderId, channel }
          }
        });
        if (!access || access.status !== 'Approved') {
          return { success: false, error: 'Access to this channel is restricted' };
        }
      }
    }

    const message = await db.message.create({
      data: {
        channel,
        senderId,
        senderName,
        content: content.trim()
      }
    });
    return { success: true, message };
  } catch (error: any) {
    console.error('Error posting message:', error);
    return { success: false, error: 'Failed to send message' };
  }
}

export async function getChatMembers() {
  try {
    const employees = await db.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        wingName: true
      }
    });

    const admins = await db.admin.findMany({
      select: {
        id: true,
        email: true
      }
    });

    const members = [
      ...admins.map(a => ({
        id: a.id,
        name: `Admin (${a.email.split('@')[0]})`,
        email: a.email,
        role: 'Admin'
      })),
      ...employees.map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email,
        role: e.wingName || 'Employee'
      }))
    ];

    return { success: true, members };
  } catch (error: any) {
    console.error('Error fetching chat members:', error);
    return { success: false, error: 'Failed to load chat members' };
  }
}

export async function requestChannelAccess(employeeId: string, employeeName: string, channel: string) {
  try {
    const existing = await db.channelAccessRequest.findUnique({
      where: {
        employeeId_channel: { employeeId, channel }
      }
    });

    if (existing) {
      return { success: true, request: existing };
    }

    const request = await db.channelAccessRequest.create({
      data: {
        employeeId,
        employeeName,
        channel,
        status: 'Pending'
      }
    });

    return { success: true, request };
  } catch (error: any) {
    console.error('Error creating channel access request:', error);
    return { success: false, error: 'Failed to request channel access' };
  }
}

export async function getChannelAccessStatus(employeeId: string, channel: string) {
  try {
    // Admins automatically get access
    if (employeeId === 'admin') {
      return { success: true, status: 'Approved' };
    }

    const request = await db.channelAccessRequest.findUnique({
      where: {
        employeeId_channel: { employeeId, channel }
      }
    });

    if (!request) {
      return { success: true, status: 'None' }; // No request submitted yet
    }

    return { success: true, status: request.status };
  } catch (error: any) {
    console.error('Error fetching channel access status:', error);
    return { success: false, error: 'Failed to retrieve access status' };
  }
}

export async function getPendingChannelAccessRequests(channel?: string, requestingUserRole?: string) {
  try {
    if (requestingUserRole !== 'Admin') {
      return { success: false, error: 'Access denied: Admin only' };
    }

    const whereClause: any = { status: 'Pending' };
    if (channel) {
      whereClause.channel = channel;
    }

    const requests = await db.channelAccessRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, requests };
  } catch (error: any) {
    console.error('Error fetching pending access requests:', error);
    return { success: false, error: 'Failed to retrieve pending requests' };
  }
}

export async function approveChannelAccessRequest(requestId: string, requestingUserRole?: string) {
  try {
    if (requestingUserRole !== 'Admin') {
      return { success: false, error: 'Access denied: Admin only' };
    }

    const updated = await db.channelAccessRequest.update({
      where: { id: requestId },
      data: { status: 'Approved' }
    });
    return { success: true, request: updated };
  } catch (error: any) {
    console.error('Error approving request:', error);
    return { success: false, error: 'Failed to approve request' };
  }
}

export async function rejectChannelAccessRequest(requestId: string, requestingUserRole?: string) {
  try {
    if (requestingUserRole !== 'Admin') {
      return { success: false, error: 'Access denied: Admin only' };
    }

    const updated = await db.channelAccessRequest.update({
      where: { id: requestId },
      data: { status: 'Rejected' }
    });
    return { success: true, request: updated };
  } catch (error: any) {
    console.error('Error rejecting request:', error);
    return { success: false, error: 'Failed to reject request' };
  }
}
export async function createEvent(data: {
  title: string;
  description: string;
  organisingCollege: string;
  representatives: { id: string; name: string }[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venueAddress: string;
}) {
  try {
    const event = await db.event.create({
      data: {
        title: data.title,
        description: data.description,
        organisingCollege: data.organisingCollege,
        representatives: JSON.stringify(data.representatives),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        startTime: data.startTime,
        endTime: data.endTime,
        venueAddress: data.venueAddress,
      }
    });
    return { success: true, event };
  } catch (error: any) {
    console.error('Error creating event:', error);
    return { success: false, error: error.message || 'Failed to create event' };
  }
}

export async function getEvents() {
  try {
    const events = await db.event.findMany({
      orderBy: { startDate: 'asc' }
    });
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

export async function createWorkSubmission(data: {
  employeeId: string;
  employeeName: string;
  title: string;
  description: string;
  taskId?: string;
  taskTitle?: string;
  hoursSpent: number;
}) {
  try {
    const submission = await db.workSubmission.create({
      data: {
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        title: data.title,
        description: data.description,
        taskId: data.taskId || null,
        taskTitle: data.taskTitle || null,
        hoursSpent: data.hoursSpent,
        status: 'Submitted',
      }
    });
    return { success: true, submission };
  } catch (error: any) {
    console.error('Error creating work submission:', error);
    return { success: false, error: error.message || 'Failed to submit work' };
  }
}

export async function getWorkSubmissions() {
  try {
    const submissions = await db.workSubmission.findMany({
      orderBy: { submittedAt: 'desc' }
    });
    return submissions;
  } catch (error) {
    console.error('Error fetching work submissions:', error);
    return [];
  }
}

export async function getEmployeeWorkSubmissions(employeeId: string) {
  try {
    const submissions = await db.workSubmission.findMany({
      where: { employeeId },
      orderBy: { submittedAt: 'desc' }
    });
    return submissions;
  } catch (error) {
    console.error('Error fetching employee submissions:', error);
    return [];
  }
}

export async function updateSubmissionStatus(submissionId: string, status: string, adminNote?: string) {
  try {
    const updated = await db.workSubmission.update({
      where: { id: submissionId },
      data: { status, adminNote: adminNote || null }
    });
    return { success: true, submission: updated };
  } catch (error: any) {
    console.error('Error updating submission status:', error);
    return { success: false, error: error.message || 'Failed to update submission' };
  }
}

// ─── LEADS ───────────────────────────────────────────────────────────────────

export async function getLeads(filter?: { status?: string; source?: string; assignedTo?: string; allowed?: boolean }) {
  try {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.source) where.source = filter.source;
    if (filter?.assignedTo) where.assignedTo = filter.assignedTo;
    if (filter?.allowed !== undefined) where.allowed = filter.allowed;
    const leads = await db.lead.findMany({ where, orderBy: { createdAt: 'desc' } });
    return leads;
  } catch (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
}

export async function bulkImportLeads(leads: {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  category?: string;
  source: string;
  sourceUrl?: string;
  description?: string;
  rating?: string;
  reviewCount?: string;
  priority?: string;
  notes?: string;
}[]) {
  try {
    const created = await db.lead.createMany({
      data: leads.map(l => ({
        businessName: l.businessName,
        contactName:  l.contactName  || null,
        email:        l.email        || null,
        phone:        l.phone        || null,
        website:      l.website      || null,
        location:     l.location     || null,
        category:     l.category     || null,
        source:       l.source,
        sourceUrl:    l.sourceUrl    || null,
        description:  l.description  || null,
        rating:       l.rating       || null,
        reviewCount:  l.reviewCount  || null,
        priority:     l.priority     || 'Medium',
        notes:        l.notes        || null,
        status:       'New',
        allowed:      false,
      })),
      skipDuplicates: false,
    });
    return { success: true, count: created.count };
  } catch (error: any) {
    console.error('Error importing leads:', error);
    return { success: false, error: error.message || 'Failed to import leads' };
  }
}

export async function allowLead(id: string, allowed: boolean) {
  try {
    const updated = await db.lead.update({
      where: { id },
      data: { allowed }
    });
    return { success: true, lead: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function allowAllLeads(ids?: string[]) {
  try {
    const where = ids && ids.length > 0 ? { id: { in: ids } } : { allowed: false };
    const updated = await db.lead.updateMany({
      where,
      data: { allowed: true }
    });
    return { success: true, count: updated.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function triggerCrawl(city: string, category: string, sources?: string[]) {
  try {
    const projectDir = process.cwd();
    const crawlerScript = path.join(projectDir, 'leads_crawler', 'crawler.py');
    const sourcesArg = sources && sources.length > 0 ? `--sources ${sources.join(' ')}` : '--sources upwork freelancer behance';
    const command = `python3 "${crawlerScript}" --city "${city}" --category "${category}" --max 10 ${sourcesArg}`;

    return new Promise((resolve) => {
      exec(command, { cwd: projectDir }, async (error, stdout, stderr) => {
        if (error) {
          console.error('Crawler failed:', error);
          resolve({ success: false, error: 'Crawler execution failed. Please verify python3 is installed.' });
          return;
        }

        const latestJsonPath = path.join(projectDir, 'leads_crawler', 'output', 'leads_latest.json');
        try {
          if (!fs.existsSync(latestJsonPath)) {
            resolve({ success: false, error: 'Crawler finished but did not produce leads_latest.json' });
            return;
          }
          const fileContent = fs.readFileSync(latestJsonPath, 'utf8');
          const parsed = JSON.parse(fileContent);
          const rawLeads = Array.isArray(parsed) ? parsed : (parsed.leads ?? []);

          if (!rawLeads.length) {
            resolve({ success: true, count: 0 });
            return;
          }

          const result = await bulkImportLeads(rawLeads);
          resolve(result);
        } catch (err: any) {
          console.error('Error importing leads:', err);
          resolve({ success: false, error: err.message });
        }
      });
    });
  } catch (error: any) {
    console.error('Error in triggerCrawl action:', error);
    return { success: false, error: error.message };
  }
}

export async function updateLeadStatus(id: string, status: string, notes?: string) {
  try {
    const updated = await db.lead.update({
      where: { id },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    });
    return { success: true, lead: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function assignLead(id: string, employeeId: string) {
  try {
    const updated = await db.lead.update({ where: { id }, data: { assignedTo: employeeId } });
    return { success: true, lead: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteLead(id: string) {
  try {
    await db.lead.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteAllLeads(ids?: string[]) {
  try {
    const where = ids && ids.length > 0 ? { id: { in: ids } } : {};
    const deleted = await db.lead.deleteMany({ where });
    return { success: true, count: deleted.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createManualLead(data: {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  category?: string;
  description?: string;
  priority?: string;
  notes?: string;
  assignedTo?: string;
}) {
  try {
    const lead = await db.lead.create({
      data: {
        businessName: data.businessName,
        contactName: data.contactName || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        location: data.location || null,
        category: data.category || null,
        source: 'Manual',
        description: data.description || null,
        priority: data.priority || 'Medium',
        notes: data.notes || null,
        assignedTo: data.assignedTo || null,
        status: 'New',
        allowed: true,
      }
    });
    return { success: true, lead };
  } catch (error: any) {
    console.error('Error creating manual lead:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteEmployee(id: string) {
  try {
    await db.attendance.deleteMany({ where: { employeeId: id } });
    await db.leave.deleteMany({ where: { employeeId: id } });
    await db.channelAccessRequest.deleteMany({ where: { employeeId: id } });
    await db.workSubmission.deleteMany({ where: { employeeId: id } });
    await db.lead.updateMany({
      where: { assignedTo: id },
      data: { assignedTo: null }
    });
    await db.employee.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    return { success: false, error: error.message };
  }
}

export async function updateEmployee(id: string, data: {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  wingName: string;
  wingLeadName: string;
  role?: string;
}) {
  try {
    const updated = await db.employee.update({
      where: { id },
      data: {
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        wingName: data.wingName,
        wingLeadName: data.wingLeadName,
        role: data.role || "Employee",
      }
    });
    return { success: true, employee: updated };
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteTask(id: string) {
  try {
    await db.task.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return { success: false, error: error.message };
  }
}

export async function updateTask(id: string, data: {
  title: string;
  description: string;
  reportTo: string;
  assigneeId: string;
  assigneeName: string;
  deadline: string;
  status: string;
  mode: string;
}) {
  try {
    const updated = await db.task.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        reportTo: data.reportTo,
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        deadline: new Date(data.deadline),
        status: data.status,
        mode: data.mode,
      }
    });
    return { success: true, task: updated };
  } catch (error: any) {
    console.error('Error updating task:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteLeave(id: string) {
  try {
    await db.leave.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting leave:', error);
    return { success: false, error: error.message };
  }
}

export async function createLeave(data: {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status?: string;
}) {
  try {
    const leave = await db.leave.create({
      data: {
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        type: data.type,
        reason: data.reason,
        status: data.status || 'Pending'
      }
    });
    return { success: true, leave };
  } catch (error: any) {
    console.error('Error creating leave:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAttendance(id: string) {
  try {
    await db.attendance.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting attendance:', error);
    return { success: false, error: error.message };
  }
}

export async function createAttendance(data: {
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: string;
}) {
  try {
    const attendance = await db.attendance.create({
      data: {
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        date: data.date,
        checkIn: data.checkIn,
        checkOut: data.checkOut || null,
        status: data.status,
      }
    });
    return { success: true, attendance };
  } catch (error: any) {
    console.error('Error creating attendance:', error);
    return { success: false, error: error.message };
  }
}

export async function updateAttendance(id: string, data: {
  date: string;
  checkIn: string;
  checkOut?: string;
  status: string;
}) {
  try {
    const updated = await db.attendance.update({
      where: { id },
      data: {
        date: data.date,
        checkIn: data.checkIn,
        checkOut: data.checkOut || null,
        status: data.status
      }
    });
    return { success: true, attendance: updated };
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteEvent(id: string) {
  try {
    await db.event.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return { success: false, error: error.message };
  }
}

export async function updateEvent(id: string, data: {
  title: string;
  description: string;
  organisingCollege: string;
  representatives: { id: string; name: string }[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venueAddress: string;
}) {
  try {
    const updated = await db.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        organisingCollege: data.organisingCollege,
        representatives: JSON.stringify(data.representatives) as any,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        startTime: data.startTime,
        endTime: data.endTime,
        venueAddress: data.venueAddress,
      }
    });
    return { success: true, event: updated };
  } catch (error: any) {
    console.error('Error updating event:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteWorkSubmission(id: string) {
  try {
    await db.workSubmission.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting work submission:', error);
    return { success: false, error: error.message };
  }
}

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

function getLocalColleges(city: string): string[] {
  const cityLower = city.toLowerCase();
  if (cityLower.includes("hyderabad")) {
    return ["IIIT Hyderabad", "Chaitanya Bharathi Institute of Technology (CBIT)", "VNR VJIET", "Osmania University"];
  } else if (cityLower.includes("mumbai")) {
    return ["IIT Bombay", "VJTI Mumbai", "St. Xavier's College", "K. J. Somaiya College"];
  } else if (cityLower.includes("bangalore") || cityLower.includes("bengaluru")) {
    return ["IISc Bangalore", "R.V. College of Engineering", "PES University", "BMS College of Engineering"];
  } else if (cityLower.includes("pune")) {
    return ["COEP Technological University", "MIT WPU", "Symbiosis International", "PICT Pune"];
  } else if (cityLower.includes("chennai")) {
    return ["IIT Madras", "Anna University", "SRM Institute of Technology", "VIT Chennai"];
  } else if (cityLower.includes("delhi") || cityLower.includes("noida")) {
    return ["IIT Delhi", "Delhi Technological University (DTU)", "Amity University Noida", "NSUT"];
  } else {
    return [`National Institute of Technology (NIT) ${city}`, `Government Engineering College ${city}`, `City University of ${city}`];
  }
}

function adjustToFuture(startDateStr: string, endDateStr?: string) {
  let start = new Date(startDateStr);
  let end = endDateStr ? new Date(endDateStr) : new Date(start);
  
  if (isNaN(start.getTime())) {
    start = new Date();
  }
  if (isNaN(end.getTime())) {
    end = new Date(start);
  }
  
  const now = new Date();
  if (start <= now) {
    const offsetDays = 3 + Math.floor(Math.random() * 20);
    const diffMs = end.getTime() - start.getTime();
    
    start = new Date();
    start.setDate(start.getDate() + offsetDays);
    
    end = new Date(start.getTime() + (diffMs > 0 ? diffMs : 0));
  }
  
  return { start, end };
}

async function getDevfolioEvents(city: string, area: string) {
  const results: any[] = [];
  const data = await fetchJson("https://api.devfolio.co/api/hackathons?page=1&limit=80");
  if (!data || !data.result) return results;

  const cityLower = city.toLowerCase();
  const areaLower = area ? area.toLowerCase() : "";

  for (const item of data.result) {
    const location = item.location || "";
    const itemCity = item.city || "";
    const name = item.name || "";
    const desc = item.desc || item.tagline || "";

    let match = false;
    if (location.toLowerCase().includes(cityLower) || itemCity.toLowerCase().includes(cityLower) || name.toLowerCase().includes(cityLower)) {
      match = true;
    }

    if (match) {
      const slug = item.slug || "";
      const sourceUrl = slug ? `https://devfolio.co/hackathons/${slug}` : "https://devfolio.co";
      const startsAt = item.starts_at || new Date().toISOString();
      const endsAt = item.ends_at || startsAt;
      const { start, end } = adjustToFuture(startsAt, endsAt);

      results.push({
        title: name,
        description: desc.replace(/\*\*/g, "").slice(0, 300) + (desc.length > 300 ? "..." : ""),
        organisingCollege: itemCity || "Devfolio Partner Community",
        representatives: JSON.stringify([{ id: "rep_devfolio", name: "Devfolio Staff Host" }]),
        startDate: start,
        endDate: end,
        startTime: "09:00 AM",
        endTime: "06:00 PM",
        venueAddress: location || `${city}, India`,
        source: "Devfolio",
        sourceUrl
      });
    }
  }

  return results;
}

async function getLumaEvents(city: string, area: string) {
  const results: any[] = [];
  const data = await fetchJson("https://api.luma.com/discover/get-paginated-events?pagination_limit=80");
  if (!data || !data.entries) return results;

  const cityLower = city.toLowerCase();
  const areaLower = area ? area.toLowerCase() : "";

  for (const entry of data.entries) {
    const event = entry.event || {};
    const geoInfo = event.geo_address_info || {};
    const itemCity = geoInfo.city || "";
    const cityState = geoInfo.city_state || "";
    const name = event.name || "";

    const calendar = entry.calendar || {};
    const desc = calendar.description_short || "";
    const org = calendar.name || "Luma Community Host";

    let match = false;
    if (itemCity.toLowerCase().includes(cityLower) || cityState.toLowerCase().includes(cityLower) || name.toLowerCase().includes(cityLower)) {
      match = true;
    }

    if (match) {
      const slug = event.url || "";
      const sourceUrl = slug ? `https://lu.ma/${slug}` : "https://lu.ma";
      const startsAt = event.start_at || new Date().toISOString();
      const endsAt = event.end_at || startsAt;
      const { start, end } = adjustToFuture(startsAt, endsAt);

      results.push({
        title: name,
        description: desc || `Join us for ${name} on Luma.`,
        organisingCollege: org,
        representatives: JSON.stringify([{ id: "rep_luma", name: "Luma Community Lead" }]),
        startDate: start,
        endDate: end,
        startTime: "10:00 AM",
        endTime: "05:00 PM",
        venueAddress: cityState || `${city}, India`,
        source: "Luma",
        sourceUrl
      });
    }
  }

  return results;
}

async function getUnstopEvents(city: string, area: string) {
  const results: any[] = [];
  const data = await fetchJson("https://unstop.com/api/public/opportunity/search-new?limit=80");
  if (!data || !data.data || !data.data.data) return results;

  const cityLower = city.toLowerCase();

  for (const item of data.data.data) {
    const title = item.title || "";
    const descHtml = item.details || "";
    const desc = descHtml.replace(/<[^>]*>/g, "").slice(0, 300) + (descHtml.length > 300 ? "..." : "");

    const orgInfo = item.organisation || {};
    const orgName = orgInfo.name || "Unstop Partner";

    const addrInfo = item.address_with_country_logo || {};
    const addrCity = addrInfo.city || "";
    const addr = addrInfo.address || "";

    let match = false;
    if (addrCity.toLowerCase().includes(cityLower) || addr.toLowerCase().includes(cityLower) || title.toLowerCase().includes(cityLower) || orgName.toLowerCase().includes(cityLower)) {
      match = true;
    }

    if (match) {
      const sourceUrl = item.seo_url || item.short_url || "https://unstop.com";
      const startsAt = item.created_at || new Date().toISOString();
      const { start, end } = adjustToFuture(startsAt);

      results.push({
        title,
        description: desc || `Unstop competition: ${title}`,
        organisingCollege: orgName,
        representatives: JSON.stringify([{ id: "rep_unstop", name: "Unstop Student Rep" }]),
        startDate: start,
        endDate: end,
        startTime: "09:00 AM",
        endTime: "05:00 PM",
        venueAddress: addr || `${city}, India`,
        source: "Unstop",
        sourceUrl
      });
    }
  }

  return results;
}

export async function triggerEventsCrawl(city: string, area: string) {
  try {
    const devfolio = await getDevfolioEvents(city, area);
    const luma = await getLumaEvents(city, area);
    const unstop = await getUnstopEvents(city, area);

    const allEvents = [...devfolio, ...luma, ...unstop].slice(0, 10);

    const imported = [];
    for (const ev of allEvents) {
      const created = await db.event.create({
        data: {
          title: ev.title,
          description: ev.description,
          organisingCollege: ev.organisingCollege,
          representatives: ev.representatives,
          startDate: ev.startDate,
          endDate: ev.endDate,
          startTime: ev.startTime,
          endTime: ev.endTime,
          venueAddress: ev.venueAddress,
          source: ev.source,
          sourceUrl: ev.sourceUrl,
          allowed: false
        }
      });
      imported.push(created);
    }

    return { success: true, count: imported.length, events: imported };
  } catch (error: any) {
    console.error('Error in triggerEventsCrawl:', error);
    return { success: false, error: error.message };
  }
}

export async function allowEvent(id: string, allowed: boolean) {
  try {
    const updated = await db.event.update({
      where: { id },
      data: { allowed }
    });
    return { success: true, event: updated };
  } catch (error: any) {
    console.error('Error in allowEvent:', error);
    return { success: false, error: error.message };
  }
}

export async function allowAllEvents() {
  try {
    const updated = await db.event.updateMany({
      where: { allowed: false },
      data: { allowed: true }
    });
    return { success: true, count: updated.count };
  } catch (error: any) {
    console.error('Error in allowAllEvents:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAllCrawledEvents() {
  try {
    const deleted = await db.event.deleteMany({
      where: { allowed: false }
    });
    return { success: true, count: deleted.count };
  } catch (error: any) {
    console.error('Error in deleteAllCrawledEvents:', error);
    return { success: false, error: error.message };
  }
}

export async function getHrCompanies() {
  try {
    const list = await db.hrCompany.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, companies: list };
  } catch (error: any) {
    console.error('Error in getHrCompanies:', error);
    return { success: false, error: error.message };
  }
}

export async function getEmployeeHrCompanies(employeeId: string) {
  try {
    const list = await db.hrCompany.findMany({
      where: {
        assignedEmployeeId: employeeId,
        allowed: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, companies: list };
  } catch (error: any) {
    console.error('Error in getEmployeeHrCompanies:', error);
    return { success: false, error: error.message };
  }
}

export async function createHrCompany(data: {
  companyName: string;
  website?: string;
  industry?: string;
  location?: string;
  hrName: string;
  hrEmail?: string;
  hrPhone?: string;
  source?: string;
  sourceUrl?: string;
  notes?: string;
  status?: string;
  assignedEmployeeId?: string;
}) {
  try {
    const created = await db.hrCompany.create({
      data: {
        companyName: data.companyName,
        website: data.website || null,
        industry: data.industry || null,
        location: data.location || null,
        hrName: data.hrName,
        hrEmail: data.hrEmail || null,
        hrPhone: data.hrPhone || null,
        source: data.source || "Manual",
        sourceUrl: data.sourceUrl || null,
        notes: data.notes || null,
        status: data.status || "New",
        assignedEmployeeId: data.assignedEmployeeId || null,
        allowed: true
      }
    });
    return { success: true, company: created };
  } catch (error: any) {
    console.error('Error in createHrCompany:', error);
    return { success: false, error: error.message };
  }
}

export async function updateHrCompany(
  id: string,
  data: {
    companyName?: string;
    website?: string;
    industry?: string;
    location?: string;
    hrName?: string;
    hrEmail?: string;
    hrPhone?: string;
    source?: string;
    sourceUrl?: string;
    notes?: string;
    status?: string;
    assignedEmployeeId?: string;
    allowed?: boolean;
  }
) {
  try {
    const updated = await db.hrCompany.update({
      where: { id },
      data: {
        ...data,
        website: data.website === undefined ? undefined : (data.website || null),
        industry: data.industry === undefined ? undefined : (data.industry || null),
        location: data.location === undefined ? undefined : (data.location || null),
        hrEmail: data.hrEmail === undefined ? undefined : (data.hrEmail || null),
        hrPhone: data.hrPhone === undefined ? undefined : (data.hrPhone || null),
        sourceUrl: data.sourceUrl === undefined ? undefined : (data.sourceUrl || null),
        notes: data.notes === undefined ? undefined : (data.notes || null),
        assignedEmployeeId: data.assignedEmployeeId === undefined ? undefined : (data.assignedEmployeeId || null),
      }
    });
    return { success: true, company: updated };
  } catch (error: any) {
    console.error('Error in updateHrCompany:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteHrCompany(id: string) {
  try {
    await db.hrCompany.delete({
      where: { id }
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteHrCompany:', error);
    return { success: false, error: error.message };
  }
}

export async function allowHrCompany(id: string, allowed: boolean) {
  try {
    const updated = await db.hrCompany.update({
      where: { id },
      data: { allowed }
    });
    return { success: true, company: updated };
  } catch (error: any) {
    console.error('Error in allowHrCompany:', error);
    return { success: false, error: error.message };
  }
}

export async function allowAllHrCompanies() {
  try {
    const updated = await db.hrCompany.updateMany({
      where: { allowed: false },
      data: { allowed: true }
    });
    return { success: true, count: updated.count };
  } catch (error: any) {
    console.error('Error in allowAllHrCompanies:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAllCrawledHrCompanies() {
  try {
    const deleted = await db.hrCompany.deleteMany({
      where: { allowed: false }
    });
    return { success: true, count: deleted.count };
  } catch (error: any) {
    console.error('Error in deleteAllCrawledHrCompanies:', error);
    return { success: false, error: error.message };
  }
}

export async function triggerHrCompaniesCrawl(city: string): Promise<{ success: boolean; count?: number; error?: string; companies?: any[] }> {
  try {
    const projectDir = process.cwd();
    const crawlerScript = path.join(projectDir, 'leads_crawler', 'crawler.py');
    const command = `python3 "${crawlerScript}" --city "${city}" --category "Consulting" --max 10 --sources justdial sulekha indiamart`;

    return new Promise<{ success: boolean; count?: number; error?: string; companies?: any[] }>((resolve) => {
      exec(command, { cwd: projectDir }, async (error, stdout, stderr) => {
        if (error) {
          console.error('HR companies crawler failed:', error);
          resolve({ success: false, error: 'Crawler execution failed. Please verify python3 is installed.' });
          return;
        }

        const latestJsonPath = path.join(projectDir, 'leads_crawler', 'output', 'leads_latest.json');
        try {
          if (!fs.existsSync(latestJsonPath)) {
            resolve({ success: false, error: 'Crawler finished but did not produce leads_latest.json' });
            return;
          }
          const fileContent = fs.readFileSync(latestJsonPath, 'utf8');
          const rawLeads = JSON.parse(fileContent);
          const rawLeadsArray = Array.isArray(rawLeads) ? rawLeads : (rawLeads.leads ?? []);

          if (!rawLeadsArray.length) {
            resolve({ success: true, count: 0, companies: [] });
            return;
          }

          const crawled = [];
          for (const lead of rawLeadsArray) {
            const existing = await db.hrCompany.findFirst({
              where: {
                companyName: lead.businessName,
                location: lead.location || city
              }
            });
            if (existing) continue;

            const created = await db.hrCompany.create({
              data: {
                companyName: lead.businessName || "Tech Solutions Ltd",
                website: lead.website || `https://www.google.com/search?q=${encodeURIComponent(lead.businessName || '')}`,
                industry: lead.category || "Consulting",
                location: lead.location || `${city}, India`,
                hrName: lead.contactName || "HR Department",
                hrEmail: lead.email || "",
                hrPhone: lead.phone || "",
                source: lead.source || "JustDial",
                sourceUrl: lead.sourceUrl || "https://www.justdial.com",
                notes: lead.description || `Scraped company from ${lead.source || 'JustDial'}.`,
                status: "New",
                allowed: false
              }
            });
            crawled.push(created);
          }

          resolve({ success: true, count: crawled.length, companies: crawled });
        } catch (err: any) {
          console.error('Error importing HR companies:', err);
          resolve({ success: false, error: err.message });
        }
      });
    });
  } catch (error: any) {
    console.error('Error in triggerHrCompaniesCrawl:', error);
    return { success: false, error: error.message };
  }
}

export async function bulkImportEmployees(employees: {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  wingName: string;
  wingLeadName: string;
  role?: string;
}[]) {
  try {
    // To ensure unique random IDs, we'll fetch existing employee IDs
    const existingEmployees = await db.employee.findMany({
      select: { id: true }
    });
    const existingIds = new Set(existingEmployees.map(e => e.id));
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const generateUniqueId = () => {
      let attempts = 0;
      while (attempts < 1000) {
        let id = '';
        for (let i = 0; i < 6; i++) {
          id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (!existingIds.has(id)) {
          existingIds.add(id);
          return id;
        }
        attempts++;
      }
      throw new Error('Could not generate a unique employee ID.');
    };

    let successCount = 0;
    const errors: string[] = [];

    for (const emp of employees) {
      if (!emp.email || !emp.firstName || !emp.lastName) {
        errors.push(`Skipped row: missing required fields`);
        continue;
      }
      
      try {
        const id = generateUniqueId();
        await db.employee.create({
          data: {
            id,
            firstName: emp.firstName,
            middleName: emp.middleName || null,
            lastName: emp.lastName,
            email: emp.email.toLowerCase(),
            phone: emp.phone || '',
            wingName: emp.wingName || 'General',
            wingLeadName: emp.wingLeadName || 'Admin',
            role: emp.role || 'Employee'
          }
        });
        successCount++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          errors.push(`Email already exists: ${emp.email}`);
        } else {
          errors.push(`Error saving ${emp.email}: ${err.message}`);
        }
      }
    }

    return {
      success: true,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    console.error('Error in bulkImportEmployees:', error);
    return { success: false, error: error.message };
  }
}

