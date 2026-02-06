/**
 * 腾讯云 SCF 文档处理函数
 */

import COS from 'cos-nodejs-sdk-v5';
import { createClient } from '../lib/llm';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// 配置
const COS_CONFIG = {
  SecretId: process.env.TENCENT_COS_SECRET_ID || '',
  SecretKey: process.env.TENCENT_COS_SECRET_KEY || '',
  Bucket: process.env.TENCENT_COS_BUCKET || '',
  Region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
};

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://localhost:4000';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'local-dev';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b';
const CALLBACK_BASE_URL = process.env.CALLBACK_BASE_URL || '';

// 客户端
const cos = new COS({
  SecretId: COS_CONFIG.SecretId,
  SecretKey: COS_CONFIG.SecretKey,
});

const llmClient = createClient({ apiKey: LITELLM_API_KEY, baseURL: LITELLM_BASE_URL }) as any;
const embeddingClient = createClient({ apiKey: LITELLM_API_KEY, baseURL: LITELLM_BASE_URL }) as any;

const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
});

// SCF 入口
export async function handler(event: any, context: any) {
  console.log('SCF Event:', JSON.stringify(event, null, 2));

  // 解析消息
  let message: any;
  if (event.Records) {
    const body = event.Records[0].body;
    message = JSON.parse(body);
  } else {
    message = event;
  }

  console.log(`Processing: docId=${message.docId}`);

  try {
    // 实现文档处理逻辑
    // TODO: 完整实现见PRD

    await callbackFrontend(message.docId, { success: true, chunkCount: 0 });
    return { success: true };
  } catch (error: any) {
    console.error('Error:', error);
    await callbackFrontend(message.docId, { success: false, error: error.message });
    return { success: false };
  }
}

async function callbackFrontend(docId: string, result: any): Promise<void> {
  const url = `${CALLBACK_BASE_URL}/api/callback/document`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docId, ...result }),
  });
}

exports.handler = handler;
