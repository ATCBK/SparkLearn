import { Component, PropsWithChildren } from 'react';
import { View, Text, Switch } from '@tarojs/components';
import Taro from '@tarojs/taro';
import useUserStore from '@/stores/useUserStore';
import './index.scss';

interface SettingsState {
  notifications: boolean;
  darkMode: boolean;
  autoSave: boolean;
}

export default class Settings extends Component<PropsWithChildren, SettingsState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      notifications: true,
      darkMode: false,
      autoSave: true
    };
  }

  componentDidMount() {
    this.loadSettings();
  }

  loadSettings = () => {
    try {
      const notifications = Taro.getStorageSync('setting_notifications') ?? true;
      const darkMode = Taro.getStorageSync('setting_darkMode') ?? false;
      const autoSave = Taro.getStorageSync('setting_autoSave') ?? true;
      this.setState({ notifications, darkMode, autoSave });
    } catch (e) {
      console.error('加载设置失败', e);
    }
  };

  handleToggle = (key: keyof SettingsState, value: boolean) => {
    this.setState({ [key]: value } as any);
    Taro.setStorageSync(`setting_${key}`, value);
  };

  handleClearCache = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '提示',
        content: '确定要清除缓存吗？这不会删除您的学习数据。',
        success: (res) => resolve(res.confirm)
      });
    });

    if (confirmed) {
      try {
        await Taro.clearStorage();
        Taro.showToast({ title: '缓存已清除', icon: 'success' });
        this.loadSettings();
      } catch (e) {
        console.error('清除缓存失败', e);
        Taro.showToast({ title: '清除失败', icon: 'error' });
      }
    }
  };

  handleFeedback = () => {
    Taro.navigateTo({ url: '/pages/ai-chat/index' });
  };

  handleAbout = () => {
    Taro.showModal({
      title: '关于 SparkLearn',
      content: 'SparkLearn v1.0.0\n\n个性化学习多智能体平台\n为学习者构建 AI 驱动的个性化学习闭环',
      showCancel: false
    });
  };

  render() {
    const { notifications, darkMode, autoSave } = this.state;

    return (
      <View className='settings-page'>
        {/* 通用设置 */}
        <View className='settings-section'>
          <Text className='section-title'>通用设置</Text>
          <View className='settings-card'>
            <View className='settings-item'>
              <View className='item-info'>
                <Text className='item-title'>消息通知</Text>
                <Text className='item-desc'>接收学习提醒和系统通知</Text>
              </View>
              <Switch
                checked={notifications}
                onChange={(e) => this.handleToggle('notifications', e.detail.value)}
                color='#1890FF'
              />
            </View>
            <View className='settings-divider' />
            <View className='settings-item'>
              <View className='item-info'>
                <Text className='item-title'>深色模式</Text>
                <Text className='item-desc'>使用深色主题（即将支持）</Text>
              </View>
              <Switch
                checked={darkMode}
                onChange={(e) => this.handleToggle('darkMode', e.detail.value)}
                color='#1890FF'
                disabled
              />
            </View>
            <View className='settings-divider' />
            <View className='settings-item'>
              <View className='item-info'>
                <Text className='item-title'>自动保存</Text>
                <Text className='item-desc'>自动保存练习进度</Text>
              </View>
              <Switch
                checked={autoSave}
                onChange={(e) => this.handleToggle('autoSave', e.detail.value)}
                color='#1890FF'
              />
            </View>
          </View>
        </View>

        {/* 数据管理 */}
        <View className='settings-section'>
          <Text className='section-title'>数据管理</Text>
          <View className='settings-card'>
            <View className='settings-item clickable' onClick={this.handleClearCache}>
              <View className='item-info'>
                <Text className='item-title'>清除缓存</Text>
                <Text className='item-desc'>清除本地缓存数据</Text>
              </View>
              <View className='item-arrow' />
            </View>
          </View>
        </View>

        {/* 帮助与反馈 */}
        <View className='settings-section'>
          <Text className='section-title'>帮助与反馈</Text>
          <View className='settings-card'>
            <View className='settings-item clickable' onClick={this.handleFeedback}>
              <View className='item-info'>
                <Text className='item-title'>意见反馈</Text>
                <Text className='item-desc'>向我们反馈问题或建议</Text>
              </View>
              <View className='item-arrow' />
            </View>
            <View className='settings-divider' />
            <View className='settings-item clickable' onClick={this.handleAbout}>
              <View className='item-info'>
                <Text className='item-title'>关于</Text>
                <Text className='item-desc'>版本信息</Text>
              </View>
              <View className='item-arrow' />
            </View>
          </View>
        </View>

        {/* 版本信息 */}
        <View className='version-info'>
          <Text className='version-text'>SparkLearn v1.0.0</Text>
          <Text className='version-copyright'>© 2026 SparkLearn Team</Text>
        </View>
      </View>
    );
  }
}
