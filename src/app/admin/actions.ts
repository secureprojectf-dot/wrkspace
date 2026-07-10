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
        allowedPages: 'overview,employees,leaves,attendance,clients,system_status,messages,task_allocation,events,work_submissions,leads',
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
  
  try {
    admin = await getOrCreateAdmin();
    employeeCount = await db.employee.count();
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

export async function getCurrentAttendanceStatus(employeeId: string) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
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
    const todayStr = new Date().toISOString().split('T')[0];
    
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

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    const todayStr = new Date().toISOString().split('T')[0];
    
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

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        email: true
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
        role: 'Employee'
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
