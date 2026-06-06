import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { calcCorrectRate, formatDuration } from '@/utils';
import './index.scss';

interface ResultState {
  total: number;
  correct: number;
  time: number;
  correctRate: number;
}

export default class PracticeResult extends Component<PropsWithChildren, ResultState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      total: 0,
      correct: 0,
      time: 0,
      correctRate: 0
    };
  }

  componentDidMount() {
    const instance = getCurrentInstance();
    const params = instance?.router?.params || {};

    const total = parseInt(params.total || '0');
    const correct = parseInt(params.correct || '0');
    const time = parseInt(params.time || '0');
    const correctRate = calcCorrectRate(correct, total);

    this.setState({ total, correct, time, correctRate });
  }

  handleRetry = () => {
    Taro.redirectTo({
      url: '/pages/practice/index'
    });
  };

  handleBackHome = () => {
    Taro.switchTab({
      url: '/pages/home/index'
    });
  };

  handleViewHistory = () => {
    Taro.navigateTo({
      url: '/pages/practice-history/index'
    });
  };

  render() {
    const { total, correct, time, correctRate } = this.state;

    return (
      <View className='result-page'>
        {/* 结果卡片 */}
        <View className='result-card'>
          <View className='result-header'>
            <Text className='result-title'>练习完成</Text>
            <Text className='result-subtitle'>本次练习结果</Text>
          </View>

          {/* 正确率圆环 */}
          <View className='rate-circle'>
            <View className='circle-bg'>
              <View className='circle-fill' style={{
                background: `conic-gradient(${this.getRateColor(correctRate)} ${correctRate * 3.6}deg, #F0F0F0 0deg)`
              }} />
              <View className='circle-inner'>
                <Text className='rate-value'>{correctRate}%</Text>
                <Text className='rate-label'>正确率</Text>
              </View>
            </View>
          </View>

          {/* 统计数据 */}
          <View className='stats-grid'>
            <View className='stat-item'>
              <View className='stat-icon total-icon' />
              <View className='stat-info'>
                <Text className='stat-value'>{total}</Text>
                <Text className='stat-label'>总题数</Text>
              </View>
            </View>
            <View className='stat-item'>
              <View className='stat-icon correct-icon' />
              <View className='stat-info'>
                <Text className='stat-value'>{correct}</Text>
                <Text className='stat-label'>答对</Text>
              </View>
            </View>
            <View className='stat-item'>
              <View className='stat-icon wrong-icon' />
              <View className='stat-info'>
                <Text className='stat-value'>{total - correct}</Text>
                <Text className='stat-label'>答错</Text>
              </View>
            </View>
            <View className='stat-item'>
              <View className='stat-icon time-icon' />
              <View className='stat-info'>
                <Text className='stat-value'>{formatDuration(time)}</Text>
                <Text className='stat-label'>用时</Text>
              </View>
            </View>
          </View>

          {/* 评价 */}
          <View className='evaluation'>
            <Text className='evaluation-text'>{this.getEvaluation(correctRate)}</Text>
          </View>
        </View>

        {/* 操作按钮 */}
        <View className='action-buttons'>
          <View className='action-btn retry-btn' onClick={this.handleRetry}>
            <Text className='action-btn-text'>再练一次</Text>
          </View>
          <View className='action-btn history-btn' onClick={this.handleViewHistory}>
            <Text className='action-btn-text'>查看历史</Text>
          </View>
          <View className='action-btn home-btn' onClick={this.handleBackHome}>
            <Text className='action-btn-text'>返回首页</Text>
          </View>
        </View>
      </View>
    );
  }

  private getRateColor(rate: number): string {
    if (rate >= 90) return '#52C41A';
    if (rate >= 70) return '#1890FF';
    if (rate >= 60) return '#FAAD14';
    return '#FF4D4F';
  }

  private getEvaluation(rate: number): string {
    if (rate >= 90) return '太棒了！你已经掌握了这些知识点！';
    if (rate >= 70) return '不错！继续努力，再接再厉！';
    if (rate >= 60) return '及格了！还有提升空间，加油！';
    return '需要加强练习，建议复习相关知识点。';
  }
}
