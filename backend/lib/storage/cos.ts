import COS from 'cos-nodejs-sdk-v5';

// 初始化腾讯云COS客户端
const cos = new COS({
  SecretId: process.env.TENCENT_COS_SECRET_ID || '',
  SecretKey: process.env.TENCENT_COS_SECRET_KEY || '',
});

const BUCKET = process.env.TENCENT_COS_BUCKET || '';
const REGION = process.env.TENCENT_COS_REGION || 'ap-guangzhou';

export interface UploadResult {
  url: string;
  path: string;
  isLocal?: boolean;
  base64Content?: string;
}

/**
 * 上传文件到腾讯云COS
 */
export async function uploadFileToCOS(
  userId: string,
  kbId: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    // 构建COS存储路径: {user_id}/{kb_id}/{timestamp}_{filename}
    const timestamp = Date.now();
    const cosKey = `${userId}/${kbId}/${timestamp}_${fileName}`;

    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: cosKey,
        Body: fileBuffer,
      },
      (err, data) => {
        if (err) {
          console.error('COS upload error:', err);
          reject(err);
        } else {
          resolve({
            url: `https://${BUCKET}.cos.${REGION}.myqcloud.com/${cosKey}`,
            path: cosKey,
            isLocal: false,
          });
        }
      }
    );
  });
}

/**
 * 上传 Markdown 内容到腾讯云COS
 * 将文本内容存储为 .md 文件
 */
export async function uploadMarkdownToCOS(
  userId: string,
  kbId: string,
  fileName: string,
  markdownContent: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const cosKey = `${userId}/${kbId}/${timestamp}_${fileName}`;

    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: cosKey,
        Body: Buffer.from(markdownContent, 'utf-8'),
      },
      (err, data) => {
        if (err) {
          console.error('COS upload error:', err);
          reject(err);
        } else {
          resolve({
            url: `https://${BUCKET}.cos.${REGION}.myqcloud.com/${cosKey}`,
            path: cosKey,
            isLocal: false,
          });
        }
      }
    );
  });
}

/**
 * 从COS删除文件
 */
export async function deleteFileFromCOS(cosKey: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    cos.deleteObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: cosKey,
      },
      (err, data) => {
        if (err) {
          console.error('COS delete error:', err);
          reject(err);
        } else {
          resolve(true);
        }
      }
    );
  });
}

/**
 * 获取COS文件临时访问URL（如果有私有权限需求）
 */
export function getCOSFileUrl(cosKey: string, expiresIn = 3600): string {
  return cos.getObjectUrl({
    Bucket: BUCKET,
    Region: REGION,
    Key: cosKey,
    Sign: true,
    Expires: expiresIn,
  });
}

/**
 * 从COS下载文件
 */
export async function downloadFileFromCOS(cosKey: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    cos.getObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: cosKey,
      },
      (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data.Body as Buffer);
        }
      }
    );
  });
}

/**
 * 检查COS配置是否完整
 */
export function isCOSConfigured(): boolean {
  return !!(
    process.env.TENCENT_COS_SECRET_ID &&
    process.env.TENCENT_COS_SECRET_KEY &&
    process.env.TENCENT_COS_BUCKET
  );
}
