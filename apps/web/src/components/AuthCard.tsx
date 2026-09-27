import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@qic/ui/components/card";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Links under the card, e.g. "no account? sign up". 卡片下方的链接。 */
  footer?: ReactNode;
}

/**
 * Card frame shared by the auth pages: title, optional description, body and footer links.
 *
 * 鉴权页面共用的卡片框架：标题、可选描述、主体和底部链接。
 */
export const AuthCard = ({ title, description, children, footer }: AuthCardProps) => (
  <Card className="w-full max-w-sm">
    <CardHeader>
      <span className="journal-kicker">QIC / ACCOUNT</span>
      <CardTitle className="text-2xl">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent>{children}</CardContent>
    {footer && <CardFooter className="text-muted-foreground text-sm">{footer}</CardFooter>}
  </Card>
);
