import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./field";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium">
          {label}
        </label>
      )}
      <input
        id={inputId}
        suppressHydrationWarning
        aria-invalid={error ? true : undefined}
        className={cn(fieldClass, error && "border-danger", className)}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger-strong">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}
