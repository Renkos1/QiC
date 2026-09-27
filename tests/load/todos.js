/*
 * k6 baseline for the example todos API. Run against a local stack:
 *   docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev
 *   pnpm test:load
 * Signs in as the seeded demo user; each iteration lists, creates, renames and deletes
 * one todo so data does not accumulate. Renaming (not completing) avoids emailing on
 * every iteration.
 *
 * 示例待办 API 的 k6 压测基线。以演示用户登录，每轮依次列表、创建、改名、删除一条待办，
 * 数据不会累积；改名而不是标记完成，避免每轮都发通知邮件。阈值不达标时运行失败。
 * 可用 VUS、DURATION、API_URL、WEB_ORIGIN 环境变量调整。
 */
import { check, fail } from "k6";
import http from "k6/http";

const API = __ENV.API_URL || "http://localhost:14000";
// Better Auth rejects auth requests whose Origin is not the configured web origin.
const ORIGIN = __ENV.WEB_ORIGIN || "http://localhost:13000";
const SESSION_COOKIE = "better-auth.session_token";

/** Load profile and pass/fail thresholds. 负载模型与通过阈值。 */
export const options = {
  scenarios: {
    steady: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || "30s",
    },
  },
  // Baseline thresholds for a single local api instance; a failed threshold fails the run.
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{name:list}": ["p(95)<200"],
    "http_req_duration{name:create}": ["p(95)<300"],
    "http_req_duration{name:rename}": ["p(95)<300"],
    "http_req_duration{name:delete}": ["p(95)<300"],
  },
};

/** Signs in once and shares the session cookie with all virtual users. 登录一次，把会话 Cookie 共享给所有虚拟用户。 */
export function setup() {
  const response = http.post(
    `${API}/api/auth/sign-in/email`,
    JSON.stringify({ email: "demo@qic.local", password: "demo-password-123" }),
    { headers: { "content-type": "application/json", origin: ORIGIN } },
  );
  const session = response.cookies[SESSION_COOKIE]?.[0]?.value;
  if (response.status !== 200 || !session) {
    fail(`sign-in failed (HTTP ${response.status}); did you run pnpm db:seed?`);
  }
  return { cookie: `${SESSION_COOKIE}=${session}` };
}

/** One iteration: list, create, rename, delete. 每轮：列表、创建、改名、删除。 */
export default function (data) {
  const headers = { cookie: data.cookie, origin: ORIGIN, "content-type": "application/json" };

  const list = http.get(`${API}/api/todos?limit=20`, { headers, tags: { name: "list" } });
  check(list, { "list 200": (r) => r.status === 200 });

  const create = http.post(`${API}/api/todos`, JSON.stringify({ title: `k6 ${__VU}-${__ITER}` }), {
    headers: { ...headers, "idempotency-key": `k6-${__VU}-${__ITER}-${Date.now()}` },
    tags: { name: "create" },
  });
  if (!check(create, { "create 201": (r) => r.status === 201 })) return;
  const id = create.json("id");

  const rename = http.patch(`${API}/api/todos/${id}`, JSON.stringify({ title: "k6 renamed" }), {
    headers,
    tags: { name: "rename" },
  });
  check(rename, { "rename 200": (r) => r.status === 200 });

  const remove = http.del(`${API}/api/todos/${id}`, null, { headers, tags: { name: "delete" } });
  check(remove, { "delete 204": (r) => r.status === 204 });
}
