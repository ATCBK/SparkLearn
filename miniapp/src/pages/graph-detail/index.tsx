import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { KnowledgeNode } from '@/types';
import { getDifficultyText, getDifficultyColor, getMasteryLevel } from '@/utils';
import api from '@/services/api';
import './index.scss';

interface DetailState {
  node: KnowledgeNode | null;
  isLoading: boolean;
}

export default class GraphDetail extends Component<PropsWithChildren, DetailState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      node: null,
      isLoading: true
    };
  }

  componentDidMount() {
    const instance = getCurrentInstance();
    const params = instance?.router?.params || {};

    if (params.id) {
      this.loadNode(params.id);
    }
  }

  loadNode = async (id: string) => {
    try {
      this.setState({ isLoading: true });
      const res = await api.getKnowledgeNode(id);

      if (res.code === 200) {
        this.setState({ node: res.data });
      }
    } catch (error) {
      console.error('加载知识点详情失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handleStartPractice = () => {
    const { node } = this.state;
    if (node) {
      Taro.navigateTo({
        url: `/pages/practice/index?knowledgePointId=${node.id}&knowledgePointName=${encodeURIComponent(node.name)}`
      });
    }
  };

  handleViewNode = (nodeId: string) => {
    Taro.redirectTo({
      url: `/pages/graph-detail/index?id=${nodeId}`
    });
  };

  render() {
    const { node, isLoading } = this.state;

    if (isLoading) {
      return (
        <View className='detail-page'>
          <View className='loading'>加载中...</View>
        </View>
      );
    }

    if (!node) {
      return (
        <View className='detail-page'>
          <View className='empty'>知识点不存在</View>
        </View>
      );
    }

    const mastery = getMasteryLevel(node.masteryLevel);

    return (
      <View className='detail-page'>
        {/* 知识点信息 */}
        <View className='node-info'>
          <View className='info-header'>
            <Text className='node-name'>{node.name}</Text>
            <View
              className='difficulty-tag'
              style={{ backgroundColor: getDifficultyColor(node.difficulty) }}
            >
              <Text className='difficulty-tag-text'>{getDifficultyText(node.difficulty)}</Text>
            </View>
          </View>
          <Text className='node-category'>{node.category}</Text>
        </View>

        {/* 掌握度 */}
        <View className='mastery-section'>
          <View className='mastery-header'>
            <Text className='section-title'>掌握度</Text>
            <Text className='mastery-value' style={{ color: mastery.color }}>
              {node.masteryLevel}%
            </Text>
          </View>
          <View className='mastery-bar'>
            <View
              className='mastery-fill'
              style={{
                width: `${node.masteryLevel}%`,
                backgroundColor: mastery.color
              }}
            />
          </View>
          <Text className='mastery-text' style={{ color: mastery.color }}>
            {mastery.text}
          </Text>
        </View>

        {/* 统计数据 */}
        <View className='stats-section'>
          <View className='stats-card'>
            <View className='stat-item'>
              <Text className='stat-value'>{node.totalQuestions}</Text>
              <Text className='stat-label'>总题数</Text>
            </View>
            <View className='stat-divider' />
            <View className='stat-item'>
              <Text className='stat-value'>{node.completedQuestions}</Text>
              <Text className='stat-label'>已完成</Text>
            </View>
            <View className='stat-divider' />
            <View className='stat-item'>
              <Text className='stat-value'>
                {node.totalQuestions > 0
                  ? Math.round((node.completedQuestions / node.totalQuestions) * 100)
                  : 0}%
              </Text>
              <Text className='stat-label'>完成率</Text>
            </View>
          </View>
        </View>

        {/* 前置知识点 */}
        {node.prerequisites.length > 0 && (
          <View className='prerequisites-section'>
            <Text className='section-title'>前置知识点</Text>
            <View className='node-list'>
              {node.prerequisites.map((prereqId) => (
                <View
                  key={prereqId}
                  className='node-item'
                  onClick={() => this.handleViewNode(prereqId)}
                >
                  <Text className='node-item-text'>{prereqId}</Text>
                  <View className='node-arrow' />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 子知识点 */}
        {node.children.length > 0 && (
          <View className='children-section'>
            <Text className='section-title'>子知识点</Text>
            <View className='node-list'>
              {node.children.map((childId) => (
                <View
                  key={childId}
                  className='node-item'
                  onClick={() => this.handleViewNode(childId)}
                >
                  <Text className='node-item-text'>{childId}</Text>
                  <View className='node-arrow' />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        <View className='action-buttons'>
          <View className='action-btn practice-btn' onClick={this.handleStartPractice}>
            <Text className='action-btn-text'>开始练习</Text>
          </View>
        </View>
      </View>
    );
  }
}
