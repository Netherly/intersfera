// Сравнение текста ответа не зависит от перевода строки Windows или Unix.
export function normText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
