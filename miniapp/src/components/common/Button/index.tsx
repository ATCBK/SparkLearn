import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface ButtonProps {
  type?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  onClick?: () => void;
}

export default class Button extends Component<PropsWithChildren<ButtonProps>> {
  static defaultProps = {
    type: 'primary',
    size: 'medium',
    disabled: false,
    loading: false,
    block: false
  };

  handleClick = () => {
    const { disabled, loading, onClick } = this.props;
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  render() {
    const { type, size, disabled, loading, block, children } = this.props;

    return (
      <View
        className={`btn-component ${type} ${size} ${disabled ? 'disabled' : ''} ${loading ? 'loading' : ''} ${block ? 'block' : ''}`}
        onClick={this.handleClick}
      >
        {loading && (
          <View className='btn-loading'>
            <View className='loading-dot' />
            <View className='loading-dot' />
            <View className='loading-dot' />
          </View>
        )}
        <View className='btn-content'>
          {children}
        </View>
      </View>
    );
  }
}
