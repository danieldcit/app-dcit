// Seeds the reference/demo data that has no in-app "create" flow — HR
// facts (hire date, vacation history), payslips, and (as later modules add
// models here) mural posts, birthdays, benefit partners, onboarding tasks.
// Run with `npx prisma db seed` (idempotent: upserts, safe to re-run).
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Same value for every dev account — this is local/demo data, not a real
// credential. Login form: email above + "dev12345".
const DEV_PASSWORD = 'dev12345';

const DEV_ACCOUNTS = [
  {
    userId: 'colaborador-1',
    name: 'Ana Colaboradora',
    role: 'colaborador',
    email: 'colaborador@dev.local',
    phone: '+5511900000001',
  },
  {
    userId: 'gestor-1',
    name: 'Bruno Gestor',
    role: 'gestor',
    email: 'gestor@dev.local',
    phone: '+5511900000002',
  },
  {
    userId: 'rh-1',
    name: 'Carla RH',
    role: 'rh',
    email: 'rh@dev.local',
    phone: '+5511900000003',
  },
];

async function seedEmployees() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  for (const account of DEV_ACCOUNTS) {
    await prisma.employee.upsert({
      where: { userId: account.userId },
      update: {
        email: account.email,
        phone: account.phone,
        passwordHash,
      },
      create: {
        userId: account.userId,
        name: account.name,
        role: account.role,
        email: account.email,
        phone: account.phone,
        passwordHash,
        hireDate: new Date(Date.UTC(2024, 2, 15)),
      },
    });
  }
}

async function seedVacationHistory() {
  for (const account of DEV_ACCOUNTS) {
    const existing = await prisma.vacationHistoryEntry.findFirst({
      where: { userId: account.userId },
    });
    if (existing) continue;

    await prisma.vacationHistoryEntry.createMany({
      data: [
        {
          userId: account.userId,
          year: 2024,
          daysTaken: 30,
          startDate: new Date(Date.UTC(2024, 6, 8)),
          endDate: new Date(Date.UTC(2024, 7, 6)),
        },
        {
          userId: account.userId,
          year: 2025,
          daysTaken: 20,
          startDate: new Date(Date.UTC(2025, 11, 15)),
          endDate: new Date(Date.UTC(2026, 0, 3)),
        },
      ],
    });
  }
}

async function seedPayslips() {
  for (const account of DEV_ACCOUNTS) {
    const existing = await prisma.payslip.findFirst({
      where: { userId: account.userId },
    });
    if (existing) continue;

    await prisma.payslip.createMany({
      data: [
        { userId: account.userId, label: 'Julho 2026', gross: 6200, inss: 682, irrf: 410, benefits: 380 },
        { userId: account.userId, label: 'Junho 2026', gross: 6200, inss: 682, irrf: 410, benefits: 380 },
        { userId: account.userId, label: 'Maio 2026', gross: 5950, inss: 654, irrf: 372, benefits: 380 },
        { userId: account.userId, label: 'Abril 2026', gross: 5950, inss: 654, irrf: 372, benefits: 380 },
      ],
    });
  }
}

async function seedAdmissionDocuments() {
  for (const account of DEV_ACCOUNTS) {
    const existing = await prisma.admissionDocument.findFirst({
      where: { userId: account.userId },
    });
    if (existing) continue;

    await prisma.admissionDocument.createMany({
      data: [
        {
          userId: account.userId,
          title: 'Contrato de trabalho assinado',
          status: 'aprovado',
          submittedAt: new Date(Date.UTC(2024, 2, 15)),
        },
        {
          userId: account.userId,
          title: 'Documento de identidade (RG/CPF)',
          status: 'aprovado',
          submittedAt: new Date(Date.UTC(2024, 2, 15)),
        },
        {
          userId: account.userId,
          title: 'Comprovante de residência',
          status: 'aprovado',
          submittedAt: new Date(Date.UTC(2024, 2, 15)),
        },
        {
          userId: account.userId,
          title: 'Exame admissional',
          status: 'aprovado',
          submittedAt: new Date(Date.UTC(2024, 2, 14)),
        },
      ],
    });
  }
}

