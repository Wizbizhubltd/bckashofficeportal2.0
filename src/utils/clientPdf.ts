/**
 * "Download form": the client's data page as an A4 PDF, saved straight to the device. The print page
 * does the work — it's loaded in a hidden frame with `?download=1`, renders exactly as it would for
 * printing, turns itself into a PDF and tells this page when it's done.
 */

const DONE_MESSAGE = 'client-form-pdf';

type PdfMessage = { type: typeof DONE_MESSAGE; ok: boolean; error?: string };

/** Loads the print page off-screen and resolves once its PDF has been downloaded. */
export function downloadClientForm(printPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    // Off-screen rather than display:none, so the page lays out at A4 width and the PDF matches the print.
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1300px;border:0;';
    frame.setAttribute('aria-hidden', 'true');

    const finish = (error?: string) => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      frame.remove();
      if (error) reject(new Error(error));
      else resolve();
    };
    const onMessage = (event: MessageEvent<PdfMessage>) => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow || event.data?.type !== DONE_MESSAGE) return;
      finish(event.data.ok ? undefined : event.data.error || 'The form could not be downloaded.');
    };
    const timer = setTimeout(() => finish('Preparing the form took too long. Try again.'), 90_000);

    window.addEventListener('message', onMessage);
    frame.src = `${printPath}${printPath.includes('?') ? '&' : '?'}download=1`;
    document.body.appendChild(frame);
  });
}

/** Called by the print page in download mode: saves `element` as an A4 PDF and reports back to the opener. */
export async function saveFormAsPdf(element: HTMLElement, fileName: string): Promise<void> {
  try {
    // Loaded only when someone downloads, so it doesn't weigh down the rest of the portal.
    const { default: html2pdf } = await import('html2pdf.js');
    // A variable rather than an inline literal: html2pdf.js 0.14 supports `pagebreak` but leaves it out
    // of its type declarations, and only an inline literal is checked for unknown properties.
    const options = {
      margin: [12, 12, 14, 12] as [number, number, number, number],
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      // Don't cut a row, signature line or photo across two pages.
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'img', 'li', 'h2', 'h3', '.avoid-break'] },
    };
    await html2pdf().set(options).from(element).save();
    report({ type: DONE_MESSAGE, ok: true });
  } catch (error) {
    report({ type: DONE_MESSAGE, ok: false, error: error instanceof Error ? error.message : undefined });
  }
}

/** Called by the print page in download mode when the client couldn't be loaded. */
export function reportFormFailure(error: string): void {
  report({ type: DONE_MESSAGE, ok: false, error });
}

/** True when the print page was opened by downloadClientForm. */
export function isFormDownload(): boolean {
  return new URLSearchParams(window.location.search).get('download') === '1';
}

/** A safe file name: "Amina Bello - client form.pdf". */
export function formFileName(clientName: string): string {
  const safe = clientName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Client';
  return `${safe} - client form.pdf`;
}

function report(message: PdfMessage) {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
}
