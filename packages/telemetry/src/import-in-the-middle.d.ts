// The package ships register-hooks.d.ts, which TypeScript does not pair with the .mjs entry.
// 该包的类型文件名为 register-hooks.d.ts，TypeScript 无法与 .mjs 入口对应，这里补上声明。
declare module "import-in-the-middle/register-hooks.mjs" {
  export function register(options?: {
    include?: Array<string | RegExp>;
    exclude?: Array<string | RegExp>;
  }): void;
  export function supportsSyncHooks(): boolean;
}
