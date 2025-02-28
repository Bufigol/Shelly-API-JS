const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  mode: "development",
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
    path: path.resolve(__dirname, "public"),
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
      directory: path.join(__dirname, "public"),
    },
    compress: true,
    port: 3000,
    host: "localhost", // Cambiado a localhost
    historyApiFallback: {
      index: "index.html",
      rewrites: [
        { from: /^\/bundle.js$/, to: "/bundle.js" },
        { from: /^\/reset-password\/([a-z0-9]+)$/, to: '/index.html' },
        { from: /./, to: "/index.html" },
      ],
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