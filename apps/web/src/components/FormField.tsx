import { Input } from "@qic/ui/components/input";
import { Label } from "@qic/ui/components/label";
import type { ComponentProps } from "react";
import type { FieldError } from "react-hook-form";

interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  error?: FieldError | undefined;
}

/**
 * Labelled input with its validation message wired up for screen readers.
 *
 * 带标签的输入框；校验信息通过 `aria-describedby` 关联，读屏软件可读出。
 */
export const FormField = ({ id, label, error, ...inputProps }: FormFieldProps) => {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error?.message && (
        <p id={errorId} className="text-destructive text-sm">
          {error.message}
        </p>
      )}
    </div>
  );
};
