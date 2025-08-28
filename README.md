# Weather App

说明：要让应用正常调用 OpenWeatherMap API，请创建一个名为 `apikey.js` 的文件（与 `script.js` 同级），并在其中定义一个全局常量 `OPENWEATHER_API_KEY`：

```javascript
// apikey.js
const OPENWEATHER_API_KEY = '在这里填入你的 OpenWeatherMap API Key';
```

复制 `apikey.example.js` 为 `apikey.js` 并替换为你的真实密钥。不要把 `apikey.js` 提交到公共仓库。

运行：在浏览器中打开 `index.html`，输入城市名并查询。支持中文城市名，会自动转换为拼音。
