const webpack = require("webpack");

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    crypto: require.resolve("crypto-browserify") ,
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer"),
    util: require.resolve("util"),
    assert: false, // require.resolve("assert") can be polyfilled here if needed
    http: false, // require.resolve("stream-http") can be polyfilled here if needed
    https: false, // require.resolve("https-browserify") can be polyfilled here if needed
    os: false, // require.resolve("os-browserify") can be polyfilled here if needed
    url: false, // require.resolve("url") can be polyfilled here if needed
    zlib: false, // require.resolve("browserify-zlib") can be polyfilled here if needed
    net: false,
    tls: false,
    vm: false,
    bufferutil: require.resolve('bufferutil'),
    'utf-8-validate': false,
    fs: false,
    path: false,
  });
  config.resolve.fallback = fallback;
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
  ]);

  config.experiments = {
    asyncWebAssembly: true,
  };

  config.ignoreWarnings = [/Failed to parse source map/];
  config.module.rules.push({
    test: /\.(js|mjs|jsx)$/,
    enforce: "pre",
    loader: require.resolve("source-map-loader"),
    resolve: {
      fullySpecified: false,
    },
  });
  config.module.rules = config.module.rules.map((rule) => {
    if (rule.oneOf instanceof Array) {
      return {
        ...rule,
        oneOf: [{ test: /\.wasm$/, type: 'webassembly/async' }, ...rule.oneOf],
      };
    }
    return rule;
  });
  return config;
};
