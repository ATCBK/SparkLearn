import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PracticeSession } from '@/types';
import { formatTime, formatDuration, calcCorrectRate } from '@/utils';
import api from '@/services/api';
import './index.scss';

interface HistoryState {
  history: PracticeSession[];
  isLoading: boolean;
  page: number;
  hasMore: boolean;
}

export default class PracticeHistory extends Component<PropsWithChildren, HistoryState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      history: [],
      isLoading: true,
      page: 1,
      hasMore: true
    };
  }

  componentDidMount() {
    this.loadHistory();
  }

  loadHistory = async (isLoadMore: boolean = false) => {
    try {
      const { page } = this.state;
      this.setState({ isLoading: true });

      const res = await api.getPracticeHistory(isLoadMore ? page : 1, 10);

      if (res.code === 200) {
        const newHistory = isLoadMore
          ? [...this.state.history, ...res.data.list]
          : res.data.list;

        this.setState({
          history: newHistory,
          hasMore: newHistory.length < res.data.total,
          page: isLoadMore ? page + 1 : 2
        });
      }
    } catch (error) {
      console.error('加载练习历史失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handleLoadMore = () => {
    const { hasMore, isLoading } = this.state;
    if (hasMore && !isLoading) {
      this.loadHistory(true);
    }
  };

  handleViewDetail = (session: PracticeSession) => {
    Taro.navigateTo({
      url: `/pages/practice-result/index?total=${session.questionCount}&correct=${session.correctCount}&time=${this.calcTotalTime(session)}`
    });
  };

  calcTotalTime = (session: PracticeSession): number => {
    if (!session.endTime) return 0;
    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();
    return Math.floor((end - start) / 1000);
  };

  render() {
    const { history, isLoading, hasMore } = this.state;

    return (
      <View className='history-page'>
        {history.length > 0 ? (
          <View className='history-list'>
            {history.map((session) => {
              const correctRate = calcCorrectRate(session.correctCount, session.questionCount);
              const totalTime = this.calcTotalTime(session);

              return (
                <View
                  key={session.id}
                  className='history-card'
                  onClick={() => this.handleViewDetail(session)}
                >
                  <View className='card-header'>
                    <Text className='card-time'>{formatTime(session.startTime)}</Text>
                    <View
                      className='rate-tag'
                      style={{ backgroundColor: this.getRateColor(correctRate) }}
                    >
                      <Text className='rate-tag-text'>{correctRate}%</Text>
                    </View>
                  </View>

                  <View className='card-stats'>
                    <View className='stat-item'>
                      <Text className='stat-value'>{session.questionCount}</Text>
                      <Text className='stat-label'>总题数</Text>
                    </View>
                    <View className='stat-item'>
                      <Text className='stat-value' style={{ color: '#52C41A' }}>
                        {session.correctCount}
                      </Text>
                      <Text className='stat-label'>答对</Text>
                    </View>
                    <View className='stat-item'>
                      <Text className='stat-value'>{formatDuration(totalTime)}</Text>
                      <Text className='stat-label'>用时</Text>
                    </View>
                  </View>

                  {session.knowledgePointId && (
                    <View className='card-footer'>
                      <Text className='knowledge-point'>专项练习</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {hasMore && (
              <View className='load-more' onClick={this.handleLoadMore}>
                <Text className='load-more-text'>
                  {isLoading ? '加载中...' : '加载更多'}
                </Text>
              </View>
            )}
          </View>
        ) : isLoading ? (
          <View className='loading'>加载中...</View>
        ) : (
          <View className='empty'>
            <View className='empty-icon' />
            <Text className='empty-text'>暂无练习记录</Text>
            <View className='empty-btn' onClick={() => Taro.switchTab({ url: '/pages/practice/index' })}>
              <Text className='empty-btn-text'>去刷题</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  private getRateColor(rate: number): string {
    if (rate >= 90) return '#52C41A';
    if (rate >= 70) return '#1890FF';
    if (rate >= 60) return '#FAAD14';
    return '#FF4D4F';
  }
}
