/**
 * 业务错误：service 层抛出的已知错误，携带 HTTP 状态码与业务错误码。
 * 错误码约定见设计文档第 9 章。
 */
export class AppError extends Error {
  status: number;
  code: number;

  constructor(status: number, code: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
