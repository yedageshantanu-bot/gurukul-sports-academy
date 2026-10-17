import { supabaseAdmin } from '../config/supabase.js';

export async function seedGurukulDemo() {
  console.log('🥋 Seeding Gurukul Sports & Martial Arts Academy Data...');

  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized');
    process.exit(1);
  }

  // 1. Academy Settings
  const { data: existingSettings } = await supabaseAdmin.from('academy_settings').select('*').limit(1);
  const academyPayload = {
    academy_name: 'Gurukul Sports & Martial Arts Academy',
    phone: '+91 98765 43210',
    email: 'admin@gurukulsports.in',
    address: 'Gurukul Combat Arena & Sports Complex, Athletics Track & Dojo, Pune, Maharashtra',
    website: 'https://gurukulsports.in',
    currency: 'INR',
    logo_url: '/logo.png',
    updated_at: new Date().toISOString(),
  };

  if (existingSettings && existingSettings.length > 0) {
    await supabaseAdmin.from('academy_settings').update(academyPayload).eq('id', existingSettings[0].id);
    console.log('✅ Updated Academy Settings to "Gurukul Sports & Martial Arts Academy"');
  } else {
    await supabaseAdmin.from('academy_settings').insert(academyPayload);
    console.log('✅ Created Academy Settings for "Gurukul Sports & Martial Arts Academy"');
  }

  // 2. Coaches / Instructors
  const coachData = [
    {
      name: 'Sensei Vikram Salunkhe',
      email: 'teacher@gurukulsports.in',
      phone: '+91 98220 11223',
      subject: 'Head Martial Arts & MMA Master (4th Dan)',
      status: 'ACTIVE',
    },
    {
      name: 'Coach Rajesh Sharma',
      email: 'rajesh.coach@gurukulsports.in',
      phone: '+91 98220 99887',
      subject: 'Head Athletics & Sprint Coach (National Medalist)',
      status: 'ACTIVE',
    },
  ];

  // 2. Coaches & Senseis (Bulk Lookup & Insert)
  const coachEmails = coachData.map((c) => c.email);
  const { data: existingCoaches } = await supabaseAdmin.from('teachers').select('*').in('email', coachEmails);
  const coachMap = new Map((existingCoaches || []).map((c: any) => [c.email, c]));
  const missingCoaches = coachData.filter((c) => !coachMap.has(c.email));
  let coaches: any[] = Array.from(coachMap.values());

  if (missingCoaches.length > 0) {
    const { data: created, error } = await supabaseAdmin.from('teachers').insert(missingCoaches as any).select();
    if (error) console.error('Error inserting coaches:', error.message);
    else if (created) coaches = [...coaches, ...created];
  }
  console.log(`✅ Loaded ${coaches.length} Coaches & Senseis (Bulk)`);

  // 3. Batches (Martial Arts, Boxing & Athletics)
  const batchDefinitions = [
    {
      name: 'MMA & Combat Sparring Squad',
      subject: 'Mixed Martial Arts, Grappling & Sparring',
      schedule_days: ['Mon', 'Wed', 'Fri'],
      start_time: '06:00:00',
      end_time: '08:00:00',
      status: 'ACTIVE',
    },
    {
      name: 'Karate & Taekwondo Black Belt Division',
      subject: 'Kata, Kumite & Belt Progression',
      schedule_days: ['Tue', 'Thu', 'Sat'],
      start_time: '16:30:00',
      end_time: '18:30:00',
      status: 'ACTIVE',
    },
    {
      name: 'Track & Sprint Speed Training Camp',
      subject: '100m/200m Sprint Drills & Endurance',
      schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      start_time: '06:30:00',
      end_time: '08:30:00',
      status: 'ACTIVE',
    },
    {
      name: 'Junior Athletics & Agility Foundation',
      subject: 'Motor Skills, Reflexes & Multi-Sport Conditioning',
      schedule_days: ['Mon', 'Wed', 'Fri'],
      start_time: '17:00:00',
      end_time: '18:30:00',
      status: 'ACTIVE',
    },
    {
      name: 'Boxing & Fight Conditioning Batch',
      subject: 'Footwork, Bag Work, Sparring & Core Power',
      schedule_days: ['Mon', 'Wed', 'Fri', 'Sat'],
      start_time: '19:00:00',
      end_time: '21:00:00',
      status: 'ACTIVE',
    },
  ];

  const batchNames = batchDefinitions.map((b) => b.name);
  const { data: existingBatches } = await supabaseAdmin.from('batches').select('*').in('name', batchNames);
  const batchMap = new Map((existingBatches || []).map((b: any) => [b.name, b]));
  const missingBatches = batchDefinitions.filter((b) => !batchMap.has(b.name));
  let batches: any[] = Array.from(batchMap.values());

  if (missingBatches.length > 0) {
    const { data: created, error } = await supabaseAdmin.from('batches').insert(missingBatches).select();
    if (error) console.error('Error creating batches:', error.message);
    else if (created) batches = [...batches, ...created];
  }
  console.log(`✅ Loaded ${batches.length} Sports & Martial Arts Batches (Bulk)`);

  // Assign coaches to batches in bulk
  if (coaches.length > 0 && batches.length > 0) {
    const leadCoach = coaches[0];
    const assignments = batches.map((b) => ({
      batch_id: b.id,
      teacher_id: leadCoach.id,
    }));
    await supabaseAdmin.from('batch_teachers').upsert(assignments, { onConflict: 'batch_id,teacher_id' });
    console.log(`✅ Assigned Head Coach to ${batches.length} squads (Bulk)`);
  }

  // 4. Students / Athletes
  const athletes = [
    {
      name: 'Aarav Patil',
      parent_name: 'Sanjay Patil',
      parent_whatsapp: '+919876543201',
      student_mobile: '+919876543201',
      email: 'aarav.patil@example.com',
      course: 'Mixed Martial Arts',
      monthly_fee: 3500,
      fee_due_day: 5,
      status: 'ACTIVE',
    },
    {
      name: 'Rohan Kadam',
      parent_name: 'Dattatray Kadam',
      parent_whatsapp: '+919876543202',
      student_mobile: '+919876543202',
      email: 'rohan.kadam@example.com',
      course: 'Track & Sprinting',
      monthly_fee: 3000,
      fee_due_day: 10,
      status: 'ACTIVE',
    },
    {
      name: 'Ananya Deshmukh',
      parent_name: 'Mahesh Deshmukh',
      parent_whatsapp: '+919876543203',
      student_mobile: '+919876543203',
      email: 'ananya.deshmukh@example.com',
      course: 'Karate & Taekwondo',
      monthly_fee: 2800,
      fee_due_day: 5,
      status: 'ACTIVE',
    },
    {
      name: 'Siddharth Jadhav',
      parent_name: 'Anil Jadhav',
      parent_whatsapp: '+919876543204',
      student_mobile: '+919876543204',
      email: 'siddharth.jadhav@example.com',
      course: 'Boxing & Combat',
      monthly_fee: 3200,
      fee_due_day: 15,
      status: 'ACTIVE',
    },
    {
      name: 'Tanvi Shinde',
      parent_name: 'Vikas Shinde',
      parent_whatsapp: '+919876543205',
      student_mobile: '+919876543205',
      email: 'tanvi.shinde@example.com',
      course: 'Junior Athletics Foundation',
      monthly_fee: 2500,
      fee_due_day: 5,
      status: 'ACTIVE',
    },
    {
      name: 'Varun Gaikwad',
      parent_name: 'Sunil Gaikwad',
      parent_whatsapp: '+919876543206',
      student_mobile: '+919876543206',
      email: 'varun.gaikwad@example.com',
      course: 'MMA & Grappling',
      monthly_fee: 3500,
      fee_due_day: 10,
      status: 'ACTIVE',
    },
  ];

  const athleteEmails = athletes.map((a) => a.email);
  const { data: existingAthletes } = await supabaseAdmin.from('students').select('*').in('email', athleteEmails);
  const athleteMap = new Map((existingAthletes || []).map((a: any) => [a.email, a]));
  const missingAthletes = athletes.filter((a) => !athleteMap.has(a.email));
  let studentRecords: any[] = Array.from(athleteMap.values());

  if (missingAthletes.length > 0) {
    const { data: created, error } = await supabaseAdmin.from('students').insert(missingAthletes).select();
    if (error) console.error('Error creating athletes:', error.message);
    else if (created) studentRecords = [...studentRecords, ...created];
  }

  // Bulk assign to batches
  if (batches.length > 0 && studentRecords.length > 0) {
    const enrollments = studentRecords.map((stu, i) => ({
      batch_id: batches[i % batches.length].id,
      student_id: stu.id,
      status: 'ACTIVE',
    }));
    await supabaseAdmin.from('batch_students').upsert(enrollments, { onConflict: 'batch_id,student_id' });
  }
  console.log(`✅ Loaded ${studentRecords.length} Athletes & Enrolled in Squads (Bulk)`);

  // 5. Generate Current Month Student Fees & Followups in Bulk
  const now = new Date();
  const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const studentIds = studentRecords.map((s) => s.id);

  const { data: existingFees } = await supabaseAdmin
    .from('student_fees')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('billing_period', currentBillingPeriod);

  const existingFeeStudentIds = new Set((existingFees || []).map((f: any) => f.student_id));
  const feesToInsert: any[] = [];

  studentRecords.forEach((stu, i) => {
    if (!existingFeeStudentIds.has(stu.id)) {
      const amountDue = stu.monthly_fee || 3000;
      const isPaid = i < 3;
      const amountPaid = isPaid ? amountDue : 0;
      const feeStatus = isPaid ? 'PAID' : i === 3 ? 'OVERDUE' : 'PENDING';
      const dueDate = new Date(now.getFullYear(), now.getMonth(), stu.fee_due_day || 10).toISOString().split('T')[0];

      feesToInsert.push({
        student_id: stu.id,
        billing_period: currentBillingPeriod,
        amount_due: amountDue,
        amount_paid: amountPaid,
        due_date: dueDate,
        status: feeStatus,
        _isPaid: isPaid,
      });
    }
  });

  if (feesToInsert.length > 0) {
    const insertPayload = feesToInsert.map(({ _isPaid, ...rest }) => rest);
    const { data: createdFees, error: feeErr } = await supabaseAdmin
      .from('student_fees')
      .insert(insertPayload)
      .select();

    if (!feeErr && createdFees) {
      const paymentsToInsert: any[] = [];
      createdFees.forEach((fee: any, idx: number) => {
        if (feesToInsert[idx]?._isPaid) {
          paymentsToInsert.push({
            student_fee_id: fee.id,
            student_id: fee.student_id,
            amount: fee.amount_paid,
            payment_method: 'UPI',
            payment_date: new Date().toISOString(),
            status: 'SUCCESS',
          });
        }
      });

      if (paymentsToInsert.length > 0) {
        await supabaseAdmin.from('payments').insert(paymentsToInsert);
      }
    }
  }
  console.log('✅ Generated Monthly Fees & Payment Records for Athletes (Bulk)');

  // 6. Attendance Records in Bulk
  if (batches.length > 0 && studentRecords.length > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const firstBatch = batches[0];
    const attendanceBatch = studentRecords.slice(0, 4).map((stu, i) => ({
      student_id: stu.id,
      batch_id: firstBatch.id,
      date: todayStr,
      status: i === 3 ? 'ABSENT' : 'PRESENT',
    }));

    await supabaseAdmin.from('attendance').upsert(attendanceBatch, {
      onConflict: 'student_id,batch_id,date',
    });
    console.log('✅ Generated Today Attendance Roll Call for Combat Squad (Bulk)');
  }

  console.log('🎉 Gurukul Sports & Martial Arts Academy Database is 100% READY!');
}

if (process.argv[1]?.endsWith('seedGurukulDemo.ts')) {
  seedGurukulDemo().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
