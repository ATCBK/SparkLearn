import Taro from '@tarojs/taro';

// 格式化时间
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

// 格式化日期（不含时间）
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 格式化相对时间
export const formatRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
};

// 格式化时长（秒转为分秒）
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}分${secs}秒`;
  }
  return `${secs}秒`;
};

// 计算正确率
export const calcCorrectRate = (correct: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
};

// 获取难度文本
export const getDifficultyText = (difficulty: string): string => {
  const map: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };
  return map[difficulty] || difficulty;
};

// 获取难度颜色
export const getDifficultyColor = (difficulty: string): string => {
  const map: Record<string, string> = {
    easy: '#52C41A',
    medium: '#FAAD14',
    hard: '#FF4D4F'
  };
  return map[difficulty] || '#999999';
};

// 获取掌握度等级
export const getMasteryLevel = (mastery: number): { text: string; color: string } => {
  if (mastery >= 90) return { text: '优秀', color: '#52C41A' };
  if (mastery >= 70) return { text: '良好', color: '#1890FF' };
  if (mastery >= 50) return { text: '一般', color: '#FAAD14' };
  return { text: '待提升', color: '#FF4D4F' };
};

// 显示提示
export const showToast = (title: string, icon: 'success' | 'error' | 'none' = 'none') => {
  Taro.showToast({
    title,
    icon,
    duration: 2000
  });
};

// 显示加载
export const showLoading = (title: string = '加载中...') => {
  Taro.showLoading({ title, mask: true });
};

// 隐藏加载
export const hideLoading = () => {
  Taro.hideLoading();
};

// 显示确认对话框
export const showConfirm = (content: string, title: string = '提示'): Promise<boolean> => {
  return new Promise((resolve) => {
    Taro.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm);
      }
    });
  });
};

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastTime = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= delay) {
      func(...args);
      lastTime = now;
    }
  };
};

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timer: any;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

// 生成随机 ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 深拷贝
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

// 判断是否为空对象
export const isEmptyObject = (obj: any): boolean => {
  return Object.keys(obj).length === 0;
};

// 获取页面路径
export const getPagePath = (page: string): string => {
  return `/pages/${page}/index`;
};
