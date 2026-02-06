/**
 * 文件类型验证模块 - 使用 Magic Bytes 验证实际文件内容
 * 防止文件类型伪造攻击
 */

/**
 * 文件签名 (Magic Bytes)
 */
const FILE_SIGNATURES: Record<string, RegExp | null> = {
  // PDF
  'application/pdf': /^%PDF-/,

  // Office 文档 (OLE2 或 ZIP 格式)
  'application/vnd.ms-powerpoint': /^\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1/, // PPT (OLE2)
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': /^PK\x03\x04/, // PPTX (ZIP)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': /^PK\x03\x04/, // DOCX (ZIP)
  'application/msword': /^\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1/, // DOC (OLE2)

  // 文本文件 (无特定签名，需要额外检查)
  'text/plain': null,
  'text/markdown': null,
  'text/x-markdown': null,
};

/**
 * 检查 Buffer 是否匹配特定的 Magic Bytes
 */
function matchesSignature(buffer: Buffer, signature: RegExp): boolean {
  const header = buffer.slice(0, 12).toString('binary');
  return signature.test(header);
}

/**
 * 检查是否为文本文件
 * 通过检查文件内容是否主要包含可打印 ASCII/UTF-8 字符
 */
function isTextFile(buffer: Buffer): boolean {
  // 检查前 1024 字节
  const sampleSize = Math.min(buffer.length, 1024);
  const sample = buffer.slice(0, sampleSize);

  let textBytes = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];

    // 可打印 ASCII (32-126), 换行符 (10), 回车符 (13), 制表符 (9)
    if (
      (byte >= 32 && byte <= 126) ||
      byte === 10 ||
      byte === 13 ||
      byte === 9
    ) {
      textBytes++;
    }
  }

  // 如果 90% 以上是文本字节，认为是文本文件
  return textBytes / sampleSize > 0.9;
}

/**
 * 验证文件类型是否与声明的 MIME 类型匹配
 * @param buffer 文件内容
 * @param declaredMimeType 声明的 MIME 类型
 * @param fileName 文件名（用于额外验证）
 * @returns 验证结果
 */
export function validateFileType(
  buffer: Buffer,
  declaredMimeType: string,
  fileName?: string
): {
  valid: boolean;
  actualMimeType?: string;
  reason?: string;
} {
  // 空文件
  if (buffer.length === 0) {
    return { valid: false, reason: 'Empty file' };
  }

  // 获取文件扩展名作为后备验证
  const ext = fileName?.split('.').pop()?.toLowerCase();

  // 对于 .md 文件，无论浏览器声明什么 MIME 类型，都按文本文件处理
  // 因为不同浏览器可能发送不同的 MIME 类型（text/markdown, text/plain, 甚至 application/octet-stream）
  if (ext === 'md' || ext === 'markdown') {
    const isText = isTextFile(buffer);
    if (!isText) {
      // 检查是否有二进制文件的签名
      for (const [mime, sig] of Object.entries(FILE_SIGNATURES)) {
        if (sig && matchesSignature(buffer, sig)) {
          return {
            valid: false,
            actualMimeType: mime,
            reason: `File with .md extension appears to be ${mime}`,
          };
        }
      }
      return { valid: false, reason: 'File with .md extension appears to be binary, not text' };
    }
    return { valid: true };
  }

  // 检查声明的 MIME 类型是否在支持列表中
  const signature = FILE_SIGNATURES[declaredMimeType];

  // 文本文件特殊处理
  if (
    declaredMimeType === 'text/plain' ||
    declaredMimeType === 'text/markdown' ||
    declaredMimeType === 'text/x-markdown'
  ) {
    const isText = isTextFile(buffer);
    if (!isText) {
      // 检查是否有二进制文件的签名
      for (const [mime, sig] of Object.entries(FILE_SIGNATURES)) {
        if (sig && matchesSignature(buffer, sig)) {
          return {
            valid: false,
            actualMimeType: mime,
            reason: `Declared as text but appears to be ${mime}`,
          };
        }
      }
      return { valid: false, reason: 'File appears to be binary, not text' };
    }
    return { valid: true };
  }

  // 二进制文件验证
  if (signature) {
    if (!matchesSignature(buffer, signature)) {
      // 尝试检测实际文件类型
      for (const [mime, sig] of Object.entries(FILE_SIGNATURES)) {
        if (sig && matchesSignature(buffer, sig)) {
          return {
            valid: false,
            actualMimeType: mime,
            reason: `Declared as ${declaredMimeType} but appears to be ${mime}`,
          };
        }
      }
      return {
        valid: false,
        reason: `File signature does not match declared type: ${declaredMimeType}`,
      };
    }
    return { valid: true };
  }

  // 未知的 MIME 类型
  return {
    valid: false,
    reason: `Unsupported MIME type: ${declaredMimeType}`,
  };
}

/**
 * 从文件内容检测实际 MIME 类型
 */
export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length === 0) return null;

  // 检查二进制签名
  for (const [mime, signature] of Object.entries(FILE_SIGNATURES)) {
    if (signature && matchesSignature(buffer, signature)) {
      return mime;
    }
  }

  // 检查是否为文本
  if (isTextFile(buffer)) {
    return 'text/plain';
  }

  return null;
}
