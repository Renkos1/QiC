/**
 * The signed-in user performing an operation; services receive this, never the raw session.
 *
 * 执行操作的已登录用户。服务层只接收它，不接触原始会话对象。
 */
export interface Actor {
  id: string;
  name: string;
  email: string;
}
