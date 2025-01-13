const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  mode: "development", // O 'production' al desplegar
  entry: path.resolve(__dirname, "src", "index.js"),
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src", "index.html"),
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: "asset/resource",
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
    fallback: {
      buffer: require.resolve("buffer/"),
      crypto: require.resolve("crypto-browserify"),
      vm: require.resolve("vm-browserify"),
      stream: require.resolve("stream-browserify"),
      util: require.resolve("util/"),
    },
    alias: {
      "process/browser": require.resolve("process/browser"),
    },
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
    },
    compress: true,
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: ["localhost", "thenext.ddns.net", "tnstrack.ddns.net"],
    historyApiFallback: {
      index: "index.html",
    },
    proxy: [
      {
        context: ["/api"],
        target: process.env.API_URL || "http://localhost:1337",
        changeOrigin: true,
        secure: false,
      },
    ],
  },
};
