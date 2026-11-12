import { access } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { AppError } from '../lib/errors.js';

const FONT_RELS = ['assets/fonts/TimesNewRoman.ttf', 'assets/fonts/LiberationSerif-Regular.ttf'];
const FONT_BOLD_RELS = ['assets/fonts/TimesNewRoman-Bold.ttf', 'assets/fonts/LiberationSerif-Bold.ttf'];
const LOGO_REL = 'assets/letterhead.jpg';

export interface LetterInput {
  sender: string;
  objectAddress: string;
  replyEmail: string;
  outgoingNumber: string;
  outgoingDate: string;
  correspondentNumber: string;
  correspondentDate: string;
  body: string;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function assetRoots(): string[] {
  const cwd = process.cwd();
  return [cwd, path.resolve(cwd, 'backend'), path.resolve(cwd, '..'), path.resolve(cwd, '..', 'backend')];
}

async function findAsset(rel: string): Promise<string | null> {
  for (const root of assetRoots()) {
    const full = path.resolve(root, rel);
    if (await exists(full)) return full;
  }
  return null;
}

async function findFirst(rels: string[]): Promise<string | null> {
  for (const rel of rels) {
    const found = await findAsset(rel);
    if (found) return found;
  }
  return null;
}

function isSalutation(line: string): boolean {
  return /^уважаем/i.test(line) && line.length <= 90;
}

function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function renderLetterPdf(input: LetterInput): Promise<Buffer> {
  const font = await findFirst(FONT_RELS);
  if (!font) {
    throw new AppError(500, 'Не найден шрифт для бланка');
  }
  const bold = (await findFirst(FONT_BOLD_RELS)) ?? font;
  const logo = await findAsset(LOGO_REL);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 42, bottom: 50, left: 56, right: 42 },
      info: {
        Title: `Исх ${input.outgoingNumber}`,
        Author: 'ООО УК «ЖилИнтерСфера»',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = doc.y;
    // Бланк занимает левую половину. Справа — кому, адрес и почта.
    const leftCol = Math.round(width * 0.5);
    const gap = 20;
    const rightX = left + leftCol + gap;
    const rightW = width - leftCol - gap;
    const logoH = 50;

    if (logo) {
      try {
        doc.image(logo, left, top, { fit: [leftCol, logoH] });
      } catch {
        // Бланк остаётся читаемым и без картинки.
      }
    }

    doc.fillColor('#111111');
    let y = top + (logo ? logoH + 8 : 0);
    doc.font(bold).fontSize(11).text('ООО УК «ЖилИнтерСфера»', left, y, { width: leftCol });
    y = doc.y + 2;
    doc.font(font).fontSize(10);
    for (const line of [
      '350072, Краснодарский край, г. Краснодар, ул. им. С. Есенина, дом 108/6, литер Б1, пом. 7',
      'e-mail: zhilintersfera@mail.ru',
      'ИНН 2311337579  КПП 231101001',
    ]) {
      doc.text(line, left, y, { width: leftCol });
      y = doc.y + 1;
    }
    const leftBottom = y;

    let rightY = top;
    doc.font(font).fontSize(12);
    const who = input.sender.trim();
    if (who) {
      doc.text(who, rightX, rightY, { width: rightW });
      rightY = doc.y + 8;
    }
    const addr = input.objectAddress.trim();
    if (addr) {
      doc.text(addr, rightX, rightY, { width: rightW });
      rightY = doc.y + 8;
    }
    const mail = input.replyEmail.trim();
    if (mail) {
      doc.text(`E-mail: ${mail}`, rightX, rightY, { width: rightW });
      rightY = doc.y;
    }

    let cursor = Math.max(leftBottom, rightY) + 14;
    doc.font(font).fontSize(14);
    doc.text(`От ${input.outgoingDate}   № ${input.outgoingNumber}`, left, cursor, { width: leftCol });
    cursor = doc.y + 2;
    const reference =
      input.correspondentNumber || input.correspondentDate
        ? ['На №', input.correspondentNumber, input.correspondentDate ? `от ${input.correspondentDate}` : '']
            .filter(Boolean)
            .join(' ')
        : 'На № ______ от «____» ______ 20____ г.';
    doc.text(reference, left, cursor, { width: leftCol });
    doc.y = doc.y + 18;
    doc.x = left;

    for (const line of paragraphs(input.body)) {
      const salute = isSalutation(line);
      const list = /^(\d+[.)]|[-–—])\s/.test(line);
      doc.font(font).fontSize(14).text(line, left, doc.y, {
        width,
        align: salute ? 'center' : 'justify',
        indent: salute || list ? 0 : 35,
        lineGap: 2,
      });
      doc.moveDown(salute ? 0.7 : 0.35);
    }

    const tail = input.body.slice(-800);
    if (!/Разумов|Фоменко/i.test(tail)) {
      doc.moveDown(1.2);
      const signY = doc.y;
      doc.font(font).fontSize(14).text('Генеральный директор', left, signY, { width: width * 0.62 });
      doc.text('Н.Р. Разумов', left, signY, { width, align: 'right' });
    }

    doc.end();
  });
}
