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
      id: 'a02e9080-7cd2-4590-91f7-3272be4ba7ba',
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

  const coaches: any[] = [];
  for (const c of coachData) {
    const { data: existing } = await supabaseAdmin.from('teachers').select('*').eq('email', c.email).maybeSingle();
    if (existing) {
      coaches.push(existing);
    } else {
      const { data: created, error } = await supabaseAdmin.from('teachers').insert(c as any).select().single();
      if (error) console.error('Error inserting coach:', error.message);
      else coaches.push(created);
    }
  }
  console.log(`✅ Loaded ${coaches.length} Coaches & Senseis`);

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

  const batches: any[] = [];
  for (const bDef of batchDefinitions) {
    const { data: existing } = await supabaseAdmin.from('batches').select('*').eq('name', bDef.name).maybeSingle();
    if (existing) {
      batches.push(existing);
    } else {
      const { data: created, error } = await supabaseAdmin.from('batches').insert(bDef).select().single();
      if (error) console.error('Error creating batch:', error.message);
      else batches.push(created);
    }
  }
  console.log(`✅ Loaded ${batches.length} Sports & Martial Arts Batches`);

  // Assign coaches to batches
  if (coaches.length > 0 && batches.length > 0) {
    const leadCoach = coaches[0];
    for (const b of batches) {
      await supabaseAdmin.from('batch_teachers').upsert(
        { batch_id: b.id, teacher_id: leadCoach.id },
        { onConflict: 'batch_id,teacher_id' }
      );
    }
    console.log(`✅ Assigned Head Coach to ${batches.length} squads`);
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

  const studentRecords: any[] = [];
  for (let i = 0; i < athletes.length; i++) {
    const ath = athletes[i];
    const { data: existing } = await supabaseAdmin.from('students').select('*').eq('email', ath.email).maybeSingle();
    let stu = existing;
    if (!stu) {
      const { data: created, error } = await supabaseAdmin.from('students').insert(ath).select().single();
      if (error) {
        console.error('Error creating athlete:', error.message);
        continue;
      }
      stu = created;
    }
    studentRecords.push(stu);

    // Assign to batch
    const targetBatch = batches[i % batches.length];
    if (targetBatch && stu) {
      await supabaseAdmin.from('batch_students').upsert(
        { batch_id: targetBatch.id, student_id: stu.id, status: 'ACTIVE' },
        { onConflict: 'batch_id,student_id' }
      );
    }
  }
  console.log(`✅ Loaded ${studentRecords.length} Athletes & Enrolled in Squads`);

  // 5. Generate Current Month Student Fees & Followups
  const now = new Date();
  const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (let i = 0; i < studentRecords.length; i++) {
    const stu = studentRecords[i];
    const { data: feeExists } = await supabaseAdmin
      .from('student_fees')
      .select('*')
      .eq('student_id', stu.id)
      .eq('billing_period', currentBillingPeriod)
      .maybeSingle();

    if (!feeExists) {
      const amountDue = stu.monthly_fee || 3000;
      const isPaid = i < 3; // First 3 paid, rest pending/overdue
      const amountPaid = isPaid ? amountDue : 0;
      const feeStatus = isPaid ? 'PAID' : i === 3 ? 'OVERDUE' : 'PENDING';
      const dueDate = new Date(now.getFullYear(), now.getMonth(), stu.fee_due_day || 10).toISOString().split('T')[0];

      const { data: fee } = await supabaseAdmin
        .from('student_fees')
        .insert({
          student_id: stu.id,
          billing_period: currentBillingPeriod,
          amount_due: amountDue,
          amount_paid: amountPaid,
          due_date: dueDate,
          status: feeStatus,
        })
        .select()
        .single();

      if (isPaid && fee) {
        await supabaseAdmin.from('payments').insert({
          student_fee_id: fee.id,
          student_id: stu.id,
          amount: amountPaid,
          payment_method: 'UPI',
          payment_date: new Date().toISOString(),
          status: 'SUCCESS',
        });
      }
    }
  }
  console.log('✅ Generated Monthly Fees & Payment Records for Athletes');

  // 6. Attendance Records
  if (batches.length > 0 && studentRecords.length > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const firstBatch = batches[0];
    for (let i = 0; i < Math.min(studentRecords.length, 4); i++) {
      const stu = studentRecords[i];
      await supabaseAdmin.from('attendance').upsert(
        {
          student_id: stu.id,
          batch_id: firstBatch.id,
          date: todayStr,
          status: i === 3 ? 'ABSENT' : 'PRESENT',
        },
        { onConflict: 'student_id,batch_id,date' }
      );
    }
    console.log('✅ Generated Today Attendance Roll Call for Combat Squad');
  }

  console.log('🎉 Gurukul Sports & Martial Arts Academy Database is 100% READY!');
}

if (process.argv[1]?.endsWith('seedGurukulDemo.ts')) {
  seedGurukulDemo().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
