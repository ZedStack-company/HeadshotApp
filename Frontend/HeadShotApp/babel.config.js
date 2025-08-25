module.exports = function(api) {
  api.cache(true);
  
  const presets = ['babel-preset-expo'];
  const plugins = [
    'react-native-reanimated/plugin',
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
  ];

  // Only add this plugin for testing
  if (process.env.NODE_ENV === 'test') {
    plugins.push('@babel/plugin-transform-modules-commonjs');
  }

  return {
    presets,
    plugins,
  };
};