/*
 * Public API of the todos module; other modules import only from here.
 *
 * 待办模块的公开接口：其他模块只能从这里导入，不得深层引用内部文件。
 */
export { createTodoRepo, type TodoRepo } from "./repo.js";
export { createTodoService, type TodoService, type TodoServiceDeps } from "./service.js";
export { TodosModule } from "./todos.module.js";
