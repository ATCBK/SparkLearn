import { defineConfig } from '@tarojs/cli'

const apiBaseUrl = process.env.TARO_APP_API_BASE_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  projectName: 'SparkLearn',
  date: '2026-06-09',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-react'],
  defineConstants: {
    __API_BASE_URL__: JSON.stringify(apiBaseUrl)
  },
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false
      }
    }
  },
  h5: {}
})
