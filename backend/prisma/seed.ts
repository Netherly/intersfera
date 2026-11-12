import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { EXAMPLE_LETTERS } from './examples.js';

const prisma = new PrismaClient();

const EMPLOYEE_PERMS = ['appeals.view', 'appeals.create', 'appeals.edit', 'materials.view'];

const EXTRA_ROLES: { name: string; permissions: string[] }[] = [
  { name: 'Юрист', permissions: ['legal.view'] },
  { name: 'Бухгалтер', permissions: ['accounting.view'] },
  { name: 'Техник', permissions: ['technical.view'] },
];

const ADDRESSEES = ['Краснодарводоканал', 'Краснодаргоргаз'];

// Перечень из «Нормативные и законодательные материалы». Повторы сведены в одну запись.
// citation — статьи и пункты, которые заказчик явно указал. Полный текст не приложен.
const NORMS: { title: string; citation: string }[] = [
  { title: 'ФЗ от 02.05.2006 № 59-ФЗ «О порядке рассмотрения обращений граждан Российской Федерации»', citation: '' },
  { title: 'Гражданский кодекс Российской Федерации (часть 1)', citation: '' },
  { title: 'ФЗ от 26.12.2008 № 294-ФЗ «О защите прав юридических лиц и индивидуальных предпринимателей при осуществлении государственного контроля (надзора) и муниципального контроля»', citation: '' },
  { title: 'Постановление Правительства РФ от 15.05.2013 № 416 «О порядке осуществления деятельности по управлению многоквартирными домами»', citation: 'Редакция от 13.09.2018, изменения с 01.03.2019' },
  { title: 'Приказ Минстроя России от 22.09.2025 № 572/пр «О внесении изменений в приказ Минстроя России от 01.12.2016 № 871/пр»', citation: '' },
  { title: 'Закон РФ от 07.02.1992 № 2300-1 «О защите прав потребителей»', citation: 'Статья 22; статья 29, пункт 1; статья 31, пункт 1' },
  { title: 'Постановление Правительства РФ от 06.05.2011 № 354 «О предоставлении коммунальных услуг собственникам и пользователям помещений в многоквартирных домах и жилых домов»', citation: '' },
  { title: 'Постановление Госстроя РФ от 27.09.2003 № 170 «Правила и нормы технической эксплуатации жилищного фонда»', citation: '' },
  { title: 'Постановление Правительства РФ от 03.04.2013 № 290 «О минимальном перечне услуг и работ, необходимых для обеспечения надлежащего содержания общего имущества в многоквартирном доме»', citation: '' },
  { title: 'Постановление Правительства РФ от 13.08.2006 № 491 «Правила содержания общего имущества в многоквартирном доме»', citation: '' },
  { title: 'СанПиН 2.1.3684-21', citation: 'Пункты 11, 13, 15' },
  { title: 'Постановление Правительства РФ от 07.03.2025 № 293 «О порядке обращения с твердыми коммунальными отходами»', citation: '' },
  { title: 'ФЗ от 07.12.2011 № 416-ФЗ «О водоснабжении и водоотведении»', citation: 'Статья 7, часть 1' },
  { title: 'ФЗ от 26.03.2003 № 35-ФЗ «Об электроэнергетике»', citation: 'Статья 3' },
  { title: 'ФЗ от 27.07.2010 № 190-ФЗ «О теплоснабжении»', citation: 'Статья 2' },
  { title: 'Постановление Правительства РФ от 21.07.2008 № 549 «О порядке поставки газа для обеспечения коммунально-бытовых нужд граждан»', citation: '' },
  { title: 'ФЗ от 23.11.2009 № 261-ФЗ «Об энергосбережении и о повышении энергетической эффективности»', citation: 'Статья 10' },
  { title: 'Приказ Минстроя России от 07.02.2024 № 79/пр «Об установлении состава, сроков и периодичности размещения информации в ГИС ЖКХ»', citation: '' },
  { title: 'Приказ Минстроя России от 22.09.2025 № 569/пр «Об утверждении свода правил „Здания жилые многоквартирные. Правила установления необходимости проведения капитального ремонта“»', citation: '' },
  { title: 'КоАП РФ', citation: 'Статьи 5.59, 7.21, 7.22, 7.23, 14.1.3' },
  { title: 'ФЗ от 17.01.1992 № 2202-1 «О прокуратуре Российской Федерации»', citation: '' },
  { title: 'Постановление Пленума Верховного Суда РФ от 27.06.2017 № 22', citation: 'Споры по оплате коммунальных услуг и жилого помещения' },
  { title: 'Приказ Минстроя России от 04.04.2024 № 240/пр', citation: 'Форма заявления о переустройстве и перепланировке' },
  { title: 'Конституция Российской Федерации', citation: '' },
  { title: 'Жилищный кодекс Российской Федерации', citation: '' },
];

const SUBJECTS = [
  'Горячее водоснабжение',
  'Затопление',
  'Электроснабжение',
  'Капитальный ремонт',
  'Обращение с ТКО',
  'Тарифы',
  'Договор управления',
  'Содержание общего имущества',
  'Запрос информации',
];

async function main() {
  const employee = await prisma.appRole.upsert({
    where: { name: 'Сотрудник' },
    update: { permissions: EMPLOYEE_PERMS },
    create: { name: 'Сотрудник', permissions: EMPLOYEE_PERMS },
  });
  console.log(`Роль "Сотрудник" готова (id=${employee.id}).`);

  for (const role of EXTRA_ROLES) {
    await prisma.appRole.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: { name: role.name, permissions: role.permissions },
    });
  }
  console.log(`Роли отделов: ${EXTRA_ROLES.length}.`);

  const placed = await prisma.user.updateMany({
    where: { role: 'user', departments: { isEmpty: true } },
    data: { departments: ['appeals'] },
  });
  if (placed.count) console.log(`Отдел обращений назначен пользователям: ${placed.count}`);

  for (const name of ADDRESSEES) {
    await prisma.addressee.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Адресаты: ${ADDRESSEES.length}.`);

  const assigned = await prisma.user.updateMany({
    where: { role: 'user', role_id: null },
    data: { role_id: employee.id },
  });
  if (assigned.count) console.log(`Привязано пользователей к "Сотруднику": ${assigned.count}`);

  for (const name of SUBJECTS) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Категории по примерам: ${SUBJECTS.length}.`);

  for (const norm of NORMS) {
    await prisma.material.upsert({
      where: { kind_title: { kind: 'norm', title: norm.title } },
      update: {},
      create: { kind: 'norm', title: norm.title, citation: norm.citation, body: '' },
    });
  }
  console.log(`Нормативные материалы: ${NORMS.length}.`);

  for (const letter of EXAMPLE_LETTERS) {
    await prisma.material.upsert({
      where: { kind_title: { kind: 'example', title: letter.title } },
      update: {},
      create: { kind: 'example', title: letter.title, citation: letter.citation, body: letter.body },
    });
  }
  console.log(`Примеры ответов: ${EXAMPLE_LETTERS.length}.`);

  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    console.log(`Пользователь "${login}" уже существует, пропускаем.`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin';
  const name = process.env.SEED_ADMIN_NAME ?? 'Администратор';
  const password_hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { full_name: name, login, password_hash, role: 'super_admin' },
  });
  console.log(`Создан супер-админ: ${login}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
