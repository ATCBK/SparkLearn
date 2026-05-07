'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { Eye, EyeOff } from 'lucide-react'
import { GoogleIcon, MicrosoftIcon, AppleIcon } from '@/components/ui/ThirdPartyIcons'

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remember, setRemember] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push('/onboarding');
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex w-full  bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden relative z-10 bg-center bg-cover bg-no-repeat" 
        style={{ 
          backgroundImage: 'url(/sparklearn-background-no-form.png)',
          backgroundSize: '100% 100%',       // 保持比例铺满，多余部分裁剪
          backgroundPosition: 'center',  // 始终居中
          backgroundRepeat: 'no-repeat'
        }}>
        {/* 左侧宣传区 */}
        <div className="w-1/2 flex flex-col justify-center px-14 py-10 bg-transparent">
          <div className="mb-8">
            {/* <img src="/logo.png" alt="SparkLearn Logo" className="w-14 h-14 mb-6" />
            <div className="text-2xl font-bold text-[#1A1A1A] mb-2">SparkLearn</div>
            <div className="text-base text-[#6B7280] mb-6">AI 驱动的个性化学习平台</div>
            <div className="text-3xl font-bold text-[#22223B] mb-2 leading-snug">
              让学习更高效<br />让成长看得见
            </div>
            <div className="text-[#6B7280] text-sm mb-8">
              SparkLearn 利用 AI 技术为你提供个性化学习路径，帮助你更好地理解、练习和掌握知识。
            </div> */}
            <div className="flex gap-8 mt-8">
              {/* <div className="flex flex-col items-center">
                <img src="/file.svg" alt="个性化学习" className="w-8 h-8 mb-2" />
                <div className="text-[#2563EB] text-base font-semibold">个性化学习</div>
                <div className="text-xs text-[#6B7280]">量身定制学习路径</div>
              </div>
              <div className="flex flex-col items-center">
                <img src="/globe.svg" alt="智能分析" className="w-8 h-8 mb-2" />
                <div className="text-[#10B981] text-base font-semibold">智能分析</div>
                <div className="text-xs text-[#6B7280]">精准掌握学习情况</div>
              </div>
              <div className="flex flex-col items-center">
                <img src="/window.svg" alt="高效提升" className="w-8 h-8 mb-2" />
                <div className="text-[#8B5CF6] text-base font-semibold">高效提升</div>
                <div className="text-xs text-[#6B7280]">科学方法事半功倍</div>
              </div> */}
            </div>
          </div>
        </div>
        {/* 右侧表单区 */}
        <div className="w-1/2 flex flex-col justify-center items-center px-14 py-10 ">
          <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-lg p-10">
            {/* Tabs */}
            <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl mb-8">
              <button
                onClick={() => setTab('login')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-base font-medium transition-colors',
                  tab === 'login'
                    ? 'bg-white text-[#2563EB] shadow'
                    : 'text-[#6B7280] hover:text-[#2563EB]'
                )}
              >
                登录
              </button>
              <button
                onClick={() => setTab('register')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-base font-medium transition-colors',
                  tab === 'register'
                    ? 'bg-white text-[#2563EB] shadow'
                    : 'text-[#6B7280] hover:text-[#2563EB]'
                )}
              >
                注册
              </button>
            </div>
            {/* 表单内容 */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm text-[#374151] mb-2">{tab === 'login' ? '邮箱或手机号' : '邮箱'}</label>
                <Input type="email" placeholder={tab === 'login' ? '请输入邮箱或手机号' : '请输入邮箱'} />
              </div>
              <div className="relative">
                <label className="block text-sm text-[#374151] mb-2">密码</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-[#9CA3AF] hover:text-[#2563EB]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {tab === 'register' && (
                <div className="relative">
                  <label className="block text-sm text-[#374151] mb-2">确认密码</label>
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="请再次输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-9 text-[#9CA3AF] hover:text-[#2563EB]"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]/20"
                  />
                  <span className="text-sm text-[#6B7280]">记住我</span>
                </label>
                <button type="button" className="text-sm text-[#2563EB] hover:underline bg-transparent border-0 p-0">
                  忘记密码？
                </button>
              </div>
              <Button className="w-full mt-2" size="lg" type="submit">
                {tab === 'login' ? '登录' : '注册'}
              </Button>
            </form>
            {/* 第三方登录 */}
            {/* <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <span className="mx-4 text-xs text-[#9CA3AF]">或使用以下方式登录</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>
            <div className="flex justify-center gap-6 mb-2">
              <button type="button" className="rounded-full border border-[#E5E7EB] p-3 hover:shadow transition">
                <GoogleIcon />
              </button>
              <button type="button" className="rounded-full border border-[#E5E7EB] p-3 hover:shadow transition">
                <MicrosoftIcon />
              </button>
              <button type="button" className="rounded-full border border-[#E5E7EB] p-3 hover:shadow transition">
                <AppleIcon />
              </button>
            </div> */}
            <div className="text-xs text-[#9CA3AF] text-center mt-4">
              登录即表示您同意 <a href="#" className="text-[#2563EB] hover:underline">《用户协议》</a> 和 <a href="#" className="text-[#2563EB] hover:underline">《隐私政策》</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
