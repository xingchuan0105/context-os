"""
轻量版文档/网页解析器（LMP-Lite）
- 依赖：pymupdf, trafilatura, openai, libreoffice (headless)
- 适用：1c2g 级别轻量服务器；按页渲染 PDF，再调用 Qwen-VL 生成 Markdown。

用法示例：
  export ALIYUN_API_KEY=sk-xxx  # DashScope 兼容模式 Key
  python scripts/lmp_lite.py test.pdf
  python scripts/lmp_lite.py https://example.com

批量转换本仓库根目录 test/test2/test3.pdf：
  python scripts/lmp_lite.py test.pdf test2.pdf test3.pdf
"""

import base64
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

import fitz  # PyMuPDF
import trafilatura
from openai import OpenAI

# 配置区域
ALIYUN_API_KEY = os.getenv("ALIYUN_API_KEY", "").strip()
ALIYUN_BASE_URL = os.getenv(
    "ALIYUN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
).strip()
VISION_MODEL = os.getenv("ALIYUN_VISION_MODEL", "qwen-vl-max")
TEMP_DIR = Path(os.getenv("TEMP_DIR", "./temp_conversion"))


def ensure_temp_dir() -> Path:
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    return TEMP_DIR


def parse_url(url: str) -> str:
    print(f"🌍 [Web] 抓取: {url}")
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return "> ⚠️ 网页下载失败或无法访问。\n"
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=True)
        if text:
            return f"# 来源: {url}\n\n{text}\n"
        return "> ⚠️ 网页已下载，但未能提取到正文内容（可能是纯图片或 JS 渲染）。\n"
    except Exception as e:  # noqa: BLE001
        return f"> ❌ 网页解析出错: {e}\n"


def office_to_pdf(input_path: Path) -> Optional[Path]:
    ensure_temp_dir()
    print(f"🔄 [Office] 转为 PDF: {input_path.name}")
    cmd = [
        "libreoffice",
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(TEMP_DIR),
        str(input_path),
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        pdf_path = TEMP_DIR / f"{input_path.stem}.pdf"
        return pdf_path if pdf_path.exists() else None
    except subprocess.CalledProcessError:
        print("❌ Office 转 PDF 失败，请检查文件/LibreOffice。")
        return None


def page_to_markdown(client: OpenAI, pdf_path: Path) -> str:
    doc = fitz.open(str(pdf_path))
    results: List[str] = []
    total_pages = len(doc)
    print(f"👁️ [Vision] 解析 PDF: {pdf_path.name}，共 {total_pages} 页")

    for i, page in enumerate(doc):
        try:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_b64 = base64.b64encode(pix.tobytes("png")).decode("utf-8")
            print(f"   -> 识别第 {i + 1}/{total_pages} 页")
            resp = client.chat.completions.create(
                model=VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "将图片内容转成 Markdown；保留表格/列表/标题，勿闲聊。",
                            },
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                        ],
                    }
                ],
            )
            page_text = resp.choices[0].message.content
            results.append(f"## 第 {i + 1} 页\n\n{page_text}\n")
            del pix, img_b64
        except Exception as e:  # noqa: BLE001
            print(f"   ❌ 第 {i + 1} 页失败: {e}")
            results.append(f"> [第 {i + 1} 页 解析错误]\n")

    doc.close()
    return "\n".join(results)


def process_target(client: OpenAI, target: str) -> None:
    if target.startswith("http://") or target.startswith("https://"):
        md = parse_url(target)
        out = Path("web_export.md")
    else:
        path = Path(target)
        if not path.exists():
            print(f"❌ 文件不存在: {path}")
            return
        out = Path(f"{path.name}.md")
        if path.suffix.lower() in {".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx"}:
            pdf_path = office_to_pdf(path)
            if not pdf_path:
                return
        elif path.suffix.lower() == ".pdf":
            pdf_path = path
        else:
            print(f"❌ 不支持的文件格式: {path.suffix}")
            return
        md = page_to_markdown(client, pdf_path)
        if pdf_path != path and pdf_path.exists():
            pdf_path.unlink(missing_ok=True)

    out.write_text(md, encoding="utf-8")
    print(f"✅ 输出: {out.resolve()}")


def main(argv: List[str]) -> None:
    if not ALIYUN_API_KEY:
        print("❌ 请先设置环境变量 ALIYUN_API_KEY (DashScope Key)")
        sys.exit(1)

    if len(argv) < 2:
        print("用法: python scripts/lmp_lite.py <file_or_url> [更多文件]")
        print("示例: python scripts/lmp_lite.py test.pdf test2.pdf test3.pdf")
        sys.exit(1)

    client = OpenAI(api_key=ALIYUN_API_KEY, base_url=ALIYUN_BASE_URL)

    for target in argv[1:]:
        process_target(client, target)


if __name__ == "__main__":
    main(sys.argv)
