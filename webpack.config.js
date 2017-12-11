// This webpack config is used to compile the JS for the CMS
const path = require('path')

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'config-examiner-2',
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['babel-preset-env', {
                targets: {
                  "browsers": "last 2 versions",
                  "node": "current"
                }
              }],
              'babel-preset-react'
            ],
            plugins: [
              "transform-runtime",
            ]
          },
        },
      },
    ],
  },
}
