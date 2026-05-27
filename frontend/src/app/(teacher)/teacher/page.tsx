'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TeacherIndexPage() {
  const router = useRouter()
  useEffect(() => {
    const token = localStorage.getItem('teacher_token')
    router.replace(token ? '/teacher/dashboard' : '/teacher/login')
  }, [router])
  return null
}
