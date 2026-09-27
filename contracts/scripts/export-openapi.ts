/**
 * Writes `openapi/openapi.json` from the route definitions in `src/`.
 * Output must be byte-for-byte stable so running `pnpm gen` twice yields no diff.
 *
 * 从 `src/` 中的路由定义生成 `openapi/openapi.json`。输出必须逐字节稳定，
 * 连续两次运行 `pnpm gen` 不应产生差异；生成的文件不要手改。
 *
 * @example pnpm gen
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { apiRoutes, openApiDocumentConfig, securitySchemes } from "../src/index.js";

const outFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../openapi/openapi.json",
);

const registry = new OpenAPIRegistry();
for (const [name, scheme] of Object.entries(securitySchemes)) {
  registry.registerComponent("securitySchemes", name, scheme);
}
for (const route of apiRoutes) {
  registry.registerPath(route);
}

const document = new OpenApiGeneratorV3(registry.definitions).generateDocument(
  openApiDocumentConfig,
);

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${path.relative(process.cwd(), outFile)}\n`);
