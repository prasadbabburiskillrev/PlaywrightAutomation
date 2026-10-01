import { PDFDocument, PDFImage } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export async function mergePngsToPdf(pngPaths: string[], outputPdfPath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pngPaths.length; i++) {
    const pngPath = pngPaths[i];
    let image: PDFImage;
    try {
      const imageBytes = fs.readFileSync(pngPath);
      image = await pdfDoc.embedPng(imageBytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`mergePngsToPdf: cannot read/embed PNG at index ${i} (${pngPath}): ${message}`);
    }
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const bytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });
  fs.writeFileSync(outputPdfPath, bytes);
}
