import { Alert, AlertDescription } from "@qic/ui/components/alert";

interface FormAlertProps {
  message: string | null;
  variant?: "default" | "destructive";
}

/**
 * Form-level feedback; renders nothing when there is no message.
 *
 * 表单级提示；没有消息时不渲染。
 */
export const FormAlert = ({ message, variant = "destructive" }: FormAlertProps) =>
  message ? (
    <Alert variant={variant} role={variant === "destructive" ? "alert" : "status"}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
