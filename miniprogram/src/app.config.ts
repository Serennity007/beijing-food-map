export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/detail/index',
    'pages/submit/index',
    'pages/me/index',
    'pages/login/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f4f1eb',
    navigationBarTitleText: '京城黔味地图',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f4f1eb',
  },
  tabBar: {
    color: '#8a8379',
    selectedColor: '#8c2f24',
    backgroundColor: '#fffefb',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '逛地图' },
      { pagePath: 'pages/submit/index', text: '推荐好店' },
      { pagePath: 'pages/me/index', text: '我的地图' },
    ],
  },
})
