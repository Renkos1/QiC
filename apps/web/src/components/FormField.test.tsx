// @vitest-environment jsdom
/*
 * Form field and alert accessibility wiring in jsdom.
 *
 * 表单字段与提示的无障碍关联（jsdom）。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/test/render";
import { FormAlert } from "./FormAlert";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("should link the input to its label", () => {
    render(<FormField id="email" label="邮箱" />);
    expect(screen.getByLabelText("邮箱").id).toBe("email");
  });

  it("should expose the error to assistive technology when validation fails", () => {
    render(<FormField id="email" label="邮箱" error={{ type: "invalid", message: "邮箱无效" }} />);
    const input = screen.getByLabelText("邮箱");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("email-error");
    expect(document.getElementById("email-error")?.textContent).toBe("邮箱无效");
  });

  it("should not mark the input invalid when there is no error", () => {
    render(<FormField id="email" label="邮箱" />);
    expect(screen.getByLabelText("邮箱").hasAttribute("aria-invalid")).toBe(false);
  });
});

describe("FormAlert", () => {
  it("should render nothing when there is no message", () => {
    const { container } = render(<FormAlert message={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("should announce the message as an alert", () => {
    render(<FormAlert message="出错了" />);
    expect(screen.getByRole("alert").textContent).toContain("出错了");
  });
});
