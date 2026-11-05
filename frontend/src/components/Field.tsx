import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { inputClass } from "./UI";

type Common = { label: string; error?: string; hint?: string; children?: ReactNode };

function Wrapper({ label, error, hint, id, children }: Common & { id: string }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="block">
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">{label}</label>
      {children}
      {hint && !error && <span id={hintId} className="mt-1 block text-xs text-stone2-500">{hint}</span>}
      {error && <span id={errorId} role="alert" className="mt-1 block text-sm text-rubric-600">{error}</span>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Omit<Common, "children">>(
  function Input({ label, error, hint, id, className = "", ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Wrapper label={label} error={error} hint={hint} id={fieldId}>
        <input
          {...rest}
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={`${inputClass} ${error ? "border-rubric-500" : ""} ${className}`}
        />
      </Wrapper>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Omit<Common, "children">>(
  function Textarea({ label, error, hint, id, className = "", ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Wrapper label={label} error={error} hint={hint} id={fieldId}>
        <textarea
          {...rest}
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={`${inputClass} min-h-28 resize-y ${error ? "border-rubric-500" : ""} ${className}`}
        />
      </Wrapper>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Omit<Common, "children"> & { children: ReactNode }>(
  function Select({ label, error, hint, id, className = "", children, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Wrapper label={label} error={error} hint={hint} id={fieldId}>
        <select
          {...rest}
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={`${inputClass} ${error ? "border-rubric-500" : ""} ${className}`}
        >
          {children}
        </select>
      </Wrapper>
    );
  },
);
