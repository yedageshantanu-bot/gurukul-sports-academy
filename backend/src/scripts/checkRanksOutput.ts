import { RankService } from '../services/rank.service.js';

async function check() {
  const cards = await RankService.listStudentRanks();
  console.log('TOTAL ATHLETE CARDS:', cards.length);
  for (const c of cards.slice(0, 10)) {
    console.log(`Student: ${c.student_name}, BeltColor: "${c.belt_color}", RankName: "${c.current_rank_name}", Reg: "${c.student_code}"`);
  }
}

check();
