export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/graph/index',
    'pages/practice/index',
    'pages/profile/index',
    'pages/practice-result/index',
    'pages/practice-history/index',
    'pages/question-detail/index',
    'pages/graph-detail/index',
    'pages/ai-chat/index',
    'pages/settings/index'
  ],
  tabBar: {
    color: '#999999',
    selectedColor: '#1890FF',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png'
      },
      {
        pagePath: 'pages/graph/index',
        text: '知识图谱',
        iconPath: 'assets/icons/graph.png',
        selectedIconPath: 'assets/icons/graph-active.png'
      },
      {
        pagePath: 'pages/practice/index',
        text: '刷题',
        iconPath: 'assets/icons/practice.png',
        selectedIconPath: 'assets/icons/practice-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1890FF',
    navigationBarTitleText: 'SparkLearn',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F5F5'
  }
})
