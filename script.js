document.addEventListener('DOMContentLoaded', function() {
    // 从 apikey.js 读取 API Key
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

    async function getWeather(cityQuery) {
        weatherResults.classList.add('hidden');
        errorMessage.classList.add('hidden');

        // 检查 API Key
        if (!apiKey) {
            errorMessage.textContent = '请在 apikey.js 中配置有效的 OpenWeather API Key';
            errorMessage.classList.remove('hidden');
            return;
        }

        let searchCity = cityQuery;
        if (/\p{Script=Han}/u.test(cityQuery)) {
            try {
                if (typeof pinyinPro === 'undefined') {
                    console.log('拼音转换库未加载，将使用原始输入');
                } else {
                    searchCity = pinyinPro.pinyin(cityQuery, { toneType: 'none' }).replace(/\s+/g, '');
                    console.log(`已将 "${cityQuery}" 转换为拼音: "${searchCity}"`);
                }
            } catch (e) {
                console.log('拼音转换失败，将使用原始输入');
            }
        }
        try {
            // 1. 先尝试使用地理编码 API 获取坐标
            const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityQuery)}&limit=1&appid=${apiKey}`;
            const geoResponse = await fetch(geoUrl);
            
            if (!geoResponse.ok) {
                throw new Error('地理编码请求失败');
            }

            const geoData = await geoResponse.json();
            if (!geoData || !geoData.length) {
                errorMessage.textContent = '找不到该城市，请检查输入是否正确';
                errorMessage.classList.remove('hidden');
                return;
            }

            // 2. 使用获取到的坐标查询天气
            const { lat, lon, local_names } = geoData[0];
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=zh_cn`;
            const weatherResponse = await fetch(weatherUrl);
            
            if (!weatherResponse.ok) {
                throw new Error('天气数据请求失败');
            }

            const weatherData = await weatherResponse.json();
            // 使用地理编码返回的本地化名称（如果有的话）
            const localName = local_names?.zh || weatherData.name;
            updateWeatherUI(weatherData, localName);

        } catch (error) {
            console.error('获取天气数据时出错:', error);
            errorMessage.textContent = error.message === '地理编码请求失败' || error.message === '天气数据请求失败' 
                ? '获取天气信息失败，请稍后重试' 
                : '找不到该城市，请检查输入是否正确';
            errorMessage.classList.remove('hidden');
        }
    }

    // 天气背景图片映射
    const weatherBackgrounds = {
        // 晴天
        '01d': 'images/clear.JPG',
        '01n': 'images/clear.JPG',
        // 多云
        '02d': 'images/clouds.jpg',
        '02n': 'images/clouds.jpg',
        '03d': 'images/clouds.jpg',
        '03n': 'images/clouds.jpg',
        '04d': 'images/clouds.jpg',
        '04n': 'images/clouds.jpg',
        // 雨天
        '09d': 'images/rain.jpg',
        '09n': 'images/rain.jpg',
        '10d': 'images/rain.jpg',
        '10n': 'images/rain.jpg',
        '11d': 'images/rain.jpg', // 雷雨也使用雨天图片
        '11n': 'images/rain.jpg',
        // 默认背景
        'default': 'images/default.JPG'
    };

    function updateWeatherUI(data, localName = null) {
        // 优先使用本地化名称
        cityNameEl.querySelector('span').textContent = localName || data.name;
        temperatureEl.textContent = `${Math.round(data.main.temp)}°C`;
        descriptionEl.querySelector('span').textContent = data.weather[0].description;
        humidityEl.textContent = `${data.main.humidity}%`;
        windSpeedEl.textContent = `${data.wind.speed.toFixed(1)} km/h`;
        const iconCode = data.weather[0].icon;
        weatherIconImg.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        weatherIconImg.alt = data.weather[0].description;
        
        // 更新背景图片
        const backgroundImage = weatherBackgrounds[iconCode] || weatherBackgrounds['default'];
        document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('${backgroundImage}')`;
        
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