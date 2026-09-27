export {
  createSmtpMailer,
  type Mailer,
  type MailMessage,
  type SmtpMailerOptions,
} from "./mailer.js";
export {
  type ActionEmailInput,
  escapeHtml,
  type RenderedEmail,
  renderResetPassword,
  renderTodoCompleted,
  renderVerifyEmail,
  type TodoCompletedEmailInput,
} from "./templates.js";
