/**
 * 本地文件存储模块
 * 用于本地测试，将 Markdown 内容以 base64 格式存储在数据库中
 */

export interface UploadResult {
  url: string;
  path: string;
  isLocal: boolean;
  base64Content?: string;
}

/**
 * 将文本转换为 base64 格式
 */
export function textToBase64(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

/**
 * 将 base64 转换回文本
 */
export function base64ToText(base64: string): string {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * 将文件转换为 base64 格式（兼容旧代码）
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * 将 base64 转换回 Buffer（兼容旧代码）
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * 上传 Markdown 内容到本地存储
 * 将内容存储为 base64 在数据库中
 */
export async function uploadMarkdownToLocal(
  userId: string,
  kbId: string,
  fileName: string,
  markdownContent: string
): Promise<UploadResult> {
  const timestamp = Date.now();
  const localPath = `local://${userId}/${kbId}/${timestamp}_${fileName}`;

  // 将 Markdown 内容转换为 base64
  const base64Content = textToBase64(markdownContent);

  return {
    url: localPath,
    path: localPath,
    isLocal: true,
    base64Content, // 返回 base64 内容用于数据库存储
  };
}

/**
 * 模拟文件上传（返回本地路径）- 兼容旧代码
 */
export async function uploadFileToLocal(
  userId: string,
  kbId: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<UploadResult> {
  const timestamp = Date.now();
  const localPath = `local://${userId}/${kbId}/${timestamp}_${fileName}`;

  // 将文件内容转换为 base64
  const base64Content = bufferToBase64(fileBuffer);

  return {
    url: localPath,
    path: localPath,
    isLocal: true,
    base64Content, // 返回 base64 内容用于数据库存储
  };
}

/**
 * 从本地存储获取 Markdown 内容
 */
export async function getMarkdownContent(base64Content: string): Promise<string> {
  return base64ToText(base64Content);
}

/**
 * 从本地存储获取文件内容（兼容旧代码）
 * 这个函数会在文档处理器中调用
 */
export async function getFileContent(base64Content: string): Promise<Buffer> {
  return base64ToBuffer(base64Content);
}

/**
 * 检查是否应该使用本地存储
 * 当 COS 未配置时，自动使用本地存储
 */
export function shouldUseLocalStorage(): boolean {
  return !(
    process.env.TENCENT_COS_SECRET_ID &&
    process.env.TENCENT_COS_SECRET_KEY &&
    process.env.TENCENT_COS_BUCKET
  );
}
