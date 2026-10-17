import { supabaseAdmin } from '../config/supabase.js';

async function runBenchmark() {
  console.log('--- STARTING ROW-BY-ROW VS BULK OPERATION BENCHMARK ---');
  if (!supabaseAdmin) {
    console.error('Supabase client unavailable');
    process.exit(1);
  }

  // Generate 500 synthetic test items
  const count = 500;
  const items = Array.from({ length: count }, (_, i) => ({
    title: `Benchmark Announcement ${i}`,
    message: `Test payload message number ${i} for performance audit benchmarking.`,
    priority: 'LOW',
    channels: ['IN_APP'],
    target_roles: ['STUDENT'],
    status: 'DRAFT',
  }));

  // Benchmark A: Sequential row-by-row processing simulation (e.g. 100 items or 500 items bounded)
  // To avoid exhausting rate limits on Supabase free tier while accurately measuring:
  // Measure 50 sequential items and extrapolate to 500 items.
  const sampleCount = 50;
  console.log(`Testing sequential row-by-row operations (${sampleCount} items)...`);
  const seqStart = performance.now();
  const createdIdsSeq: string[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        ...items[i],
        title: `Seq ${i} ${Date.now()}`,
      })
      .select('id')
      .single();
    if (data?.id) createdIdsSeq.push(data.id);
  }
  const seqDuration = performance.now() - seqStart;
  const seqEstimated500 = (seqDuration / sampleCount) * 500;
  console.log(`Sequential: ${sampleCount} items took ${Math.round(seqDuration)} ms (~${Math.round(seqEstimated500)} ms extrapolated for 500 items)`);

  // Cleanup sequential sample
  if (createdIdsSeq.length > 0) {
    await supabaseAdmin.from('announcements').delete().in('id', createdIdsSeq);
  }

  // Benchmark B: Batched bulk operation (in chunks of 100) for 500 items
  console.log(`Testing batched bulk operations (500 items in 100-item chunks)...`);
  const bulkStart = performance.now();
  const chunkSize = 100;
  const createdIdsBulk: string[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize).map((item, idx) => ({
      ...item,
      title: `Bulk ${i + idx} ${Date.now()}`,
    }));
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert(chunk)
      .select('id');
    if (data) {
      data.forEach((d: any) => createdIdsBulk.push(d.id));
    }
  }
  const bulkDuration = performance.now() - bulkStart;
  console.log(`Batched bulk: 500 items in chunks of 100 took ${Math.round(bulkDuration)} ms`);

  // Cleanup bulk sample
  if (createdIdsBulk.length > 0) {
    for (let i = 0; i < createdIdsBulk.length; i += 100) {
      await supabaseAdmin.from('announcements').delete().in('id', createdIdsBulk.slice(i, i + 100));
    }
  }

  const speedup = (seqEstimated500 / bulkDuration).toFixed(1);
  console.log(`\n>>> RESULT: Bulk operations are ${speedup}x FASTER (${Math.round(seqEstimated500)} ms vs ${Math.round(bulkDuration)} ms)`);

  return {
    sequential500Ms: Math.round(seqEstimated500),
    bulk500Ms: Math.round(bulkDuration),
    speedup: `${speedup}x`,
  };
}

runBenchmark()
  .then((res) => console.log('FINAL BENCHMARK SUMMARY:', JSON.stringify(res)))
  .catch(console.error);
