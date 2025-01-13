// webpack.config.js
const path = require("path");

module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "/dist/",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"], // Agrega esta regla para manejar CSS
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "[name].[ext]",
              outputPath: "images",
              publicPath: "dist/images",
            },
          },
        ],
      },
    ],
  },
  devServer: {
    port: 8080, // Cambiamos a 8080 en lugar de 3030
    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:3030",
      },
    ],
    historyApiFallback: true,
    hot: true,
  },
  resolve: {
    extensions: [".js"],
    fallback: {
      buffer: require.resolve("buffer/"),
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      util: require.resolve("util/"),
      vm: require.resolve("vm-browserify"),
    },
  },
  mode: "development", // o 'production'
};
