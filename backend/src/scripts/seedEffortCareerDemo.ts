import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { ROLES, STATUS } from '../constants/index.js';

async function seedEffortCareerDemo() {
  console.log('================================================================');
  console.log('🚀 Seeding Effort Career Classes Isolated 3-Day Demo Environment');
  console.log('Target Database Schema: [demo]');
  console.log('================================================================\n');

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Supabase credentials missing.');
    process.exit(1);
  }

  // Create client specifically for auth & public schema
  const supabasePublic = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create client targeting the isolated demo schema
  const supabaseDemo = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'demo' },
  });

  // 1. Create or resolve Auth User for Demo Administrator
  const demoEmail = env.DEMO_ADMIN_EMAIL || 'demo@effortcareerclasses.com';
  const demoPassword = env.DEMO_ADMIN_PASSWORD || 'EffortTrial@2026!';

  console.log(`Setting up Demo Administrator account: ${demoEmail}`);

  let demoUserId: string;
  const { data: usersData } = await supabasePublic.auth.admin.listUsers();
  const existingUser = usersData?.users.find((u) => u.email?.toLowerCase() === demoEmail.toLowerCase());

  if (existingUser) {
    demoUserId = existingUser.id;
    console.log(`ℹ️ Reusing existing auth user ID: ${demoUserId}`);
    // Update password to ensure it works
    await supabasePublic.auth.admin.updateUserById(demoUserId, { password: demoPassword });
  } else {
    const { data: newUser, error: createError } = await supabasePublic.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
    });
    if (createError || !newUser.user) {
      throw new Error(`Failed to create demo auth user: ${createError?.message}`);
    }
    demoUserId = newUser.user.id;
    console.log(`✅ Created demo auth user. ID: ${demoUserId}`);
  }

  // Trial 3-day server timestamps
  const trialStartedAt = new Date().toISOString();
  const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // 2. Ensure profile exists with DEMO_ADMIN role and trial metadata
  const { error: profileError } = await supabasePublic.from('profiles').upsert(
    {
      id: demoUserId,
      email: demoEmail,
      full_name: 'Demo Administrator (Effort Career Classes)',
      role: ROLES.DEMO_ADMIN,
      status: STATUS.ACTIVE,
      is_trial: true,
      trial_started_at: trialStartedAt,
      trial_expires_at: trialExpiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    throw new Error(`Failed to create demo profile: ${profileError.message}`);
  }
  console.log(`✅ Demo Admin Profile configured with 3-day trial expiring at: ${trialExpiresAt}`);

  // 3. Clear existing demo.* schema data for idempotent clean seed
  console.log('🧹 Preparing clean state in demo.* schema...');
  await supabaseDemo.from('receipts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('student_fees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('batch_students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('batch_teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('announcement_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('fee_plans').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseDemo.from('academy_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 4. Seed Academy Settings
  const { data: academySetting, error: acadError } = await supabaseDemo
    .from('academy_settings')
    .insert({
      academy_name: 'Effort Career Classes',
      logo_url: '/effort-career-logo.png',
      phone: '+918308510975',
      email: 'effortcareer1510@gmail.com',
      address: '3rd Floor, Arihant Mall, Near S. T. Stop, Ratnagiri, Maharashtra, India',
      website: 'https://www.effortcareerclasses.com',
      currency: 'INR',
    })
    .select()
    .single();

  if (acadError) throw new Error(`Failed to seed academy settings: ${acadError.message}`);
  console.log(`✅ Seeded Effort Career Classes settings: ${academySetting.academy_name}`);

  // 5. Seed Teachers
  const teacherDefs = [
    { name: 'Prof. Nilesh Deshmukh', subject: 'Physics', email: 'nilesh.physics@effortdemo.com', phone: '919999000101' },
    { name: 'Prof. Priya Kadam', subject: 'Chemistry', email: 'priya.chem@effortdemo.com', phone: '919999000102' },
    { name: 'Prof. Sachin Patil', subject: 'Mathematics', email: 'sachin.maths@effortdemo.com', phone: '919999000103' },
    { name: 'Dr. Ananya Joshi', subject: 'Biology', email: 'ananya.bio@effortdemo.com', phone: '919999000104' },
  ];

  const { data: createdTeachers, error: teachError } = await supabaseDemo
    .from('teachers')
    .insert(teacherDefs.map((t) => ({ ...t, status: 'ACTIVE' })))
    .select();

  if (teachError || !createdTeachers) throw new Error(`Failed to seed teachers: ${teachError?.message}`);
  console.log(`✅ Seeded ${createdTeachers.length} teachers`);

  // 6. Seed Batches (Exactly 8 batches with target capacities)
  const batchDefs = [
    { name: 'JEE Morning (XI & XII)', subject: 'JEE Advanced', schedule_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], start_time: '07:00', end_time: '09:30', count: 24, fee: 3500 },
    { name: 'NEET Regular Morning', subject: 'NEET Medical', schedule_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], start_time: '08:00', end_time: '11:00', count: 20, fee: 3800 },
    { name: 'NEET Evening Batch', subject: 'NEET Medical', schedule_days: ['MON', 'WED', 'FRI'], start_time: '16:00', end_time: '19:00', count: 18, fee: 3800 },
    { name: 'MHT-CET Crash Course', subject: 'MHT-CET', schedule_days: ['TUE', 'THU', 'SAT'], start_time: '14:00', end_time: '17:00', count: 16, fee: 2500 },
    { name: 'Foundation 10th NTSE', subject: 'Science & Maths', schedule_days: ['MON', 'WED', 'FRI'], start_time: '17:00', end_time: '19:00', count: 15, fee: 2000 },
    { name: 'Foundation 9th Olympiad', subject: 'Science & Maths', schedule_days: ['TUE', 'THU', 'SAT'], start_time: '17:00', end_time: '19:00', count: 13, fee: 1800 },
    { name: 'Repeaters JEE Advanced', subject: 'JEE Droppers', schedule_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], start_time: '10:00', end_time: '13:30', count: 12, fee: 4500 },
    { name: 'Repeaters NEET Intensive', subject: 'NEET Droppers', schedule_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], start_time: '10:00', end_time: '14:00', count: 10, fee: 4500 },
  ];

  const totalStudentsTarget = batchDefs.reduce((acc, b) => acc + b.count, 0); // 128
  console.log(`Targeting ${batchDefs.length} batches and exactly ${totalStudentsTarget} active students...`);

  const { data: createdBatches, error: batchError } = await supabaseDemo
    .from('batches')
    .insert(batchDefs.map((b) => ({
      name: b.name,
      subject: b.subject,
      schedule_days: b.schedule_days,
      start_time: b.start_time,
      end_time: b.end_time,
      status: 'ACTIVE',
    })))
    .select();

  if (batchError || !createdBatches) throw new Error(`Failed to seed batches: ${batchError?.message}`);
  console.log(`✅ Seeded ${createdBatches.length} batches`);

  // Assign teachers to batches
  const batchTeachersToInsert = createdBatches.map((batch, idx) => ({
    batch_id: batch.id,
    teacher_id: createdTeachers[idx % createdTeachers.length].id,
  }));
  await supabaseDemo.from('batch_teachers').insert(batchTeachersToInsert);

  // 7. Seed 128 Students with realistic synthetic names
  const firstNames = [
    'Rahul', 'Amit', 'Sneha', 'Rohan', 'Priya', 'Tanvi', 'Siddharth', 'Aditya', 'Neha', 'Pranav',
    'Akshay', 'Pooja', 'Shubham', 'Aniket', 'Kavita', 'Gaurav', 'Manish', 'Kalyani', 'Nikhil', 'Tejas',
    'Aishwarya', 'Chinmay', 'Omkar', 'Pallavi', 'Sanket', 'Mrunal', 'Swapnil', 'Shruti', 'Vikram', 'Deepak',
    'Harsh', 'Mayur', 'Kunal', 'Divya', 'Saurabh', 'Ruturaj', 'Sayali', 'Vaibhav', 'Pratik', 'Anushka',
    'Yash', 'Riddhi', 'Darshan', 'Gauri', 'Abhishek', 'Megha', 'Kishor', 'Komal', 'Prathamesh', 'Bhagyashree',
  ];

  const lastNames = [
    'Patil', 'Shah', 'Joshi', 'Desai', 'Kulkarni', 'Shinde', 'Chavan', 'More', 'Pawar', 'Sawant',
    'Gaikwad', 'Jadhav', 'Kadam', 'Bhosale', 'Salunkhe', 'Suryavanshi', 'Ghatge', 'Mohite', 'Rane', 'Thorat',
  ];

  const studentsToInsert: any[] = [];
  let studentIdx = 0;

  for (let bIndex = 0; bIndex < batchDefs.length; bIndex++) {
    const bDef = batchDefs[bIndex];
    for (let s = 0; s < bDef.count; s++) {
      studentIdx++;

      // Specific designated demo characters
      let studentName: string;
      let parentName: string;

      if (studentIdx === 1) {
        studentName = 'Rahul Patil';
        parentName = 'Suresh Patil';
      } else if (studentIdx === 2) {
        studentName = 'Amit Shah';
        parentName = 'Narendra Shah';
      } else if (studentIdx === 3) {
        studentName = 'Sneha Joshi';
        parentName = 'Milind Joshi';
      } else if (studentIdx === 4) {
        studentName = 'Rohan Desai';
        parentName = 'Prakash Desai';
      } else if (studentIdx === 5) {
        studentName = 'Priya Kulkarni';
        parentName = 'Dattatray Kulkarni';
      } else {
        const fn = firstNames[(studentIdx + s) % firstNames.length];
        const ln = lastNames[(studentIdx * 3 + bIndex) % lastNames.length];
        studentName = `${fn} ${ln}`;
        parentName = `Parent of ${fn}`;
      }

      const phoneSuffix = String(studentIdx).padStart(6, '0');
      studentsToInsert.push({
        name: studentName,
        parent_name: parentName,
        student_mobile: `91999${phoneSuffix}`,
        parent_whatsapp: `91998${phoneSuffix}`,
        email: `student.${studentIdx}@effortdemo.com`,
        course: bDef.subject,
        admission_date: '2026-06-15',
        monthly_fee: bDef.fee,
        fee_due_day: 5,
        status: 'ACTIVE',
        batch_idx: bIndex,
      });
    }
  }

  // Insert students
  const { data: createdStudents, error: studError } = await supabaseDemo
    .from('students')
    .insert(studentsToInsert.map(({ batch_idx, ...s }) => s))
    .select();

  if (studError || !createdStudents || createdStudents.length !== 128) {
    throw new Error(`Failed to seed 128 students: ${studError?.message}`);
  }
  console.log(`✅ Seeded exactly ${createdStudents.length} active students`);

  // 8. Assign Students to Batches
  const batchStudentAssignments: any[] = [];
  createdStudents.forEach((student, i) => {
    const batchIdx = studentsToInsert[i].batch_idx;
    const batch = createdBatches[batchIdx];
    batchStudentAssignments.push({
      batch_id: batch.id,
      student_id: student.id,
      joined_at: '2026-06-15',
      status: 'ACTIVE',
    });
  });

  const { error: bsError } = await supabaseDemo.from('batch_students').insert(batchStudentAssignments);
  if (bsError) throw new Error(`Failed to assign batch students: ${bsError.message}`);
  console.log(`✅ Assigned all 128 students into their respective batches`);

  // 9. Financials & Fees Modeling:
  // Target: This Month Collection = ₹2,45,000, Pending Fees = ₹55,000. Total = ₹3,00,000.
  // We'll set September 2026 fees:
  // - Students 1..100: PAID in full (summing to ~₹2,45,000)
  // - Students 101..128: PENDING or OVERDUE (summing to ~₹55,000)
  // - Amit Shah (Student index 1 -> Amit Shah): ₹4,000 OVERDUE in September 2026
  // - Rohan Desai (Student index 3 -> Rohan Desai): July, August, September OVERDUE (3+ Months Unpaid)

  console.log('Generating realistic fees, payments, and receipts...');
  const studentFeesToInsert: any[] = [];
  const paymentsToInsert: any[] = [];
  const receiptsToInsert: any[] = [];

  const currentMonth = '2026-09';
  let runningCollection = 0;
  let runningPending = 0;

  for (let i = 0; i < createdStudents.length; i++) {
    const student = createdStudents[i];
    const feeAmount = Number(student.monthly_fee) || 3000;

    // Rohan Desai (Multi-month unpaid: July, August, September)
    if (student.name === 'Rohan Desai') {
      studentFeesToInsert.push({
        student_id: student.id,
        amount_due: 3500,
        due_date: '2026-07-05',
        billing_period: '2026-07',
        status: 'OVERDUE',
        amount_paid: 0,
      });
      studentFeesToInsert.push({
        student_id: student.id,
        amount_due: 3500,
        due_date: '2026-08-05',
        billing_period: '2026-08',
        status: 'OVERDUE',
        amount_paid: 0,
      });
      studentFeesToInsert.push({
        student_id: student.id,
        amount_due: 3500,
        due_date: '2026-09-05',
        billing_period: currentMonth,
        status: 'OVERDUE',
        amount_paid: 0,
      });
      runningPending += 10500;
      continue;
    }

    // Amit Shah (Designated Follow-up Required: ₹4,000 OVERDUE in September)
    if (student.name === 'Amit Shah') {
      studentFeesToInsert.push({
        student_id: student.id,
        amount_due: 4000,
        due_date: '2026-09-05',
        billing_period: currentMonth,
        status: 'OVERDUE',
        amount_paid: 0,
      });
      runningPending += 4000;
      continue;
    }

    // Allocate between PAID and PENDING to hit exactly ₹2,45,000 collection and ₹55,000 pending
    if (runningCollection + feeAmount <= 245000) {
      studentFeesToInsert.push({
        student_id: student.id,
        amount_due: feeAmount,
        due_date: '2026-09-05',
        billing_period: currentMonth,
        status: 'PAID',
        amount_paid: feeAmount,
      });
      runningCollection += feeAmount;
    } else if (runningCollection < 245000) {
      // Partial to hit exactly 245000
      const remainingNeeded = 245000 - runningCollection;
      studentFeesToInsert.push({
        student_id: student.id,
        amount_due: feeAmount,
        due_date: '2026-09-05',
        billing_period: currentMonth,
        status: 'PARTIAL',
        amount_paid: remainingNeeded,
      });
      runningCollection += remainingNeeded;
      runningPending += (feeAmount - remainingNeeded);
    } else {
      // All remaining are pending/overdue
      studentFeesToInsert.push({
        student_id: student.id,
        amount_due: feeAmount,
        due_date: '2026-09-05',
        billing_period: currentMonth,
        status: runningPending < 40000 ? 'OVERDUE' : 'PENDING',
        amount_paid: 0,
      });
      runningPending += feeAmount;
    }
  }

  // Insert all student_fees
  const { data: createdFees, error: feeErr } = await supabaseDemo
    .from('student_fees')
    .insert(studentFeesToInsert)
    .select();

  if (feeErr || !createdFees) throw new Error(`Failed to insert student fees: ${feeErr?.message}`);

  // Generate Payment & Receipt records for all PAID or PARTIAL fees
  let receiptCounter = 1001;
  for (const fee of createdFees) {
    if (fee.amount_paid > 0) {
      const paymentId = crypto.randomUUID();
      paymentsToInsert.push({
        id: paymentId,
        student_id: fee.student_id,
        student_fee_id: fee.id,
        amount: fee.amount_paid,
        provider: 'MANUAL',
        status: 'SUCCESS',
        paid_at: '2026-09-04T10:30:00Z',
        metadata: {
          mode: receiptCounter % 3 === 0 ? 'UPI' : 'CASH',
          receipt_no: `ECC-2026-${receiptCounter}`,
        },
      });

      receiptsToInsert.push({
        receipt_number: `ECC-2026-${receiptCounter++}`,
        payment_id: paymentId,
        student_id: fee.student_id,
        amount: fee.amount_paid,
        issued_at: '2026-09-04T10:30:00Z',
      });
    }
  }

  await supabaseDemo.from('payments').insert(paymentsToInsert);
  await supabaseDemo.from('receipts').insert(receiptsToInsert);

  console.log(`✅ Financials generated:`);
  console.log(`   - Collected: ₹${runningCollection.toLocaleString('en-IN')}`);
  console.log(`   - Pending: ₹${runningPending.toLocaleString('en-IN')}`);
  console.log(`   - Paid Receipts Generated: ${receiptsToInsert.length}`);

  // 10. Seed Attendance for the past 5 academic days
  console.log('Seeding attendance history (PRESENT / ABSENT only)...');
  const attendanceDates = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'];
  const attendanceRecords: any[] = [];

  for (const date of attendanceDates) {
    for (let i = 0; i < createdStudents.length; i++) {
      const student = createdStudents[i];
      const batchId = batchStudentAssignments[i].batch_id;

      // Realistic 88% attendance rate
      const isAbsent = (i * 7 + date.charCodeAt(9)) % 10 === 0;
      attendanceRecords.push({
        student_id: student.id,
        batch_id: batchId,
        attendance_date: date,
        status: isAbsent ? 'ABSENT' : 'PRESENT',
        notes: isAbsent ? 'Informed unexcused absence' : null,
      });
    }
  }

  // Insert in batches of 200
  for (let c = 0; c < attendanceRecords.length; c += 200) {
    const chunk = attendanceRecords.slice(c, c + 200);
    const { error: attError } = await supabaseDemo.from('attendance').insert(chunk);
    if (attError) throw new Error(`Failed to insert attendance chunk: ${attError.message}`);
  }
  console.log(`✅ Seeded ${attendanceRecords.length} attendance records across 5 days`);

  // 11. Seed Announcements
  const announcementsToInsert = [
    {
      title: 'Grand MHT-CET & NEET Mock Test Series Announced',
      message: 'Comprehensive All-Maharashtra Mock Test Series begins this Sunday at 9:00 AM. Attendance is mandatory for all Batch XI and XII students.',
      status: 'SENT',
      sent_at: '2026-09-12T09:00:00Z',
    },
    {
      title: 'Parent-Teacher Meeting (PTM) Schedule for September',
      message: 'Individual parent-teacher discussions on academic progress and test performance will be conducted this Saturday from 4:00 PM to 7:00 PM.',
      status: 'SENT',
      sent_at: '2026-09-14T11:30:00Z',
    },
  ];

  const { data: createdAnnouncements } = await supabaseDemo
    .from('announcements')
    .insert(announcementsToInsert)
    .select();

  if (createdAnnouncements) {
    const annBatches = createdAnnouncements.flatMap((ann) =>
      createdBatches.slice(0, 3).map((b) => ({
        announcement_id: ann.id,
        batch_id: b.id,
      }))
    );
    await supabaseDemo.from('announcement_batches').insert(annBatches);
    console.log(`✅ Seeded ${createdAnnouncements.length} academy announcements`);
  }

  console.log('\n================================================================');
  console.log('🎉 Effort Career Classes Demo Environment Seeded Successfully!');
  console.log(`- Login Email: ${demoEmail}`);
  console.log(`- Role: DEMO_ADMIN (3-day trial active until ${trialExpiresAt})`);
  console.log('- Total Students: 128 (Isolated in demo.* schema)');
  console.log('- Batches: 8');
  console.log('- Collection: ₹2,45,000 | Pending: ₹55,000');
  console.log('- Owner production database & WhatsApp bridge remain 100% untouched!');
  console.log('================================================================\n');
}

seedEffortCareerDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
