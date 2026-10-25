/**
 * Download formats. PDF and Word are typeset from the same document model
 * (server/docModel.js), so both carry the letterhead, Key Terms table,
 * numbered Standard Terms and signature page.
 */
export { renderPdfBuffer } from './pdfExport.js';
export { renderDocxBuffer } from './docxExport.js';
