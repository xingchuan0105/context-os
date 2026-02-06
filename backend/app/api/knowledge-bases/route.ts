import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  getKnowledgeBasesByUserId,
  createKnowledgeBase,
} from '@/lib/db/queries';
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
} from '@/lib/api/errors';

// 获取用户的所有知识库
export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError('请先登录');
  }

  const kbs = await getKnowledgeBasesByUserId(user.id);
  return success(kbs);
});

// 创建新知识库
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError('请先登录');
  }

  const body = await req.json();
  const { title, description, icon } = body;

  if (!title) {
    throw new ValidationError('标题不能为空', { field: 'title' });
  }

  const kb = await createKnowledgeBase(user.id, title, icon, description);
  return success(kb, 201);
});
