/**
 * Keeps the field being typed into visible above a phone's on-screen keyboard, in pop-ups (any
 * element with role="dialog") and on full pages alike.
 *
 * Phones show the keyboard over the page without shrinking `position: fixed` overlays, so a field in
 * the lower half of a pop-up ended up underneath it — and a centred, non-scrolling pop-up couldn't be
 * moved. Two things fix that: `--keyboard-inset` (the keyboard's height, from the visual viewport) pads
 * the bottom of scrolling pop-ups (`.modal-scroll`) so their last field and buttons can scroll clear of
 * it, and the focused field is scrolled into the middle of what's still visible once the keyboard is up.
 */
export function keepFocusedFieldVisible(): void {
  const viewport = window.visualViewport;
  if (!viewport || typeof document === 'undefined') return;

  const isTextField = (el: Element | null): el is HTMLElement =>
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'button', 'submit', 'range'].includes(el.type));

  const reveal = () => {
    const active = document.activeElement;
    if (isTextField(active)) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const updateInset = () => {
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
  };

  viewport.addEventListener('resize', () => {
    updateInset();
    reveal();
  });

  // The keyboard takes a moment to slide up; scroll once it has (the resize above covers most phones,
  // this covers the ones that don't resize the visual viewport).
  document.addEventListener('focusin', (event) => {
    if (!isTextField(event.target as Element)) return;
    window.setTimeout(reveal, 350);
  });

  updateInset();
}
