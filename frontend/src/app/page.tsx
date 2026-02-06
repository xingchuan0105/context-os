'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles, MessageSquareText, Layers, Share2, ArrowRight, PanelLeft } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#0D0D0F] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_8%_-10%,rgba(99,102,241,0.18),transparent),radial-gradient(800px_520px_at_92%_-10%,rgba(59,130,246,0.15),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
        <Button asChild className="bg-indigo-500 text-white hover:bg-indigo-400">
          <Link href="/register">立即注册</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-white/40 bg-white/10 text-white hover:bg-white/20"
        >
          <Link href="/login">登录</Link>
        </Button>
      </div>

      <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col px-6 py-14 lg:py-18">
        <main className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-10 md:p-12 backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-indigo-200">
              <MessageSquareText className="h-3.5 w-3.5 text-indigo-300" />
              极简输入 · 对话生成 · 结构化沉淀
            </div>
            <div className="mt-6 space-y-5">
              <h2 className="text-5xl font-semibold text-white md:text-6xl">
                用最少的文字，搭建可检索的研究系统
              </h2>
              <p className="max-w-3xl text-lg text-slate-300 md:text-xl">
                NotebookContext 是面向个人研究的知识 OS。写下一句，系统追问并整理为结构化笔记，
                同时连接多源资料，让你的思考可以被检索、被复用、被扩展。
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-indigo-500/40 via-sky-400/30 to-violet-500/40 blur-sm" />
                <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1014] px-5 py-4 text-base text-slate-300 shadow-[0_0_28px_rgba(99,102,241,0.28)]">
                  <span className="text-slate-500">输入一句研究想法...</span>
                  <span className="ml-auto font-mono text-xs text-indigo-300">⌘ ⏎</span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <Layers className="h-5 w-5 text-indigo-300" />
              <p className="mt-4 text-base font-semibold text-white">对话即结构</p>
              <p className="mt-2 text-sm text-slate-400">
                每轮对话都沉淀为可检索的笔记块。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <MessageSquareText className="h-5 w-5 text-sky-300" />
              <p className="mt-4 text-base font-semibold text-white">极简输入</p>
              <p className="mt-2 text-sm text-slate-400">
                用一句话触发深度追问与整理。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <Share2 className="h-5 w-5 text-violet-300" />
              <p className="mt-4 text-base font-semibold text-white">多源召回</p>
              <p className="mt-2 text-sm text-slate-400">
                所有回答都附带来源与引用。
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
