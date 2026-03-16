import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, GalleryHorizontal, ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { BrandMark } from "@/components/entry/BrandMark";

const archiveModes = [
  {
    title: "装备墙",
    detail: "先回看你现在拥有什么、各自是什么状态。"
  },
  {
    title: "洞洞板",
    detail: "同一批装备切换到更偏陈列与偏好的观察方式。"
  },
  {
    title: "分析看板",
    detail: "趋势、频率和占比帮助你判断下一次该买什么。"
  }
];

const archiveSignals = [
  { label: "心智", value: "个人档案" },
  { label: "视角", value: "收藏 x 数据" },
  { label: "风格", value: "克制而锋利" }
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--bg)] text-text">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] blur-[120px]" />
        <div className="absolute right-[-9rem] top-[12rem] h-[22rem] w-[22rem] rounded-full bg-[color:color-mix(in_srgb,var(--bg-elevated)_72%,white)] blur-[120px]" />
        <div className="absolute bottom-[-8rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-[color:color-mix(in_srgb,var(--text)_7%,transparent)] blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_calc(50%-1px),color-mix(in_srgb,var(--border)_72%,transparent)_50%,transparent_calc(50%+1px))] opacity-45" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1380px] flex-col px-5 pb-16 pt-5 md:px-8 md:pb-20 md:pt-7 lg:px-10">
        <header className="flex items-center justify-between gap-5 py-3">
          <BrandMark compact />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[color:var(--panel-2)] px-5 text-sm font-medium text-text shadow-[inset_0_1px_0_var(--glass-border)] transition-all duration-200 hover:border-[var(--border-strong)] hover:bg-[color:var(--panel-3)]"
            >
              登录档案台
            </Link>
          </div>
        </header>

        <section className="grid gap-12 pb-14 pt-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(380px,0.96fr)] lg:items-end lg:gap-16 lg:pt-16">
          <div className="max-w-[46rem]">
            <div className="mb-8 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-mute)]">
              <span className="inline-flex items-center gap-2">
                <span className="h-px w-10 bg-[color:var(--border-strong)]" />
                Badminton Personal Archive
              </span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1 tracking-[0.16em]">
                单人长期使用
              </span>
            </div>

            <h1 className="max-w-[13ch] font-display text-[clamp(3.15rem,8vw,6.6rem)] font-semibold leading-[0.92] tracking-[-0.075em] text-[color:color-mix(in_srgb,var(--text)_92%,#0f2d33_8%)]">
              把每一次入手、损耗与偏爱，整理成你的羽球档案。
            </h1>

            <p className="mt-6 max-w-[36rem] text-[15px] leading-8 text-[color:color-mix(in_srgb,var(--text-mute)_88%,#10373d_12%)] md:text-[17px]">
              羽痕不是普通后台，也不是购物清单。它把装备记录、状态追踪、陈列视角和数据复盘压进同一张工作台，让每次购买都能留下判断依据与个人轨迹。
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(160deg,#1a4d57_0%,#11353d_55%,#0f2d33_100%)] px-6 text-sm font-medium text-[rgba(246,249,248,0.96)] shadow-[0_20px_38px_rgba(17,53,61,0.22)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                进入档案台
                <ArrowRight size={16} />
              </Link>
              <a
                href="#archive-modes"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border)] px-6 text-sm font-medium text-text transition-colors duration-200 hover:border-[var(--border-strong)] hover:bg-[color:var(--panel-2)]"
              >
                看首页结构
              </a>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {archiveSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="border-t border-[color:var(--border-strong)] pt-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-mute)]">
                    {signal.label}
                  </div>
                  <div className="mt-2 text-lg font-medium tracking-[-0.04em] text-text">{signal.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative lg:pb-3">
            <div className="absolute -left-6 top-12 hidden h-[74%] w-px bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--accent)_34%,transparent),transparent)] lg:block" />
            <div className="relative overflow-hidden rounded-[40px] border border-[color:color-mix(in_srgb,var(--accent)_14%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-3)_90%,white)_0%,color-mix(in_srgb,var(--panel-2)_96%,var(--bg))_100%)] p-5 shadow-[0_28px_64px_rgba(17,53,61,0.1)] md:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] pb-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-mute)]">
                    Archive Surface
                  </div>
                  <div className="mt-2 font-display text-[1.6rem] tracking-[-0.05em] text-text">
                    陈列与判断共存
                  </div>
                </div>
                <div className="rounded-full border border-[color:color-mix(in_srgb,var(--accent)_14%,var(--border))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
                  No. 001
                </div>
              </div>

              <div className="grid gap-5 pt-5 md:grid-cols-[1.08fr_0.92fr]">
                <div className="relative min-h-[24rem] overflow-hidden rounded-[30px] border border-[color:color-mix(in_srgb,var(--accent)_12%,var(--border))] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--panel-3)_94%,white)_0%,color-mix(in_srgb,var(--panel-2)_98%,var(--bg))_62%,color-mix(in_srgb,var(--panel)_96%,var(--bg))_100%)]">
                  <div className="absolute inset-x-5 top-5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
                    <span>Exhibit Board</span>
                    <span>Racket / Shoes / Shuttle</span>
                  </div>

                  <div className="absolute left-[8%] top-[16%] h-[56%] w-[30%] rotate-[-7deg]">
                    <Image
                      src="/gear-images/cutout/yonex_racket_arcsaber11pro_main_01.png"
                      alt="YONEX ARC SABER 11 Pro"
                      fill
                      className="object-contain drop-shadow-[0_24px_28px_rgba(17,53,61,0.2)]"
                      sizes="(max-width: 768px) 35vw, 18vw"
                    />
                  </div>

                  <div className="absolute right-[6%] top-[22%] h-[28%] w-[42%] rotate-[5deg]">
                    <Image
                      src="/gear-images/cutout/victor_shoes_p9200tty_cutout_01.png"
                      alt="VICTOR P9200TTY"
                      fill
                      className="object-contain drop-shadow-[0_18px_24px_rgba(17,53,61,0.18)]"
                      sizes="(max-width: 768px) 42vw, 18vw"
                    />
                  </div>

                  <div className="absolute bottom-[7%] left-[36%] h-[28%] w-[18%] rotate-[-6deg]">
                    <Image
                      src="/gear-images/cutout/rsl_shuttlecock_no1_cutout_01.png"
                      alt="RSL No.1"
                      fill
                      className="object-contain drop-shadow-[0_18px_24px_rgba(17,53,61,0.16)]"
                      sizes="(max-width: 768px) 18vw, 8vw"
                    />
                  </div>

                  <div className="absolute left-4 top-[42%] rounded-[20px] border border-[color:color-mix(in_srgb,var(--panel-3)_80%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_82%,white)] px-4 py-3 shadow-[0_12px_28px_rgba(17,53,61,0.08)] backdrop-blur md:left-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-mute)]">偏好焦点</div>
                    <div className="mt-1 text-sm font-medium text-text">控制感球拍 / 稳定型球鞋 / 高频消耗球</div>
                  </div>

                  <div className="absolute bottom-4 right-4 rounded-[22px] border border-[color:color-mix(in_srgb,var(--accent)_12%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_84%,white)] px-4 py-3 shadow-[0_12px_28px_rgba(17,53,61,0.08)] backdrop-blur">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
                      生命周期标签
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-text">
                      <span className="rounded-full bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--panel-2))] px-3 py-1">在用</span>
                      <span className="rounded-full bg-[color:color-mix(in_srgb,var(--accent)_8%,var(--panel-2))] px-3 py-1">闲置</span>
                      <span className="rounded-full bg-[color:color-mix(in_srgb,var(--accent)_8%,var(--panel-2))] px-3 py-1">已用完</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[28px] border border-[color:color-mix(in_srgb,var(--accent)_12%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_86%,white)] p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-mute)]">
                      判断层
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-start gap-3">
                        <BarChart3 className="mt-0.5 h-4 w-4 text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]" />
                        <p className="text-sm leading-7 text-[color:color-mix(in_srgb,var(--text)_88%,var(--text-mute)_12%)]">
                          不是展示完就结束，而是继续用趋势、频率和评分排行做购买复盘。
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]" />
                        <p className="text-sm leading-7 text-[color:color-mix(in_srgb,var(--text)_88%,var(--text-mute)_12%)]">
                          每件装备都保留状态、价格、时间与主观评价，形成完整的个人判断链。
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <GalleryHorizontal className="mt-0.5 h-4 w-4 text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]" />
                        <p className="text-sm leading-7 text-[color:color-mix(in_srgb,var(--text)_88%,var(--text-mute)_12%)]">
                          洞洞板让装备呈现更像藏品目录，而不是一串无法感知的数据库记录。
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                    <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_82%,white)] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
                        月度投入
                      </div>
                      <div className="mt-3 font-display text-[1.85rem] tracking-[-0.06em] text-text">¥1,486</div>
                      <div className="mt-2 text-xs leading-6 text-[color:var(--text-mute)]">不是炫数值，而是提醒自己这套偏爱值不值得继续追加。</div>
                    </div>

                    <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_82%,white)] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
                        高频品牌
                      </div>
                      <div className="mt-3 text-lg font-medium tracking-[-0.04em] text-text">YONEX / VICTOR / RSL</div>
                      <div className="mt-2 text-xs leading-6 text-[color:var(--text-mute)]">从品牌占比能直接读出自己的装备取向，而不是靠印象判断。</div>
                    </div>

                    <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_82%,white)] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
                        视图切换
                      </div>
                      <div className="mt-3 text-lg font-medium tracking-[-0.04em] text-text">档案墙 / 洞洞板 / 分析看板</div>
                      <div className="mt-2 text-xs leading-6 text-[color:var(--text-mute)]">不同视图不是重复信息，而是针对不同决策时刻切换观察方式。</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="archive-modes"
          className="grid gap-8 border-t border-[color:var(--border)] py-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-end lg:py-16"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {archiveModes.map((mode) => (
              <div
                key={mode.title}
                className="rounded-[28px] border border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_84%,white)] p-5"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
                  Core Module
                </div>
                <h3 className="mt-3 text-[1.1rem] font-medium tracking-[-0.035em] text-text">{mode.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[color:var(--text-mute)]">{mode.detail}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-start gap-4 rounded-[32px] border border-[color:color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--accent)_82%,#12353b)_0%,color-mix(in_srgb,var(--accent-dark)_88%,#0f2d33)_100%)] p-7 text-[rgba(244,249,247,0.94)] shadow-[0_24px_56px_rgba(17,53,61,0.22)]">
            <p className="max-w-[24rem] text-sm leading-7 text-[rgba(232,240,238,0.82)]">
              登录后先回看档案状态，再决定是继续整理陈列，还是去分析看板做判断。
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[rgba(245,248,247,0.94)] px-5 text-sm font-medium text-[#12353b] transition-transform duration-200 hover:-translate-y-0.5"
            >
              现在进入
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
