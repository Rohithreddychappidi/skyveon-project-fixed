import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import sharp from "sharp";

export interface WatermarkIdentity {
  name: string;
  email: string;
  id: string;
}

function watermarkLabel(identity: WatermarkIdentity) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `${identity.name} · ${identity.email} · ${identity.id} · ${stamp}`;
}

/** Tiles a translucent diagonal text watermark across every page of a PDF. */
export async function watermarkPdf(input: Buffer, identity: WatermarkIdentity): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(input);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const label = watermarkLabel(identity);
  const fontSize = 11;
  const textWidth = font.widthOfTextAtSize(label, fontSize);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const stepX = textWidth + 60;
    const stepY = 90;

    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.55, 0.55, 0.6),
          opacity: 0.22,
          rotate: degrees(30),
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/** Tiles a translucent diagonal text watermark across an image. */
export async function watermarkImage(input: Buffer, identity: WatermarkIdentity): Promise<Buffer> {
  const label = watermarkLabel(identity);
  const image = sharp(input);
  const meta = await image.metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 800;

  const tileW = 340;
  const tileH = 120;
  const cols = Math.ceil(width / tileW) + 1;
  const rows = Math.ceil(height / tileH) + 1;

  let textNodes = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW;
      const y = r * tileH + 40;
      textNodes += `<text x="${x}" y="${y}" transform="rotate(-25 ${x} ${y})" font-size="16" fill="rgba(255,255,255,0.35)" font-family="sans-serif">${escapeXml(
        label
      )}</text>`;
    }
  }

  const svgOverlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${textNodes}</svg>`;

  return image
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .toBuffer();
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
