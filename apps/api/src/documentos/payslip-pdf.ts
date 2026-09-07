import PDFDocument from 'pdfkit';

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Holerites here are numeric fields entered by RH, not an uploaded file (see
// the Payslip model) — the downloadable PDF is generated on the fly from
// those same numbers shown on the colaborador's screen.
export function buildPayslipPdf(
  payslip: { label: string; gross: number; inss: number; irrf: number; benefits: number },
  userName: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const liquido = payslip.gross - payslip.inss - payslip.irrf - payslip.benefits;

    doc.fontSize(18).text('Holerite', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Colaborador: ${userName}`);
    doc.text(`Referência: ${payslip.label}`);
    doc.moveDown();

    doc.text(`Salário bruto: ${formatBRL(payslip.gross)}`);
    doc.text(`INSS: ${formatBRL(payslip.inss)}`);
    doc.text(`IRRF: ${formatBRL(payslip.irrf)}`);
    doc.text(`Descontos de benefícios: ${formatBRL(payslip.benefits)}`);
    doc.moveDown();
    doc.fontSize(14).text(`Líquido: ${formatBRL(liquido)}`, { underline: true });

    doc.end();
  });
}
