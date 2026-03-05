import { PrismaClient } from '../lib/generated/auth-client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('admin1234', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@dbs.com' },
    update: {},
    create: {
      email:    'admin@dbs.com',
      password: hashed,
      name:     '관리자',
      role:     'ADMIN',
    },
  });

  console.log('✅ 시드 완료');
  console.log('   이메일:', admin.email);
  console.log('   비밀번호: admin1234');
  console.log('   권한:', admin.role);
}

main()
  .catch(e => { console.error('❌ 시드 실패:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
