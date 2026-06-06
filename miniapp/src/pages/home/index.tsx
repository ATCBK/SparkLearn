import { Component, PropsWithChildren } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { StudyStats, KnowledgeNode } from '@/types';
import { formatDuration, getMasteryLevel } from '@/utils';
import api from '@/services/api';
import useUserStore from '@/stores/useUserStore';
import './index.scss';

interface HomeState {
  stats: StudyStats | null;
  hotNodes: KnowledgeNode[];
  isLoading: boolean;
}

export default class Home extends Component<PropsWithChildren, HomeState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      stats: null,
      hotNodes: [],
      isLoading: true
    };
  }

  componentDidMount() {
    this.loadData();
  }

  loadData = async () => {
    try {
      this.setState({ isLoading: true });
      const [statsRes, graphRes] = await Promise.all([
        api.getStudyStats(),
        api.getKnowledgeGraph()
      ]);

      if (statsRes.code === 200) {
        this.setState({ stats: statsRes.data });
      }

      if (graphRes.code === 200) {
        const nodes = graphRes.data.nodes || [];
        const hotNodes = nodes
          .sort((a: KnowledgeNode, b: KnowledgeNode) => b.totalQuestions - a.totalQuestions)
          .slice(0, 6);
        this.setState({ hotNodes });
      }
    } catch (error) {
      console.error('加载首页数据失败:', error);
    } finally {
      this.setState({ isLoading: false });
    }
  };

  navigateTo = (url: string) => {
    Taro.navigateTo({ url });
  };

  navigateToTab = (url: string) => {
    Taro.switchTab({ url });
  };

  render() {
    const { stats, hotNodes, isLoading } = this.state;
    const user = useUserStore.getState().user;

    return (
      <View className='home-page'>
        {/* 顶部欢迎区域 */}
        <View className='welcome-section'>
          <View className='welcome-bg' />
          <View className='welcome-content'>
            <View className='user-info'>
              <Image
                className='avatar'
                src={user?.avatar || 'https://via.placeholder.com/80'}
              />
              <View className='greeting'>
                <Text className='greeting-text'>
                  {user ? `Hi，${user.nickname}` : 'Hi，欢迎使用SparkLearn'}
                </Text>
                <Text className='greeting-sub'>今天也要加油学习哦！</Text>
              </View>
            </View>
            <View className='study-summary'>
              <View className='summary-item'>
                <Text className='summary-value'>{stats?.studyDays || 0}</Text>
                <Text className='summary-label'>学习天数</Text>
              </View>
              <View className='summary-divider' />
              <View className='summary-item'>
                <Text className='summary-value'>{stats?.totalPractice || 0}</Text>
                <Text className='summary-label'>刷题总数</Text>
              </View>
              <View className='summary-divider' />
              <View className='summary-item'>
                <Text className='summary-value'>{stats?.correctRate || 0}%</Text>
                <Text className='summary-label'>正确率</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 功能入口 */}
        <View className='function-entry'>
          <View className='entry-grid'>
            <View className='entry-item' onClick={() => this.navigateToTab('/pages/practice/index')}>
              <View className='entry-icon practice-icon' />
              <Text className='entry-text'>智能刷题</Text>
            </View>
            <View className='entry-item' onClick={() => this.navigateToTab('/pages/graph/index')}>
              <View className='entry-icon graph-icon' />
              <Text className='entry-text'>知识图谱</Text>
            </View>
            <View className='entry-item' onClick={() => this.navigateTo('/pages/practice-history/index')}>
              <View className='entry-icon history-icon' />
              <Text className='entry-text'>刷题历史</Text>
            </View>
            <View className='entry-item' onClick={() => this.navigateTo('/pages/ai-chat/index')}>
              <View className='entry-icon ai-icon' />
              <Text className='entry-text'>AI 助手</Text>
            </View>
          </View>
        </View>

        {/* 今日学习 */}
        <View className='section'>
          <View className='section-header'>
            <Text className='section-title'>今日学习</Text>
            <Text className='section-more' onClick={() => this.navigateToTab('/pages/profile/index')}>
              查看更多
            </Text>
          </View>
          <View className='today-stats'>
            <View className='stat-card'>
              <View className='stat-icon time-icon' />
              <View className='stat-info'>
                <Text className='stat-value'>
                  {stats?.totalStudyTime ? formatDuration(stats.totalStudyTime) : '0分钟'}
                </Text>
                <Text className='stat-label'>学习时长</Text>
              </View>
            </View>
            <View className='stat-card'>
              <View className='stat-icon practice-count-icon' />
              <View className='stat-info'>
                <Text className='stat-value'>{stats?.totalPractice || 0}题</Text>
                <Text className='stat-label'>今日刷题</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 热门知识点 */}
        <View className='section'>
          <View className='section-header'>
            <Text className='section-title'>热门知识点</Text>
            <Text className='section-more' onClick={() => this.navigateToTab('/pages/graph/index')}>
              查看全部
            </Text>
          </View>
          <View className='knowledge-list'>
            {isLoading ? (
              <View className='loading'>加载中...</View>
            ) : hotNodes.length > 0 ? (
              hotNodes.map((node) => {
                const mastery = getMasteryLevel(node.masteryLevel);
                return (
                  <View
                    key={node.id}
                    className='knowledge-item'
                    onClick={() => this.navigateTo(`/pages/graph-detail/index?id=${node.id}`)}
                  >
                    <View className='knowledge-info'>
                      <Text className='knowledge-name'>{node.name}</Text>
                      <Text className='knowledge-count'>{node.totalQuestions}道题</Text>
                    </View>
                    <View className='knowledge-mastery'>
                      <View className='mastery-bar'>
                        <View
                          className='mastery-fill'
                          style={{ width: `${node.masteryLevel}%`, backgroundColor: mastery.color }}
                        />
                      </View>
                      <Text className='mastery-text' style={{ color: mastery.color }}>
                        {node.masteryLevel}%
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View className='empty'>暂无知识点数据</View>
            )}
          </View>
        </View>

        {/* 快速开始 */}
        <View className='section'>
          <View className='section-header'>
            <Text className='section-title'>快速开始</Text>
          </View>
          <View className='quick-start'>
            <View
              className='start-card'
              onClick={() => {
                Taro.setStorageSync('practiceMode', 'random');
                this.navigateToTab('/pages/practice/index');
              }}
            >
              <View className='start-icon random-icon' />
              <View className='start-info'>
                <Text className='start-title'>随机刷题</Text>
                <Text className='start-desc'>随机抽取题目练习</Text>
              </View>
            </View>
            <View
              className='start-card'
              onClick={() => {
                Taro.setStorageSync('practiceMode', 'wrong');
                this.navigateToTab('/pages/practice/index');
              }}
            >
              <View className='start-icon wrong-icon' />
              <View className='start-info'>
                <Text className='start-title'>错题重练</Text>
                <Text className='start-desc'>巩固薄弱知识点</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
}
