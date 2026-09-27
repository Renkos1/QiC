import type { UserConfig } from "@commitlint/types";

/**
 * Commit messages follow Conventional Commits (`type(scope): subject`); checked by the commit-msg hook.
 *
 * 提交信息遵循 Conventional Commits（`type(scope): subject`），由 commit-msg 钩子检查。
 */
const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
};

export default config;
