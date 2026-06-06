import { Component, PropsWithChildren } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { KnowledgeGraph, KnowledgeNode } from '@/types';
import { getMasteryLevel } from '@/utils';
import api from '@/services/api';
import './index.scss';

interface GraphState {
  graph: KnowledgeGraph | null;
  selectedCategory: string;
  categories: string[];
  filteredNodes: KnowledgeNode[];
  isLoading: boolean;
}

export default class Graph extends Component<PropsWithChildren, GraphState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      graph: null,
      selectedCategory: '全部',
      categories: ['全部'],
      filteredNodes: [],
      isLoading: true
    };
  }

  componentDidMount() {
    this.loadGraph();
  }

  loadGraph = async () => {
    try {
      this.setState({ isLoading: true });
      const res = await api.getKnowledgeGraph();

      if (res.code === 200) {
        const graph = res.data;
        const categories = ['全部', ...new Set(graph.nodes.map((n: KnowledgeNode) => n.category))];

        this.setState({
          graph,
          categories,
          filteredNodes: graph.nodes
        });
      }
    } catch (error) {
      console.error('加载知识图谱失败:', error);
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handleCategoryChange = (category: string) => {
    const { graph } = this.state;
    if (!graph) return;

    const filteredNodes = category === '全部'
      ? graph.nodes
      : graph.nodes.filter(n => n.category === category);

    this.setState({
      selectedCategory: category,
      filteredNodes
    });
  };

  handleNodeClick = (node: KnowledgeNode) => {
    Taro.navigateTo({
      url: `/pages/graph-detail/index?id=${node.id}`
    });
  };

  handleStartPractice = (node: KnowledgeNode) => {
    Taro.navigateTo({
      url: `/pages/practice/index?knowledgePointId=${node.id}&knowledgePointName=${encodeURIComponent(node.name)}`
    });
  };

  render() {
    const { selectedCategory, categories, filteredNodes, isLoading } = this.state;

    return (
      <View className='graph-page'>
        {/* 分类选择 */}
        <View className='category-section'>
          <ScrollView scrollX className='category-scroll'>
            {categories.map((category) => (
              <View
                key={category}
                className={`category-item ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => this.handleCategoryChange(category)}
              >
                <Text className='category-text'>{category}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 图谱概览 */}
        <View className='overview-section'>
          <View className='overview-card'>
            <View className='overview-item'>
              <Text className='overview-value'>{filteredNodes.length}</Text>
              <Text className='overview-label'>知识点</Text>
            </View>
            <View className='overview-divider' />
            <View className='overview-item'>
              <Text className='overview-value'>
                {filteredNodes.filter(n => n.masteryLevel >= 60).length}
              </Text>
              <Text className='overview-label'>已掌握</Text>
            </View>
            <View className='overview-divider' />
            <View className='overview-item'>
              <Text className='overview-value'>
                {filteredNodes.reduce((sum, n) => sum + n.totalQuestions, 0)}
              </Text>
              <Text className='overview-label'>题目数</Text>
            </View>
          </View>
        </View>

        {/* 知识点列表 */}
        <View className='nodes-section'>
          <View className='section-header'>
            <Text className='section-title'>知识点列表</Text>
            <Text className='section-subtitle'>
              点击查看详情，长按开始练习
            </Text>
          </View>

          {isLoading ? (
            <View className='loading'>加载中...</View>
          ) : filteredNodes.length > 0 ? (
            <View className='nodes-list'>
              {filteredNodes.map((node) => {
                const mastery = getMasteryLevel(node.masteryLevel);
                return (
                  <View
                    key={node.id}
                    className='node-card'
                    onClick={() => this.handleNodeClick(node)}
                    onLongPress={() => this.handleStartPractice(node)}
                  >
                    <View className='node-header'>
                      <View className='node-title-row'>
                        <Text className='node-name'>{node.name}</Text>
                        <View
                          className='difficulty-tag'
                          style={{ backgroundColor: this.getDifficultyColor(node.difficulty) }}
                        >
                          <Text className='difficulty-text'>
                            {this.getDifficultyText(node.difficulty)}
                          </Text>
                        </View>
                      </View>
                      <Text className='node-category'>{node.category}</Text>
                    </View>

                    <View className='node-stats'>
                      <View className='stat-item'>
                        <Text className='stat-value'>{node.totalQuestions}</Text>
                        <Text className='stat-label'>总题数</Text>
                      </View>
                      <View className='stat-item'>
                        <Text className='stat-value'>{node.completedQuestions}</Text>
                        <Text className='stat-label'>已完成</Text>
                      </View>
                      <View className='stat-item'>
                        <Text className='stat-value' style={{ color: mastery.color }}>
                          {node.masteryLevel}%
                        </Text>
                        <Text className='stat-label'>掌握度</Text>
                      </View>
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

                    {node.children.length > 0 && (
                      <View className='node-children'>
                        <Text className='children-label'>子知识点：</Text>
                        <Text className='children-count'>{node.children.length}个</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className='empty'>暂无知识点数据</View>
          )}
        </View>
      </View>
    );
  }

  private getDifficultyText(difficulty: string): string {
    const map: Record<string, string> = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    };
    return map[difficulty] || difficulty;
  }

  private getDifficultyColor(difficulty: string): string {
    const map: Record<string, string> = {
      easy: '#52C41A',
      medium: '#FAAD14',
      hard: '#FF4D4F'
    };
    return map[difficulty] || '#999999';
  }
}
