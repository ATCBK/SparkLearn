import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface PieChartProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
  size?: number;
  showLegend?: boolean;
  showPercent?: boolean;
}

export default class PieChart extends Component<PropsWithChildren<PieChartProps>> {
  static defaultProps = {
    size: 200,
    showLegend: true,
    showPercent: true
  };

  render() {
    const { data, size, showLegend, showPercent } = this.props;

    if (!data || data.length === 0) {
      return (
        <View className='pie-chart-empty'>
          <Text className='empty-text'>暂无数据</Text>
        </View>
      );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <View className='pie-chart-component'>
        <View className='chart-container' style={{ width: `${size}px`, height: `${size}px` }}>
          {/* 简化的饼图显示 - 使用 CSS 实现 */}
          {data.map((item, index) => {
            const percent = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <View
                key={index}
                className='pie-slice'
                style={{
                  backgroundColor: item.color,
                  width: `${percent}%`
                }}
              />
            );
          })}
          <View className='pie-center'>
            <Text className='total-value'>{total}</Text>
            <Text className='total-label'>总计</Text>
          </View>
        </View>

        {showLegend && (
          <View className='chart-legend'>
            {data.map((item, index) => {
              const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <View key={index} className='legend-item'>
                  <View className='legend-color' style={{ backgroundColor: item.color }} />
                  <Text className='legend-label'>{item.label}</Text>
                  {showPercent && (
                    <Text className='legend-percent'>{percent}%</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }
}
