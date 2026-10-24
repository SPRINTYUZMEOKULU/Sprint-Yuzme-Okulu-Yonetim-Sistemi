declare module "pdfmake" {
  import { Readable } from "node:stream";
  export default class PdfPrinter {
    constructor(fonts: Record<string, Record<string, Buffer>>);
    createPdfKitDocument(definition: Record<string, unknown>): Readable & { end(): void };
  }
}
declare module "pdfmake/build/vfs_fonts" {
  const fonts: Record<string, string>;
  export default fonts;
}
