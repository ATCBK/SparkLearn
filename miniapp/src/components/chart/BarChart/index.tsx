import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface BarChartProps {
  data: {
    label: string;
    value: number;
    color?: string;
  }[];
  maxValue?: number;
  showLabel?: boolean;
  showValue?: boolean;
  height?: number;
}

export default class BarChart extends Component<PropsWithChildren<BarChartProps>> {
  static defaultProps = {
    showLabel: true,
    showValue: true,
    height: 300
  };

  render() {
    const { data, maxValue, showLabel, showValue, height } = this.props;

    if (!data || data.length === 0) {
      return (
        <View className='bar-chart-empty'>
          <Text className='empty-text'>暂无数据</Text>
        </View>
      );
    }

    const max = maxValue || Math.max(...data.map(item => item.value));

    return (
      <View className='bar-chart-component' style={{ height: `${height}px` }}>
        <View className='chart-content'>
          {data.map((item, index) => {
            const percent = max > 0 ? (item.value / max) * 100 : 0;
            const color = item.color || '#1890FF';

            return (
              <View key={index} className='bar-item'>
                {showValue && (
                  <Text className='bar-value' style={{ color }}>
                    {item.value}
                  </Text>
                )}
                <View className='bar-track'>
                  <View
                    className='bar-fill'
                    style={{
                      width: `${percent}%`,
                      backgroundColor: color
                    }}
                  />
                </View>
                {showLabel && (
                  <Text className='bar-label'>{item.label}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  }
}
