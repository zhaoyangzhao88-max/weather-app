document.addEventListener('DOMContentLoaded', function() {
    
    // 尝试从可选的全局变量读取 API Key（用户可创建 apikey.js，定义 OPENWEATHER_API_KEY）
    const apiKey = typeof OPENWEATHER_API_KEY !== 'undefined' ? OPENWEATHER_API_KEY : '';
    const cityInput = document.getElementById('city-input');
    const searchBtn = document.getElementById('search-btn');
    const weatherResults = document.getElementById('weather-results');
    const errorMessage = document.getElementById('error-message');
    const cityNameEl = document.getElementById('city-name');
    const weatherIconImg = document.getElementById('weather-icon-img');
    const temperatureEl = document.getElementById('temperature');
    const descriptionEl = document.getElementById('description');
    const humidityEl = document.getElementById('humidity');
    const windSpeedEl = document.getElementById('wind-speed');

    // 当需要时动态加载 pinyin-pro；缓存加载状态以避免重复插入
    let _pinyinLoaderPromise = null;
    function ensurePinyinLoaded(timeoutMs = 3000) {
        if (typeof pinyinPro !== 'undefined' && typeof pinyinPro.pinyin === 'function') {
            return Promise.resolve(true);
        }
        if (_pinyinLoaderPromise) return _pinyinLoaderPromise;

        _pinyinLoaderPromise = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pinyin-pro@3.18.5/dist/pinyin-pro.min.js';
            script.async = true;
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    console.warn('加载 pinyin-pro 超时');
                    resolve(false);
                }
            }, timeoutMs);
            script.onload = () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(typeof pinyinPro !== 'undefined');
                }
            };
            script.onerror = () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    console.log('拼音转换库未加载（将使用地理编码接口）');
                    resolve(false);
                }
            };
            document.head.appendChild(script);
        });

        return _pinyinLoaderPromise;
    }

    async function getWeather(cityQuery) {
        weatherResults.classList.add('hidden');
        errorMessage.classList.add('hidden');

        // --- 核心修改在这里！---
        let searchCity = cityQuery; // 默认使用原始输入

        // 检查输入是否包含中文字符
        // 这个正则表达式 /\p{Script=Han}/u 会匹配任何汉字
        if (/\p{Script=Han}/u.test(cityQuery)) {
            // 尝试动态加载 pinyin-pro（如果尚未加载）并等待其初始化
            const pinyinAvailable = await ensurePinyinLoaded();
            if (pinyinAvailable && typeof pinyinPro !== 'undefined' && typeof pinyinPro.pinyin === 'function') {
                // { toneType: 'none' } 表示不需要声调，最后去掉空格
                searchCity = pinyinPro.pinyin(cityQuery, { toneType: 'none' }).replace(/\s+/g, '');
                console.log(`中文 "${cityQuery}" 已转换为拼音: "${searchCity}"`);
            } else {
                // 使用原始输入，地理编码 API 也支持中文
                searchCity = cityQuery;
                console.log('使用原始城市名进行查询（地理编码 API 支持中文）');
            }
        }

        // 使用转换后的 searchCity 来构建 API URL
        if (!apiKey) {
            // 在页面上显示更明确的提示
            errorMessage.textContent = '未配置 API Key：请复制 apikey.example.js 为 apikey.js 并在其中填入你的 OpenWeatherMap API Key。';
            errorMessage.classList.remove('hidden');
            console.error('OpenWeather API Key 未配置。请参见 README.md');
            return;
        }

    // 使用 encodeURIComponent 编码 city（无论是拼音还是中文），以避免 URL 中出现非法字符
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(searchCity)}&appid=${apiKey}&units=metric&lang=zh_cn`;

        try {
            let response = await fetch(apiUrl);

            if (!response.ok) {
                // 如果是 404，尝试使用地理编码接口（支持中文/不同格式）获取经纬度后按坐标查询天气
                if (response.status === 404) {
                    const respBody = await response.text().catch(() => '');
                    console.log(`正在通过多种方式查找城市：${searchCity}`);
                    console.log(`1/3: 直接查询 - 未找到，尝试其他方式...`);

                    // 先尝试带国家码的形式（例如：绍兴,CN 或 shaoxing,CN），有时 OpenWeather 需要国家码以排除同名城市
                    const withCountry = `${searchCity},CN`;
                    console.log(`2/3: 尝试带国家码查询: ${withCountry}`);
                    let resp2 = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(withCountry)}&appid=${apiKey}&units=metric&lang=zh_cn`);
                    if (resp2.ok) {
                        console.log('成功：使用国家码找到城市');
                        response = resp2;
                    } else {
                        console.log(`3/3: 尝试地理编码查询...`);
                        const geo = await geocodeCity(searchCity);
                        if (geo) {
                            const lat = geo.lat;
                            const lon = geo.lon;
                            const byCoordUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=zh_cn`;
                            console.log(`成功：地理编码找到城市，坐标：lat=${lat}, lon=${lon}`);
                            response = await fetch(byCoordUrl);
                            const responseText = await response.text();
                            if (!response.ok) {
                                throw new Error(`按坐标请求天气失败：HTTP ${response.status} - ${responseText}`);
                            }
                            try {
                                const weatherData = JSON.parse(responseText);
                                const cityName = geo.local_names?.zh || geo.name; // 优先使用中文名，否则用标准名
                                console.log(`天气查询完成：找到 ${cityName} 的天气信息`);
                                updateWeatherUI(weatherData, cityName);
                                return; // 直接返回，避免后续的 response.json()
                            } catch (e) {
                                throw new Error(`解析天气响应失败：${e.message} - ${responseText}`);
                            }
                        } else {
                            throw new Error('404 Not Found：找不到城市信息（地理编码也未返回结果），请检查输入或尝试英文/拼音名；查看控制台以获取更多详情。');
                        }
                    }
                    // 如果 resp2 成功则继续到后续解析及 updateWeatherUI
                } else if (response.status === 401) {
                    throw new Error('401 Unauthorized：API Key 无效或未激活（请检查你的 OpenWeather API Key）');
                } else {
                    const body = await response.text().catch(() => '');
                    throw new Error(`HTTP ${response.status} - ${body}`);
                }
            }

            // 只有在非坐标查询时才会到达这里
            const data = await response.json();
            updateWeatherUI(data); // 直接查询成功时使用 API 返回的城市名

        } catch (error) {
            console.error('获取天气数据时出错:', error);
            errorMessage.textContent = `获取天气数据时出错: ${error.message}`;
            errorMessage.classList.remove('hidden');
        }
    }

    // 使用 OpenWeather 地理编码 API 尝试解析城市名（支持中文/拼音/英文）
    async function geocodeCity(city) {
        // 尝试多种查询形式以提高命中率：原始, 原始+国家码, 可用时的拼音/拼音+国家码
        const attempts = [];
        attempts.push(city);
        attempts.push(`${city},CN`);

        // 如果 pinyin-pro 可用且输入包含汉字，尝试拼音形式
        try {
            if (/\p{Script=Han}/u.test(city) && typeof pinyinPro !== 'undefined' && typeof pinyinPro.pinyin === 'function') {
                const py = pinyinPro.pinyin(city, { toneType: 'none' }).replace(/\s+/g, '');
                if (py && py !== city) {
                    attempts.push(py);
                    attempts.push(`${py},CN`);
                }
            }
        } catch (e) {
            // 忽略拼音转换错误，继续使用其它尝试
            console.warn('拼音转换时发生错误，跳过拼音尝试：', e);
        }

        for (const q of attempts) {
            const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${apiKey}`;
            try {
                const resp = await fetch(geoUrl);
                const bodyText = await resp.text().catch(() => '');
                if (!resp.ok) {
                    if (resp.status === 401) {
                        throw new Error(`401 Unauthorized：API Key 无效或未激活（地理编码接口）。响应体：${bodyText}`);
                    }
                    console.warn(`地理编码尝试（${q}）返回非 2xx，响应体：`, bodyText);
                    continue;
                }
                let arr;
                try {
                    arr = JSON.parse(bodyText);
                } catch (_) {
                    arr = [];
                }
                if (Array.isArray(arr) && arr.length > 0) {
                    console.log(`地理编码命中（查询: ${q}）：`, arr[0]);
                    return arr[0];
                }
                console.warn(`地理编码尝试（${q}）返回空结果：`, arr);
            } catch (e) {
                console.error(`地理编码请求（${q}）出错:`, e);
            }
        }

        return null;
    }

    // 更新天气信息到 UI，可选传入准确的城市名（比如从地理编码获取的）
    function updateWeatherUI(data, accurateCityName = null) {
        // 优先使用地理编码返回的准确城市名（如果有），否则回退到天气 API 返回的名称
        cityNameEl.textContent = accurateCityName || data.name;
        temperatureEl.textContent = `${Math.round(data.main.temp)}°C`;
        descriptionEl.textContent = data.weather[0].description;
        humidityEl.textContent = `${data.main.humidity}%`;
        windSpeedEl.textContent = `${data.wind.speed.toFixed(1)} km/h`;
        const iconCode = data.weather[0].icon;
        weatherIconImg.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        weatherIconImg.alt = data.weather[0].description;
        weatherResults.classList.remove('hidden');
    }

    function handleSearch() {
        const city = cityInput.value.trim();
        if (city) {
            getWeather(city);
        }
    }

    searchBtn.addEventListener('click', handleSearch);
    cityInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });

});