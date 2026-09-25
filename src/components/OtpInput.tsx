import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

/** One box per digit: typing moves forward, Backspace moves back, and a pasted code fills every box. */
export function OtpInput({ value, onChange, length = 6, disabled, hasError, autoFocus }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  const focusBox = (index: number) => inputs.current[Math.max(0, Math.min(index, length - 1))]?.focus();

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const handleInput = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;
    // More than one digit in a box means autofill or a fast typist — spread it across the boxes.
    if (typed.length > 1) {
      const filled = (value.slice(0, index) + typed).slice(0, length);
      onChange(filled);
      focusBox(filled.length);
      return;
    }
    setDigit(index, typed);
    focusBox(index + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) {
        setDigit(index, '');
      } else if (index > 0) {
        setDigit(index - 1, '');
        focusBox(index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusBox(pasted.length);
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1}`}
          maxLength={length}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          className={`h-14 w-full min-w-0 rounded-xl border bg-white text-center font-heading text-2xl font-semibold text-slate-900 outline-none transition-all focus:ring-4 disabled:bg-slate-50 disabled:text-slate-400 ${
            hasError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
              : digit
                ? 'border-primary/60 focus:border-primary focus:ring-primary/10'
                : 'border-slate-300 focus:border-primary focus:ring-primary/10'
          }`}
        />
      ))}
    </div>
  );
}
