import { access } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { AppError } from '../lib/errors.js';

const FONT_REL = 'node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf';
const FONT_BOLD_REL = 'node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf';
const LOGO_REL = 'assets/logo.png';

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

// Docker запускает API из каталога backend, Vercel — из корня репозитория.
function assetRoots(): string[] {
  const cwd = process.cwd();
  return [
    cwd,
    path.resolve(cwd, 'backend'),
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', 'backend'),
  ];
}

async function findAsset(rel: string): Promise<string | null> {
  for (const root of assetRoots()) {
    const full = path.resolve(root, rel);
    if (await exists(full)) return full;
  }
  return null;
}

export async function renderLetterPdf(input: LetterInput): Promise<Buffer> {
  const font = await findAsset(FONT_REL);
  if (!font) {
    throw new AppError(500, 'Не найден шрифт для бланка');
  }
  const bold = (await findAsset(FONT_BOLD_REL)) ?? font;
  const logo = await findAsset(LOGO_REL);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      info: {
        Title: `Исх ${input.outgoingNumber}`,
        Author: 'ООО УК «Жилинтерсфера»',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = doc.y;
    if (logo) {
      try {
        doc.image(logo, left, top, { fit: [46, 46] });
      } catch {
        // Бланк остаётся читаемым и без картинки.
      }
    }
    const headerX = left + (logo ? 56 : 0);
    const headerW = width - (logo ? 56 : 0);
    doc.font(bold).fontSize(12).fillColor('#243028');
    doc.text('ООО УК «Жилинтерсфера»', headerX, top, { width: headerW });
    doc.font(font).fontSize(8).fillColor('#4a5248');
    doc.text(
      '350072, г. Краснодар, ул. им. С. Есенина, д. 108/6, литер Б1, пом. 7',
      headerX,
      doc.y,
      {
        width: headerW,
      },
    );
    doc.text('ИНН 2311337579, КПП 231101001, zhilintersfera@mail.ru', headerX, doc.y, {
      width: headerW,
    });
    doc.y = Math.max(doc.y, top + (logo ? 50 : 0)) + 8;
    doc
      .moveTo(left, doc.y)
      .lineTo(left + width, doc.y)
      .strokeColor('#c8c2b6')
      .stroke();
    doc.y += 16;
    doc.fillColor('#243028').font(font).fontSize(11);

    const addressee = [input.sender, input.objectAddress, input.replyEmail]
      .filter(Boolean)
      .join('\n');
    if (addressee) {
      doc.text(addressee, left + width * 0.38, doc.y, { width: width * 0.62 });
      doc.moveDown(0.8);
    }

    doc.font(font).fontSize(11).fillColor('#243028');
    doc.text(`От ${input.outgoingDate}   № ${input.outgoingNumber}`, left, doc.y, { width });
    if (input.correspondentNumber || input.correspondentDate) {
      const line = [
        'На №',
        input.correspondentNumber,
        input.correspondentDate ? `от ${input.correspondentDate}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      doc.text(line, left, doc.y + 2, { width });
    }
    doc.moveDown(1.2);
    doc.font(font).fontSize(11).text(input.body, left, doc.y, { width });

    const tail = input.body.slice(-800);
    if (!/Разумов|Фоменко/i.test(tail)) {
      doc.moveDown(2);
      doc.text('Генеральный директор', left, doc.y, { width });
      doc.moveDown(1.4);
      doc.text('Н.Р. Разумов', left, doc.y, { width });
    }

    doc.end();
  });
}