async function seedMural() {
  const existingPosts = await prisma.muralPost.findFirst();
  if (!existingPosts) {
    await prisma.muralPost.createMany({
      data: [
        {
          glyph: '🎉',
          title: 'Bem-vindo(a), Marina!',
          body: 'A equipe de Suporte ganhou uma nova integrante. Dê as boas-vindas!',
          createdAt: new Date('2026-08-25T09:00:00.000Z'),
        },
        {
          glyph: '🎁',
          title: 'Nova parceria no clube de vantagens',
          body: 'Academia Smart Fit agora com 20% de desconto para colaboradores DCIT. Confira no app.',
          createdAt: new Date('2026-08-20T09:00:00.000Z'),
        },
        {
          glyph: '🏆',
          title: 'Resultado do trimestre',
          body: 'Batemos a meta de satisfação dos clientes em 96%. Parabéns a todos!',
          createdAt: new Date('2026-08-12T09:00:00.000Z'),
        },
        {
          glyph: '🛠️',
          title: 'Manutenção programada',
          body: 'O sistema ficará indisponível no sábado das 2h às 4h para atualização.',
          createdAt: new Date('2026-08-05T09:00:00.000Z'),
        },
      ],
    });
  }

  const existingBirthdays = await prisma.birthday.findFirst();
  if (!existingBirthdays) {
    await prisma.birthday.createMany({
      data: [
        { name: 'Ana Colaboradora', day: 26, month: 8 },
        { name: 'Bruno Gestor', day: 30, month: 8 },
        { name: 'Carla RH', day: 14, month: 9 },
      ],
    });
  }
}

async function seedBeneficios() {
  for (const account of DEV_ACCOUNTS) {
    const existing = await prisma.benefitBalance.findFirst({
      where: { userId: account.userId },
    });
    if (existing) continue;

    await prisma.benefitBalance.createMany({
      data: [
        {
          userId: account.userId,
          icon: 'restaurant-outline',
          label: 'Vale-refeição',
          balance: 412.5,
          monthlyCredit: 600,
        },
        {
          userId: account.userId,
          icon: 'bus-outline',
          label: 'Vale-transporte',
          balance: 88.0,
          monthlyCredit: 220,
        },
        {
          userId: account.userId,
          icon: 'medkit-outline',
          label: 'Plano de saúde',
          balance: 0,
          monthlyCredit: 0,
        },
      ],
    });
  }

  const existingPartners = await prisma.partner.findFirst();
  if (!existingPartners) {
    await prisma.partner.createMany({
      data: [
        { name: 'Smart Fit', category: 'Academia', discount: '20% de desconto' },
        { name: 'Drogaria São Paulo', category: 'Farmácia', discount: '15% em genéricos' },
        { name: 'Alura', category: 'Cursos', discount: '30% em qualquer plano' },
        { name: 'Cinemark', category: 'Cinema', discount: 'Ingresso com 40% off' },
      ],
    });
  }
}

async function seedOnboarding() {
  await prisma.onboardingTask.updateMany({
    where: { title: 'Enviar documentos' },
    data: { requiresUpload: true },
  });
  await prisma.onboardingTask.updateMany({
    where: { title: 'Assistir ao vídeo de boas-vindas' },
    data: { requiresVideo: true },
  });
  await prisma.onboardingTask.updateMany({
    where: { title: 'Conhecer o time' },
    data: { showsTeam: true },
  });
  await prisma.onboardingTask.updateMany({
    where: { title: 'Assinar o contrato' },
    data: { requiresContract: true },
  });
  await prisma.onboardingTask.updateMany({
    where: { title: 'Configurar seus acessos' },
    data: { requiresAccessChecklist: true },
  });

  const existing = await prisma.onboardingTask.findFirst();
  if (existing) return;

  await prisma.onboardingTask.createMany({
    data: [
      {
        icon: 'document-text-outline',
        title: 'Assinar o contrato',
        description: 'Revise e assine seu contrato de trabalho digitalmente.',
        order: 1,
        requiresContract: true,
      },
      {
        icon: 'cloud-upload-outline',
        title: 'Enviar documentos',
        description: 'RG, CPF, comprovante de residência e demais documentos admissionais.',
        order: 2,
        requiresUpload: true,
      },
      {
        icon: 'play-circle-outline',
        title: 'Assistir ao vídeo de boas-vindas',
        description: 'Conheça a cultura e os valores da DCIT Tecnologia.',
        order: 3,
        requiresVideo: true,
      },
      {
        icon: 'people-outline',
        title: 'Conhecer o time',
        description: 'Veja quem são as pessoas com quem você vai trabalhar.',
        order: 4,
        showsTeam: true,
      },
      {
        icon: 'key-outline',
        title: 'Configurar seus acessos',
        description: 'E-mail corporativo, ferramentas internas e este app.',
        order: 5,
        requiresAccessChecklist: true,
      },
    ],
  });
}

async function main() {
  await seedEmployees();
  await seedVacationHistory();
  await seedPayslips();
  await seedAdmissionDocuments();
  await seedMural();
  await seedBeneficios();
  await seedOnboarding();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
