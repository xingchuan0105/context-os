import DOMPurify from 'isomorphic-dompurify';

/**
 * 允许的 HTML 标签（用于 Markdown 渲染）
 */
const ALLOWED_TAGS = [
  // 基础文本
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'strike',
  // 标题
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // 列表
  'ul', 'ol', 'li',
  // 代码
  'code', 'pre',
  // 引用
  'blockquote',
  // 表格
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // 分隔符
  'hr',
  // 链接
  'a',
  // 图片（可选，如果需要支持图片）
  // 'img',
];

/**
 * 允许的 HTML 属性
 */
const ALLOWED_ATTR = [
  'href',          // 链接地址
  'className',     // 类名
  'class',         // 类名（备用）
  'target',        // 链接打开方式
  'rel',           // 链接关系
  'id',            // ID
];

/**
 * DOMPurify 配置
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // 允许 data-* 属性（用于自定义功能）
  ALLOW_DATA_ATTR: false,
  // 不允许任何 URI 协议（除了 https: 和 http:）
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // 强制 target="_blank" 的链接添加 rel="noopener noreferrer"
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

/**
 * 清理 Markdown 内容，防止 XSS 攻击
 * @param markdown 未清理的 Markdown 内容
 * @returns 清理后的安全 HTML
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // 使用 DOMPurify 清理
  const clean = DOMPurify.sanitize(markdown, PURIFY_CONFIG);

  return clean;
}

/**
 * 为所有外部链接添加安全属性
 * @param html HTML 字符串
 * @returns 添加了安全属性的 HTML
 */
export function addLinkSecurity(html: string): string {
  // 这个步骤由 DOMPurify 的 ADD_ATTR 配置处理
  // 但如果需要额外处理，可以在这里添加
  return html;
}

/**
 * 配置 DOMPurify（在应用启动时调用）
 */
export function configureDOMPurify() {
  // 添加钩子：为所有 target="_blank" 的链接添加 rel="noopener noreferrer"
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'target' && data.attrValue === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

// 默认配置（在模块加载时执行）
configureDOMPurify();
