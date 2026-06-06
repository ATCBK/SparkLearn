import { Component, PropsWithChildren } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { User, StudyStats } from '@/types';
import { formatDuration, calcCorrectRate } from '@/utils';
import api from '@/services/api';
import useUserStore from '@/stores/useUserStore';
import './index.scss';

interface ProfileState {
  stats: StudyStats | null;
  isLoading: boolean;
}

export default class Profile extends Component<PropsWithChildren, ProfileState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      stats: null,
      isLoading: true
    };
  }

  componentDidMount() {
    this.loadStats();
  }

  loadStats = async () => {
    try {
      this.setState({ isLoading: true });
      const res = await api.getStudyStats();

      if (res.code === 200) {
        this.setState({ stats: res.data });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handleLogin = async () => {
    try {
      // 模拟登录成功（后端暂无登录接口）
      const mockUser = {
        id: 'user_001',
        nickname: '学习者',
        avatar: ''
      };
      useUserStore.getState().setToken('mock_token');
      useUserStore.getState().setUser(mockUser);
      Taro.showToast({ title: '登录成功', icon: 'success' });
      this.loadStats();
    } catch (error) {
      console.error('登录失败:', error);
      Taro.showToast({ title: '登录失败', icon: 'error' });
    }
  };

  handleNavigate = (url: string) => {
    Taro.navigateTo({ url });
  };

  handleLogout = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => resolve(res.confirm)
      });
    });

    if (confirmed) {
      useUserStore.getState().logout();
      Taro.showToast({ title: '已退出登录', icon: 'success' });
    }
  };

  render() {
    const { stats, isLoading } = this.state;
    const user = useUserStore.getState().user;
    const isLoggedIn = useUserStore.getState().isLoggedIn;

    return (
      <View className='profile-page'>
        {/* 用户信息区域 */}
        <View className='user-section'>
          <View className='user-bg' />
          <View className='user-content'>
            {isLoggedIn && user ? (
              <View className='user-info'>
                <Image
                  className='avatar'
                  src={user.avatar || 'https://via.placeholder.com/120'}
                />
                <View className='user-detail'>
                  <Text className='nickname'>{user.nickname}</Text>
                  <Text className='level'>Lv.{user.level}</Text>
                </View>
              </View>
            ) : (
              <View className='login-prompt' onClick={this.handleLogin}>
                <View className='default-avatar' />
                <Text className='login-text'>点击登录</Text>
              </View>
            )}
          </View>
        </View>

        {/* 数据统计 */}
        <View className='stats-section'>
          <View className='stats-card'>
            <View className='stat-item'>
              <Text className='stat-value'>{stats?.totalPractice || 0}</Text>
              <Text className='stat-label'>刷题总数</Text>
            </View>
            <View className='stat-divider' />
            <View className='stat-item'>
              <Text className='stat-value'>{stats?.correctRate || 0}%</Text>
              <Text className='stat-label'>正确率</Text>
            </View>
            <View className='stat-divider' />
            <View className='stat-item'>
              <Text className='stat-value'>{stats?.studyDays || 0}</Text>
              <Text className='stat-label'>学习天数</Text>
            </View>
          </View>
        </View>

        {/* 功能菜单 */}
        <View className='menu-section'>
          <View className='menu-card'>
            <View className='menu-item' onClick={() => this.handleNavigate('/pages/practice-history/index')}>
              <View className='menu-icon history-icon' />
              <Text className='menu-text'>刷题历史</Text>
              <View className='menu-arrow' />
            </View>
            <View className='menu-divider' />
            <View className='menu-item' onClick={() => this.handleNavigate('/pages/practice/index?mode=wrong')}>
              <View className='menu-icon wrong-icon' />
              <Text className='menu-text'>错题本</Text>
              <View className='menu-arrow' />
            </View>
            <View className='menu-divider' />
            <View className='menu-item' onClick={() => this.handleNavigate('/pages/ai-chat/index')}>
              <View className='menu-icon ai-icon' />
              <Text className='menu-text'>AI 助手</Text>
              <View className='menu-arrow' />
            </View>
          </View>
        </View>

        {/* 学习分析 */}
        <View className='analysis-section'>
          <View className='section-header'>
            <Text className='section-title'>学习分析</Text>
          </View>

          {isLoading ? (
            <View className='loading'>加载中...</View>
          ) : stats?.knowledgeMastery && stats.knowledgeMastery.length > 0 ? (
            <View className='analysis-card'>
              {stats.knowledgeMastery.slice(0, 5).map((item, index) => (
                <View key={index} className='analysis-item'>
                  <View className='analysis-info'>
                    <Text className='analysis-name'>{item.category}</Text>
                    <Text className='analysis-value'>{item.mastery}%</Text>
                  </View>
                  <View className='analysis-bar'>
                    <View
                      className='analysis-fill'
                      style={{
                        width: `${item.mastery}%`,
                        backgroundColor: this.getMasteryColor(item.mastery)
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className='empty'>暂无学习数据</View>
          )}
        </View>

        {/* 设置和退出 */}
        <View className='bottom-section'>
          <View className='menu-card'>
            <View className='menu-item' onClick={() => this.handleNavigate('/pages/settings/index')}>
              <View className='menu-icon settings-icon' />
              <Text className='menu-text'>设置</Text>
              <View className='menu-arrow' />
            </View>
            {isLoggedIn && (
              <>
                <View className='menu-divider' />
                <View className='menu-item logout' onClick={this.handleLogout}>
                  <View className='menu-icon logout-icon' />
                  <Text className='menu-text'>退出登录</Text>
                  <View className='menu-arrow' />
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  private getMasteryColor(mastery: number): string {
    if (mastery >= 80) return '#52C41A';
    if (mastery >= 60) return '#1890FF';
    if (mastery >= 40) return '#FAAD14';
    return '#FF4D4F';
  }
}
