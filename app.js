// WeatherGPT - Frontend Core Controller

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const chatForm = document.getElementById('chat-form');
  const cityInput = document.getElementById('city-input');
  const sendBtn = document.getElementById('send-btn');
  const locationBtn = document.getElementById('location-btn');
  const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const messagesList = document.getElementById('messages-list');
  const welcomeScreen = document.getElementById('welcome-screen');
  const loadingIndicator = document.getElementById('loading-indicator');
  const recentSearchesList = document.getElementById('recent-searches-list');
  const noHistoryMsg = document.getElementById('no-history-msg');
  const favoritesList = document.getElementById('favorites-list');
  const noFavoritesMsg = document.getElementById('no-favorites-msg');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const unitCBtn = document.getElementById('unit-c-btn');
  const unitFBtn = document.getElementById('unit-f-btn');
  const langSelect = document.getElementById('lang-select');
  const micBtn = document.getElementById('mic-btn');
  
  // Mobile Sidebar Elements
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
  const closeSidebarBtn = document.getElementById('close-sidebar-btn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  
  // Backend Connection status element
  const statusDot = document.getElementById('status-dot');

  // --- Constants & Config ---
  const BACKEND_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  const HISTORY_LOCAL_STORAGE_KEY = 'weather_gpt_history';
  const MAX_HISTORY_ITEMS = 12;

  // Initialize Markdown-It
  let md;
  try {
    md = window.markdownit({
      html: false, // Disallow raw HTML for safety
      linkify: true,
      breaks: true
    });
  } catch (err) {
    console.error('Failed to initialize Markdown-It, falling back to plaintext:', err);
    md = { render: (text) => text };
  }

  // --- Application State ---
  let history = JSON.parse(localStorage.getItem(HISTORY_LOCAL_STORAGE_KEY)) || [];
  let isQuerying = false;
  let autocompleteTimeout = null;
  let favorites = JSON.parse(localStorage.getItem('weather_gpt_favorites')) || [];
  let activeUnit = localStorage.getItem('weather_gpt_unit') || 'C';
  let activeLanguage = localStorage.getItem('weather_gpt_lang') || 'en';

  // --- Translation Helper ---
  function t(key) {
    const dict = {
      card_humidity: 'Humidity',
      card_wind: 'Wind',
      card_feels_like: 'Feels Like',
      card_visibility: 'Visibility',
      card_pressure: 'Pressure',
      card_min_max: 'Min / Max',
      card_sunrise_sunset: 'Sunrise / Sunset',
      card_uv_index: 'UV Index',
      card_details_title: 'Current Conditions',
      card_5day_title: '5-Day Forecast',
      search_placeholder: 'Ask for weather in any city...',
      btn_new_chat: 'New Search',
      nav_popular: 'Popular',
      nav_favorites: 'Favorites',
      nav_recent: 'Recent',
      text_no_history: 'No recent searches.',
      btn_clear: 'Clear',
      error_geo_denied: 'Location access was denied.',
      btn_scan_sky: 'Scan Sky'
    };
    // Very simple localized dictionary fallback for missing keys
    return dict[key] || key.replace('card_', '').replace('_', ' ');
  }

  // --- Functions ---

  // Check if API is available on load (heartbeat)
  async function checkBackendStatus() {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      
      if (response.ok) {
        statusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
        statusDot.nextElementSibling.textContent = 'Online';
      } else {
        throw new Error('Not OK response');
      }
    } catch (e) {
      console.warn('FastAPI backend health check failed. It might be running, but is unreachable or CORS is blocking.', e);
      statusDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      statusDot.nextElementSibling.textContent = 'Offline';
    }
  }

  // Initialize Lucide Icons
  function updateIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Save city to history
  function saveToHistory(city) {
    if (!city) return;
    
    // Normalize casing for history list (e.g. "chennai" -> "Chennai")
    const formattedCity = city
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Remove duplicates
    history = history.filter(item => item.toLowerCase() !== formattedCity.toLowerCase());
    
    // Insert at front
    history.unshift(formattedCity);
    
    // Cap size
    if (history.length > MAX_HISTORY_ITEMS) {
      history.pop();
    }
    
    localStorage.setItem(HISTORY_LOCAL_STORAGE_KEY, JSON.stringify(history));
    renderHistory();
  }

  // Clear all history
  function clearHistory() {
    history = [];
    localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY);
    renderHistory();
  }

  // Render recent searches sidebar
  function renderHistory() {
    // Clear dynamic elements
    const dynamicItems = recentSearchesList.querySelectorAll('.recent-search-item');
    dynamicItems.forEach(item => item.remove());

    if (history.length === 0) {
      noHistoryMsg.classList.remove('hidden');
      return;
    }

    noHistoryMsg.classList.add('hidden');

    history.forEach(city => {
      const btn = document.createElement('button');
      btn.className = 'recent-search-item flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all text-left group';
      btn.setAttribute('data-city', city);
      
      btn.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <i data-lucide="history" class="w-4 h-4 text-slate-500 group-hover:text-weather-500 shrink-0"></i>
          <span class="truncate font-medium">${city}</span>
        </div>
        <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
      `;
      
      // Click event for history search item
      btn.addEventListener('click', () => {
        closeMobileSidebar();
        fetchWeather(city);
      });

      recentSearchesList.appendChild(btn);
    });

    updateIcons();
  }

  // Check if a city is in favorites list
  function isFavorite(city) {
    if (!city) return false;
    return favorites.some(fav => fav.toLowerCase() === city.trim().toLowerCase());
  }

  // Toggle favorite status for a city
  function toggleFavorite(city) {
    if (!city) return;
    const formattedCity = city.trim();
    const wasFavorite = isFavorite(formattedCity);

    if (wasFavorite) {
      favorites = favorites.filter(fav => fav.toLowerCase() !== formattedCity.toLowerCase());
    } else {
      // Capitalize properly for display
      const cleanCity = formattedCity
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      favorites.push(cleanCity);
    }

    localStorage.setItem('weather_gpt_favorites', JSON.stringify(favorites));
    renderFavorites();

    // Sync star icons in weather cards currently on screen
    const isFavNow = !wasFavorite;
    const allFavButtons = document.querySelectorAll(`.favorite-toggle-btn[data-favorite-city="${formattedCity}"]`);
    allFavButtons.forEach(btn => {
      const starIcon = btn.querySelector('i');
      if (starIcon) {
        if (isFavNow) {
          starIcon.classList.add('fill-yellow-300', 'text-yellow-300');
          starIcon.classList.remove('text-white');
        } else {
          starIcon.classList.remove('fill-yellow-300', 'text-yellow-300');
          starIcon.classList.add('text-white');
        }
      }
    });
  }

  // Render favorites list in sidebar
  function renderFavorites() {
    // Clear dynamic elements
    const dynamicItems = favoritesList.querySelectorAll('.favorite-item');
    dynamicItems.forEach(item => item.remove());

    if (favorites.length === 0) {
      noFavoritesMsg.classList.remove('hidden');
      return;
    }

    noFavoritesMsg.classList.add('hidden');

    favorites.forEach(city => {
      const div = document.createElement('div');
      div.className = 'favorite-item flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all group';
      
      div.innerHTML = `
        <button type="button" class="favorite-select-btn flex-1 truncate flex items-center gap-2.5 text-left border-none outline-none focus:text-white">
          <i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0"></i>
          <span class="truncate font-medium">${city}</span>
        </button>
        <button type="button" class="favorite-remove-btn p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none" data-remove-city="${city}" title="Remove from favorites">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;

      // Select handler
      div.querySelector('.favorite-select-btn').addEventListener('click', () => {
        closeMobileSidebar();
        fetchWeather(city);
      });

      // Remove handler
      div.querySelector('.favorite-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(city);
      });

      favoritesList.appendChild(div);
    });

    updateIcons();
  }

  // --- UI Translation & Voice helpers ---

  // Update translatable elements dynamically in the DOM
  function updateTranslatableElements() {
    const elements = document.querySelectorAll('.lang-translatable');
    elements.forEach(el => {
      const key = el.getAttribute('data-trans-key');
      if (key) {
        let txt = t(key);
        // Match original text casing / capitalization styling if useful
        if (el.classList.contains('uppercase')) {
          txt = txt.toUpperCase();
        }
        el.textContent = txt;
      }
    });
  }

  // Update static layout labels and values
  function updateUILanguage() {
    // 1. Dropdown select sync
    if (langSelect) {
      langSelect.value = activeLanguage;
    }

    // 2. Input search placeholder
    if (cityInput && !isListening && !isQuerying) {
      cityInput.placeholder = t('search_placeholder');
    }

    // 3. New Conversation button text
    const newChatSpan = document.getElementById('new-chat-btn-text');
    if (newChatSpan) {
      newChatSpan.textContent = t('btn_new_chat');
    }

    // 4. Sidebar section titles
    const popularTitle = document.getElementById('popular-cities-title');
    if (popularTitle) {
      popularTitle.textContent = t('nav_popular');
    }

    const favoritesTitle = document.getElementById('favorites-title');
    if (favoritesTitle) {
      favoritesTitle.textContent = t('nav_favorites');
    }

    const recentTitle = document.getElementById('recent-searches-title');
    if (recentTitle) {
      recentTitle.textContent = t('nav_recent');
    }

    // 5. Empty messages state texts
    const noFavText = document.getElementById('no-favorites-text');
    if (noFavText) {
      noFavText.textContent = t('text_no_favorites');
    }

    const noHistText = document.getElementById('no-history-text');
    if (noHistText) {
      noHistText.textContent = t('text_no_history');
    }

    // 6. Action button text strings
    if (clearHistoryBtn) {
      clearHistoryBtn.textContent = t('btn_clear');
    }

    // 7. Dynamic translatable items currently in the chat
    updateTranslatableElements();
  }

  // Text-To-Speech Output
  let activeUtterance = null;
  let activeSpeakBtn = null;

  function speakText(text, btn) {
    if (!window.speechSynthesis) {
      addMessageBubble('error', 'Text-to-Speech is not supported by your browser.');
      return;
    }

    // Stop speaking if currently active on this button
    if (window.speechSynthesis.speaking && activeSpeakBtn === btn) {
      window.speechSynthesis.cancel();
      resetTTSButton(btn);
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    if (activeSpeakBtn) {
      resetTTSButton(activeSpeakBtn);
    }

    activeSpeakBtn = btn;
    
    // Change icon to stop (square)
    const icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', 'square');
      btn.classList.add('text-weather-500', 'bg-weather-500/10');
      btn.setAttribute('title', 'Stop speaking');
      btn.setAttribute('aria-label', 'Stop speaking');
      updateIcons();
    }

    // Extract raw content text without markdown/HTML elements
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const cleanText = tempDiv.textContent || tempDiv.innerText || '';

    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterance = utterance;

    // Set voice language locale
    let langCode = 'en-IN';
    if (activeLanguage === 'ta') {
      langCode = 'ta-IN';
    } else if (activeLanguage === 'hi') {
      langCode = 'hi-IN';
    }
    utterance.lang = langCode;

    // Search matching speech voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      resetTTSButton(btn);
      if (activeSpeakBtn === btn) {
        activeSpeakBtn = null;
        activeUtterance = null;
      }
    };

    utterance.onerror = () => {
      resetTTSButton(btn);
      if (activeSpeakBtn === btn) {
        activeSpeakBtn = null;
        activeUtterance = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function resetTTSButton(btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', 'volume-2');
      btn.classList.remove('text-weather-500', 'bg-weather-500/10');
      btn.setAttribute('title', 'Speak Response');
      btn.setAttribute('aria-label', 'Speak Response');
      updateIcons();
    }
  }

  // Speech-To-Text Voice Input
  let recognition = null;
  let isListening = false;

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      isListening = true;
      micBtn.classList.add('text-rose-500', 'bg-rose-500/10', 'animate-pulse');
      micBtn.setAttribute('title', 'Listening...');
      micBtn.setAttribute('aria-label', 'Listening...');
      cityInput.placeholder = 'Listening for a city...';
      cityInput.disabled = true;
    };

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim().replace(/\.$/, '');
      if (transcript) {
        cityInput.value = transcript;
        cityInput.disabled = false;
        fetchWeather(transcript);
      }
    };

    rec.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      stopListeningUI();
      
      let errorMsg = 'Voice recognition error. Please try again.';
      if (e.error === 'not-allowed') {
        errorMsg = t('error_geo_denied');
      } else if (e.error === 'no-speech') {
        errorMsg = 'No speech detected. Please speak clearly next to your mic.';
      }
      
      addMessageBubble('error', errorMsg);
    };

    rec.onend = () => {
      stopListeningUI();
    };

    return rec;
  }

  function toggleVoiceInput() {
    if (isListening) {
      if (recognition) recognition.stop();
      return;
    }

    if (!recognition) {
      recognition = initSpeechRecognition();
    }

    if (!recognition) {
      addMessageBubble('error', 'Speech recognition is not supported in your browser. Please type city names manually.');
      return;
    }

    // Configure language locale matching the UI language
    let locale = 'en-IN';
    if (activeLanguage === 'ta') {
      locale = 'ta-IN';
    } else if (activeLanguage === 'hi') {
      locale = 'hi-IN';
    }
    recognition.lang = locale;

    recognition.start();
  }

  function stopListeningUI() {
    isListening = false;
    micBtn.classList.remove('text-rose-500', 'bg-rose-500/10', 'animate-pulse');
    micBtn.setAttribute('title', 'Voice Input');
    micBtn.setAttribute('aria-label', 'Voice Input');
    cityInput.placeholder = t('search_placeholder');
    cityInput.disabled = false;
  }

  // Get currently active temperature unit
  function getActiveUnit() {
    return activeUnit;
  }

  // Format Celsius value to string according to activeUnit
  function formatTemp(celsiusVal, includeUnit = true) {
    if (celsiusVal === undefined || celsiusVal === null) return '--';
    const tempNum = parseFloat(celsiusVal);
    if (isNaN(tempNum)) return celsiusVal;
    
    if (activeUnit === 'F') {
      const f = Math.round(tempNum * 1.8 + 32);
      return includeUnit ? `${f}°F` : `${f}°`;
    }
    const c = Math.round(tempNum);
    return includeUnit ? `${c}°C` : `${c}°`;
  }

  // Update toggle buttons visual styling
  function updateUnitToggleUI() {
    if (activeUnit === 'F') {
      unitFBtn.className = 'px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150 focus:outline-none bg-weather-600 text-white shadow-sm cursor-pointer';
      unitCBtn.className = 'px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150 focus:outline-none text-slate-400 hover:text-slate-200 cursor-pointer';
    } else {
      unitCBtn.className = 'px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150 focus:outline-none bg-weather-600 text-white shadow-sm cursor-pointer';
      unitFBtn.className = 'px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150 focus:outline-none text-slate-400 hover:text-slate-200 cursor-pointer';
    }
  }

  // Re-render and convert all temperatures currently displayed on screen
  function convertDisplayTemperatures() {
    const displays = document.querySelectorAll('.temp-display');
    displays.forEach(el => {
      const celsiusStr = el.getAttribute('data-celsius-temp');
      if (celsiusStr !== null && celsiusStr !== undefined && celsiusStr !== 'null') {
        const celsiusVal = parseFloat(celsiusStr);
        if (!isNaN(celsiusVal)) {
          const includeUnit = el.classList.contains('temp-no-unit') ? false : true;
          el.textContent = formatTemp(celsiusVal, includeUnit);
        }
      }
    });
  }

  // Convert degrees to compass direction abbreviation
  function getWindDirection(deg) {
    if (deg === undefined || deg === null) return '';
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
  }

  // Format Sunrise/Sunset Unix timestamps to local city time using timezone offset
  function formatSunTime(timestamp, timezoneOffset) {
    if (timestamp === undefined || timestamp === null) return 'N/A';
    
    // timestamp is in UTC seconds, timezoneOffset is seconds shift from UTC
    const utcDate = new Date(timestamp * 1000);
    // Apply shift to get local representation
    const localDate = new Date(utcDate.getTime() + (timezoneOffset * 1000));
    
    const hours = localDate.getUTCHours();
    const minutes = localDate.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const dispHours = hours % 12 || 12;
    const dispMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${dispHours}:${dispMinutes} ${ampm}`;
  }

  // Generate HTML for detailed weather metrics block
  function generateDetailsHTML(details) {
    if (!details) return '';

    // Unit checks
    const currentUnit = getActiveUnit();
    
    // Feels Like
    let feelsLikeVal = 'N/A';
    if (details.feels_like !== undefined && details.feels_like !== null) {
      const fl = currentUnit === 'F' ? (details.feels_like * 1.8 + 32) : details.feels_like;
      feelsLikeVal = `${Math.round(fl)}°${currentUnit}`;
    }

    // Min/Max
    let minMaxVal = 'N/A';
    if (details.temp_min !== undefined && details.temp_min !== null && details.temp_max !== undefined && details.temp_max !== null) {
      const minTemp = currentUnit === 'F' ? (details.temp_min * 1.8 + 32) : details.temp_min;
      const maxTemp = currentUnit === 'F' ? (details.temp_max * 1.8 + 32) : details.temp_max;
      minMaxVal = `${Math.round(minTemp)}° / ${Math.round(maxTemp)}°`;
    }

    // Wind direction
    const windDir = getWindDirection(details.wind_deg);
    const windVal = details.wind_speed !== undefined && details.wind_speed !== null 
      ? `${details.wind_speed.toFixed(1)} m/s ${windDir}`.trim()
      : 'N/A';

    // Visibility
    const visibilityVal = details.visibility !== undefined && details.visibility !== null
      ? `${(details.visibility / 1000).toFixed(1)} km`
      : 'N/A';

    // Pressure
    const pressureVal = details.pressure !== undefined && details.pressure !== null
      ? `${details.pressure} hPa`
      : 'N/A';

    // Sunrise / Sunset
    const sunriseVal = formatSunTime(details.sunrise, details.timezone);
    const sunsetVal = formatSunTime(details.sunset, details.timezone);

    // UV Index (unavailable in standard forecast API)
    const uvVal = 'N/A';

    return `
      <div class="mb-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-slate-300">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5 select-none">
          <i data-lucide="info" class="w-3.5 h-3.5"></i>
          <span class="lang-translatable" data-trans-key="card_details_title">${t('card_details_title')}</span>
        </h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <!-- Feels Like -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30">
            <i data-lucide="thermometer" class="w-5 h-5 text-amber-500/80"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_feels_like">${t('card_feels_like')}</div>
              <div class="font-extrabold text-white text-sm temp-display" data-celsius-temp="${details.feels_like || ''}">${feelsLikeVal}</div>
            </div>
          </div>
          
          <!-- Min/Max -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30">
            <i data-lucide="arrow-up-down" class="w-5 h-5 text-indigo-400/80"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_min_max">${t('card_min_max')}</div>
              <div class="font-extrabold text-white text-sm">
                <span class="temp-display temp-no-unit" data-celsius-temp="${details.temp_min || ''}">${details.temp_min !== undefined && details.temp_min !== null ? Math.round(currentUnit === 'F' ? (details.temp_min*1.8+32) : details.temp_min) + '°' : '--'}</span>
                <span>/</span>
                <span class="temp-display temp-no-unit" data-celsius-temp="${details.temp_max || ''}">${details.temp_max !== undefined && details.temp_max !== null ? Math.round(currentUnit === 'F' ? (details.temp_max*1.8+32) : details.temp_max) + '°' : '--'}</span>
              </div>
            </div>
          </div>
          
          <!-- Wind -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30">
            <i data-lucide="wind" class="w-5 h-5 text-teal-400/80"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_wind">${t('card_wind')}</div>
              <div class="font-extrabold text-white text-xs">${windVal}</div>
            </div>
          </div>
          
          <!-- Humidity -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30">
            <i data-lucide="droplet" class="w-5 h-5 text-sky-400/80"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_humidity">${t('card_humidity')}</div>
              <div class="font-extrabold text-white text-sm">${details.humidity !== undefined && details.humidity !== null ? details.humidity + '%' : 'N/A'}</div>
            </div>
          </div>
          
          <!-- Visibility -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30">
            <i data-lucide="eye" class="w-5 h-5 text-emerald-400/80"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_visibility">${t('card_visibility')}</div>
              <div class="font-extrabold text-white text-sm">${visibilityVal}</div>
            </div>
          </div>
          
          <!-- Pressure -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30">
            <i data-lucide="compass" class="w-5 h-5 text-slate-400/80"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_pressure">${t('card_pressure')}</div>
              <div class="font-extrabold text-white text-sm">${pressureVal}</div>
            </div>
          </div>
          
          <!-- Sunrise / Sunset -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30 col-span-2 md:col-span-1">
            <i data-lucide="sun-dim" class="w-5 h-5 text-amber-400/80"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_sunrise_sunset">${t('card_sunrise_sunset')}</div>
              <div class="font-extrabold text-white text-[10px]">${sunriseVal} / ${sunsetVal}</div>
            </div>
          </div>
          
          <!-- UV Index -->
          <div class="flex items-center gap-2.5 p-2 bg-slate-950/20 rounded-xl border border-slate-800/30">
            <i data-lucide="zap" class="w-5 h-5 text-yellow-500/85"></i>
            <div>
              <div class="text-[9px] text-slate-500 font-bold uppercase lang-translatable" data-trans-key="card_uv_index">${t('card_uv_index')}</div>
              <div class="font-extrabold text-white text-sm">${uvVal}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Reset/New Chat function
  function startNewChat() {
    messagesList.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
    cityInput.value = '';
    cityInput.focus();
    scrollToBottom();
  }

  // Toggle Loading Indicator UI
  function toggleLoading(show) {
    isQuerying = show;
    if (show) {
      loadingIndicator.classList.remove('hidden');
      sendBtn.disabled = true;
      cityInput.disabled = true;
      locationBtn.disabled = true;
      cityInput.placeholder = "WeatherGPT is looking up data...";
    } else {
      loadingIndicator.classList.add('hidden');
      sendBtn.disabled = false;
      cityInput.disabled = false;
      locationBtn.disabled = false;
      cityInput.placeholder = "Type a city name (e.g. Chennai, Paris, London)...";
    }
  }

  // Scroll Chat container to the bottom
  function scrollToBottom() {
    setTimeout(() => {
      chatMessagesContainer.scrollTo({
        top: chatMessagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    }, 50);
  }


  // Extract weather info from text
  function extractWeatherInfo(answerText, city) {
    // Try to find temperature: e.g., 32.5 °C, 29°C, 20.47 °C, -5°C, -2.5 °C
    const tempRegex = /(-?\d+(?:\.\d+)?)\s*(?:deg(?:ree)?s?|[^a-zA-Z0-9\s])*C\b/i;
    const tempMatch = answerText.match(tempRegex);
    const temperature = tempMatch ? `${tempMatch[1]}°C` : null;

    // Try to find humidity: e.g., Humidity is 57%, humidity of 57%, 57% humidity
    const humidityRegex = /(?:humidity|humid)(?:\s+is|\s+of)?\s*(?:around\s+)?(\d+)\s*%/i;
    const humidityMatch = answerText.match(humidityRegex) || answerText.match(/(\d+)\s*%\s*(?:humidity|humid)/i) || answerText.match(/(\d+)\s*%/); // fallback to first %
    const humidity = humidityMatch ? `${humidityMatch[1]}%` : null;

    // Try to find wind speed: e.g. "wind speed of 4.1 m/s", "wind is 10 km/h", "5m/s wind"
    const windRegex = /(?:wind|wind\s+speed)(?:\s+is|\s+of)?\s*(?:around\s+)?(\d+(?:\.\d+)?\s*(?:m\/s|km\/h|mph|kt|knots))/i;
    const windMatch = answerText.match(windRegex) || answerText.match(/(\d+(?:\.\d+)?\s*(?:m\/s|km\/h|mph|knots))\s*(?:wind|wind\s+speed)/i);
    const wind = windMatch ? windMatch[1] : null;

    // Try to find condition:
    let condition = null;
    
    // Attempt 1: look for "with [condition]" or "is [temp] with [condition]"
    // E.g., "is 32.5 °C with broken clouds" -> "broken clouds"
    const withConditionRegex = /(?:is|-?\d+(?:\.\d+)?\s*(?:deg(?:ree)?s?|[^a-zA-Z0-9\s])*C)\s+with\s+([a-zA-Z\s]{3,30})(?:\.|\s+and|\s+humidity|\s+wind|$)/i;
    const withMatch = answerText.match(withConditionRegex);
    if (withMatch) {
      const rawCond = withMatch[1].trim();
      // Exclude strings that look like templates, temperatures or too long/short
      if (!/^\d/.test(rawCond) && !/humidity/i.test(rawCond) && !/assistant/i.test(rawCond) && rawCond.length > 2) {
        condition = rawCond;
      }
    }

    // Attempt 2: Fallback condition detection using keywords if regex fails or is too broad
    if (!condition) {
      const keywords = [
        { key: 'clear sky', label: 'Clear Sky' },
        { key: 'clear', label: 'Clear' },
        { key: 'sunny', label: 'Sunny' },
        { key: 'broken clouds', label: 'Broken Clouds' },
        { key: 'scattered clouds', label: 'Scattered Clouds' },
        { key: 'few clouds', label: 'Few Clouds' },
        { key: 'overcast clouds', label: 'Overcast' },
        { key: 'cloudy', label: 'Cloudy' },
        { key: 'clouds', label: 'Clouds' },
        { key: 'heavy intensity rain', label: 'Heavy Rain' },
        { key: 'moderate rain', label: 'Moderate Rain' },
        { key: 'light rain', label: 'Light Rain' },
        { key: 'drizzle', label: 'Drizzle' },
        { key: 'rain', label: 'Rainy' },
        { key: 'thunderstorm', label: 'Thunderstorm' },
        { key: 'snow', label: 'Snowy' },
        { key: 'mist', label: 'Misty' },
        { key: 'fog', label: 'Foggy' },
        { key: 'haze', label: 'Hazy' }
      ];
      for (const kw of keywords) {
        if (new RegExp(`\\b${kw.key}\\b`, 'i').test(answerText)) {
          condition = kw.label;
          break;
        }
      }
    }

    // Capitalize first letter of condition words
    if (condition) {
      condition = condition
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }

    // Clean city name casing
    const formattedCity = city
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return {
      city: formattedCity,
      temperature,
      condition: condition || 'Unknown',
      humidity,
      wind
    };
  }

  // Extract potential candidate city keywords from query, filtering out common noise words
  function extractCandidates(query) {
    const cleanQuery = query.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\_`~()?]/g, " ") // remove punctuation except hyphens
      .replace(/\s+/g, " ")
      .trim();

    const noiseWords = new Set([
      'what', 'is', 'the', 'current', 'weather', 'forecast', 'in', 'at', 'for', 'how', 'hows', 'show', 'me', 'tell', 'of', 'to', 'a',
      'query', 'check', 'get', 'give', 'update', 'status', 'info', 'information', 'details', 'report', 'please',
      'dai', 'dei', 'maca', 'machan', 'machi', 'bro', 'dude', 'hey', 'hi', 'hello', 'today', 'tomorrow', 'yesterday',
      'innaku', 'innaiku', 'naalaiku', 'nalaiku', 'epdi', 'iruku', 'eppadi', 'irukku', 'evlo', 'varuma', 'sollu',
      'solla', 'kekku', 'mazhai', 'veyil', 'kulir', 'katru', 'kaka', 'poda', 'solra', 'laa', 'la', 'ky', 'le',
      'pona', 'poga', 'okay', 'va', 'jaasthi', 'romba', 'climate', 'ippo', 'ippa', 'now', 'naalai', 'indha', 'naal',
      'maari', 'condition', 'thooral', 'soodu', 'suduma', 'kuluru', 'chill', 'kaathu', 'kaatru', 'eerappatham', 'eeram',
      'jaasthia', 'jaasthe', 'adiga', 'adhiga', 'nalla', 'nalladhu', 'solra', 'pa', 'da', 'ah', 'ku', 'unaku', 'enaku',
      'solla', 'pesu', 'pathia', 'pathi', 'update', 'chances', 'chance',
      'mein', 'me', 'ka', 'ki', 'ke', 'mausam', 'aaj', 'kal', 'kaisa', 'hai', 'hoga', 'kitna', 'baarish', 'garmi',
      'thand', 'temperature', 'temp', 'humidity', 'rain', 'rainy', 'hot', 'cold', 'wind', 'visibility', 'pressure',
      'sunrise', 'sunset', 'uv', 'index', 'batao', 'dikhao', 'kya', 'hai', 'bhai', 'yaar', 'abho', 'abhi',
      'mazha', 'veyila', 'veyilaa', 'irukuma', 'irukumaa', 'iruka', 'irukaa', 'pannu', 'pannunga', 'varumaa', 'varum',
      'sollunga', 'evvalavu', 'jaasthiaa', 'jaasthi-ah'
    ]);

    // Split on space and hyphens to separate suffixes like coimbatore-ku or tokyo-la
    const words = cleanQuery.split(/[\s\-]+/);
    const candidatesRaw = [];
    const candidatesClean = [];

    for (let word of words) {
      if (!word) continue;
      
      // If it's a direct noise word, filter it
      if (noiseWords.has(word)) continue;

      // Unstripped candidate
      candidatesRaw.push(word);

      // Strip suffix: chennaila -> chennai, tokyoku -> tokyo
      let cleanWord = word;
      const suffixes = ['laa', 'la', 'ku', 'le', 'se', 'me', 'da', 'pa', 'ah', 'va'];
      for (const suffix of suffixes) {
        if (cleanWord.length > suffix.length + 2 && cleanWord.endsWith(suffix)) {
          cleanWord = cleanWord.slice(0, -suffix.length);
          break;
        }
      }
      candidatesClean.push(cleanWord);
    }

    return {
      rawPhrase: candidatesRaw.join(' '),
      cleanPhrase: candidatesClean.join(' ')
    };
  }

  // Validate candidate city using geocoding search API
  async function validateCityGeocode(cityName) {
    if (!cityName || !cityName.trim()) return null;
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/geocode/search?q=${encodeURIComponent(cityName.trim())}`);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0]; // Returns first/best match
        }
      }
    } catch (e) {
      console.warn('Geocoding validation lookup failed:', e);
    }
    return null;
  }

  // Generate HTML for extreme weather advisories/alerts banner
  function generateAlertsHTML(alerts) {
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return '';
    }

    let bannersHTML = '';
    alerts.forEach((alert, index) => {
      // Determine colors based on severity
      let bgClass = 'bg-slate-900/60 border-slate-800/80';
      let textClass = 'text-slate-300';
      let titleClass = 'text-slate-200';
      let iconColor = 'text-slate-400';
      let iconName = 'info';

      if (alert.severity === 'emergency') {
        bgClass = 'bg-rose-950/40 border-rose-500/30';
        textClass = 'text-rose-200';
        titleClass = 'text-rose-100 font-extrabold';
        iconColor = 'text-rose-400';
        iconName = 'alert-octagon';
      } else if (alert.severity === 'warning') {
        bgClass = 'bg-amber-950/40 border-amber-500/30';
        textClass = 'text-amber-200';
        titleClass = 'text-amber-100 font-bold';
        iconColor = 'text-amber-400';
        iconName = 'alert-triangle';
      } else if (alert.severity === 'advisory') {
        bgClass = 'bg-slate-900/60 border-slate-700/50';
        textClass = 'text-slate-300';
        titleClass = 'text-slate-200 font-semibold';
        iconColor = 'text-slate-400';
        iconName = 'info';
      }

      bannersHTML += `
        <div class="alert-banner relative mb-4 overflow-hidden rounded-2xl border ${bgClass} p-4 backdrop-blur-md shadow-lg animate-fade-in select-none">
          <div class="flex items-start gap-3.5 pr-8">
            <div class="${iconColor} shrink-0 mt-0.5">
              <i data-lucide="${iconName}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs ${titleClass} uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <span>${escapeHTML(alert.title)}</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-950/40 border border-slate-800 font-semibold select-none lowercase">${escapeHTML(alert.source || 'Analysis')}</span>
              </div>
              <p class="text-xs ${textClass} leading-relaxed font-medium">${escapeHTML(alert.description)}</p>
            </div>
          </div>
          <!-- Close/Dismiss button -->
          <button type="button" class="alert-dismiss-btn absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all focus:outline-none cursor-pointer" title="Dismiss Advisory" aria-label="Dismiss Advisory">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    });

    return bannersHTML;
  }

  // Generate HTML for the weather card
  function generateWeatherCardHTML(info) {
    const cond = info.condition.toLowerCase();
    
    // Choose weather icon based on condition keywords
    let iconName = 'thermometer-sun';
    if (cond.includes('clear') || cond.includes('sun')) {
      iconName = 'sun';
    } else if (cond.includes('storm') || cond.includes('lightning') || cond.includes('thunder')) {
      iconName = 'cloud-lightning';
    } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
      iconName = 'cloud-rain';
    } else if (cond.includes('snow') || cond.includes('ice') || cond.includes('freez')) {
      iconName = 'snowflake';
    } else if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) {
      iconName = 'cloud-fog';
    } else if (cond.includes('wind')) {
      iconName = 'wind';
    } else if (cond.includes('cloud')) {
      iconName = 'cloud';
    }

    // Choose gradient theme based on condition or temperature
    let gradientClasses = 'from-indigo-600 via-indigo-700 to-slate-800'; // Default theme
    
    if (cond.includes('clear') || cond.includes('sun')) {
      gradientClasses = 'from-amber-500 via-orange-500 to-red-500';
    } else if (cond.includes('storm') || cond.includes('lightning') || cond.includes('thunder')) {
      gradientClasses = 'from-purple-800 via-indigo-900 to-slate-900';
    } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
      gradientClasses = 'from-sky-500 via-blue-600 to-indigo-700';
    } else if (cond.includes('snow') || cond.includes('ice') || cond.includes('freez')) {
      gradientClasses = 'from-blue-400 via-indigo-500 to-slate-600';
    } else if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) {
      gradientClasses = 'from-teal-600 via-slate-600 to-slate-700';
    } else if (cond.includes('cloud')) {
      gradientClasses = 'from-slate-600 via-slate-700 to-slate-800';
    }

    // Parse temperature number to decide gradient override if hot or cold
    if (info.temperature) {
      const tempNum = parseFloat(info.temperature);
      if (!isNaN(tempNum)) {
        if (tempNum >= 30) {
          gradientClasses = 'from-amber-500 via-orange-500 to-red-500';
        } else if (tempNum <= 5) {
          gradientClasses = 'from-blue-400 via-indigo-500 to-slate-600';
        }
      }
    }

    return `
      <div class="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br ${gradientClasses} p-5 text-white shadow-xl relative border border-white/10 select-none">
        <!-- Overlay pattern/glassmorphism -->
        <div class="absolute inset-0 bg-slate-950/10 backdrop-blur-[1px]"></div>
        
        <div class="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <!-- Left: Temp, City, Condition -->
          <div class="flex items-center gap-4">
            <div class="text-4.5xl sm:text-5xl font-extrabold tracking-tight drop-shadow-sm temp-display" data-celsius-temp="${info.temperature ? parseFloat(info.temperature) : ''}">${info.temperature ? formatTemp(parseFloat(info.temperature)) : '--'}</div>
            <div>
              <div class="text-lg font-bold flex items-center gap-1.5 drop-shadow-sm">
                <span>${info.city}</span>
                <i data-lucide="map-pin" class="w-3.5 h-3.5 opacity-80"></i>
                <button type="button" class="favorite-toggle-btn ml-1 p-0.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all focus:outline-none cursor-pointer" data-favorite-city="${info.city}" title="Toggle Favorite">
                  <i data-lucide="star" class="w-3.5 h-3.5 ${isFavorite(info.city) ? 'fill-yellow-300 text-yellow-300' : 'text-white'}"></i>
                </button>
              </div>
              <div class="text-xs sm:text-sm font-medium text-white/95 capitalize drop-shadow-sm">${info.condition}</div>
            </div>
          </div>
          
          <!-- Right: Metrics Grid and Large Weather Icon -->
          <div class="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t border-white/10 sm:border-t-0 pt-3 sm:pt-0">
            <!-- Metrics -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/85 shrink-0">
              ${info.humidity ? `
              <div class="flex items-center gap-1.5">
                <i data-lucide="droplet" class="w-4 h-4 text-sky-200"></i>
                <div>
                  <div class="text-[9px] text-white/60 tracking-wider lang-translatable" data-trans-key="card_humidity">${t('card_humidity').toUpperCase()}</div>
                  <div class="font-bold text-white">${info.humidity}</div>
                </div>
              </div>` : ''}
              
              ${info.wind ? `
              <div class="flex items-center gap-1.5">
                <i data-lucide="wind" class="w-4 h-4 text-teal-200"></i>
                <div>
                  <div class="text-[9px] text-white/60 tracking-wider lang-translatable" data-trans-key="card_wind">${t('card_wind').toUpperCase()}</div>
                  <div class="font-bold text-white">${info.wind}</div>
                </div>
              </div>` : ''}
            </div>

            <!-- Icon -->
            <div class="p-3 bg-white/10 rounded-2xl text-white shadow-inner shrink-0">
              <i data-lucide="${iconName}" class="w-10 h-10 drop-shadow-md"></i>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate HTML for 5-day forecast
  function generateForecastHTML(forecastData) {
    if (!forecastData || !forecastData.forecast || !Array.isArray(forecastData.forecast)) {
      return '';
    }

    let cardsHTML = '';
    
    forecastData.forecast.forEach(item => {
      // Format date into a day name (e.g., "Mon", "Tue")
      let dayName = 'Day';
      let dateLabel = '';
      try {
        const dateObj = new Date(item.date);
        dayName = dateObj.toLocaleDateString([], { weekday: 'short' }); // "Mon"
        dateLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }); // "Aug 30"
      } catch (e) {
        dayName = item.date;
      }

      // Format temp number
      const tempVal = item.temperature !== undefined ? Math.round(item.temperature) : '--';
      
      // Weather icon mapping
      const cond = item.weather ? item.weather.toLowerCase() : '';
      let iconName = 'thermometer-sun';
      let iconColor = 'text-amber-400';
      
      if (cond.includes('clear') || cond.includes('sun')) {
        iconName = 'sun';
        iconColor = 'text-yellow-400';
      } else if (cond.includes('storm') || cond.includes('lightning') || cond.includes('thunder')) {
        iconName = 'cloud-lightning';
        iconColor = 'text-purple-400';
      } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
        iconName = 'cloud-rain';
        iconColor = 'text-sky-300';
      } else if (cond.includes('snow') || cond.includes('ice') || cond.includes('freez')) {
        iconName = 'snowflake';
        iconColor = 'text-blue-200';
      } else if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) {
        iconName = 'cloud-fog';
        iconColor = 'text-slate-300';
      } else if (cond.includes('cloud')) {
        iconName = 'cloud';
        iconColor = 'text-slate-400';
      }

      cardsHTML += `
        <div class="flex-1 min-w-[120px] sm:min-w-0 bg-slate-900/80 border border-slate-800/80 p-3 rounded-2xl flex flex-col items-center justify-between text-center gap-1.5 snap-start relative hover:border-slate-700/80 transition-all select-none">
          <span class="text-xs font-bold text-slate-300">${dayName}</span>
          <span class="text-[9px] text-slate-500 font-medium">${dateLabel}</span>
          
          <div class="my-1.5 p-2 bg-slate-950/40 rounded-xl ${iconColor}">
            <i data-lucide="${iconName}" class="w-6 h-6"></i>
          </div>
          
          <span class="text-sm font-extrabold text-white temp-display temp-no-unit" data-celsius-temp="${item.temperature !== undefined ? item.temperature : ''}">${item.temperature !== undefined ? formatTemp(item.temperature, false) : '--'}</span>
          <span class="text-[10px] text-slate-400 truncate max-w-full font-medium capitalize" title="${item.weather}">${item.weather}</span>
          
          ${(item.humidity !== undefined && item.humidity !== null) || (item.wind_speed !== undefined && item.wind_speed !== null) ? `
          <div class="w-full grid grid-cols-2 gap-1 border-t border-slate-800/60 pt-1.5 mt-1 text-[9px] text-slate-500">
            ${item.humidity !== undefined && item.humidity !== null ? `
            <div class="flex flex-col items-center">
              <i data-lucide="droplet" class="w-2.5 h-2.5 text-sky-400/80 mb-0.5"></i>
              <span>${item.humidity}%</span>
            </div>
            ` : '<div></div>'}
            ${item.wind_speed !== undefined && item.wind_speed !== null ? `
            <div class="flex flex-col items-center">
              <i data-lucide="wind" class="w-2.5 h-2.5 text-teal-400/80 mb-0.5"></i>
              <span class="truncate max-w-[45px]">${Math.round(item.wind_speed)}m/s</span>
            </div>
            ` : '<div></div>'}
          </div>
          ` : ''}
        </div>
      `;
    });

    return `
      <div class="mb-4">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
          <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
          <span class="lang-translatable" data-trans-key="card_5day_title">${t('card_5day_title')}</span>
        </h4>
        <div class="flex overflow-x-auto sm:grid sm:grid-cols-5 gap-3 pb-2.5 sm:pb-0 scrollbar-none snap-x snap-mandatory">
          ${cardsHTML}
        </div>
      </div>
    `;
  }

  // Add a message bubble to the chat
  function addMessageBubble(role, content, extraInfo = '', forecastData = null) {
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = 'flex gap-4 items-start animate-fade-in';

    const isUser = role === 'user';
    const isError = role === 'error';

    if (isUser) {
      // User bubble (Right aligned)
      bubbleWrapper.classList.add('justify-end');
      bubbleWrapper.innerHTML = `
        <div class="max-w-[80%] flex flex-col items-end">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] text-slate-500 font-medium">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="text-sm font-semibold text-indigo-400">You</span>
          </div>
          <div class="p-4 rounded-2xl bg-indigo-600 text-white font-medium shadow-md shadow-indigo-900/10">
            <p class="text-sm leading-relaxed">${escapeHTML(content)}</p>
          </div>
        </div>
        <div class="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
          <i data-lucide="user" class="w-4 h-4"></i>
        </div>
      `;
    } else if (isError) {
      // Friendly Error bubble
      bubbleWrapper.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-rose-950 text-rose-500 flex items-center justify-center border border-rose-800/30 shrink-0">
          <i data-lucide="alert-triangle" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 space-y-1.5">
          <div class="p-4 rounded-2xl bg-slate-900/80 border border-rose-900/30 max-w-2xl shadow-sm">
            <p class="text-sm text-slate-300 leading-relaxed">${content}</p>
          </div>
        </div>
      `;
    } else {
      // Assistant bubble (Left aligned)
      // Render content using Markdown-it
      const renderedHTML = md.render(content);
      
      let weatherCardHTML = '';
      if (extraInfo) {
        const weatherInfo = extractWeatherInfo(content, extraInfo);
        // Only generate card if we successfully extracted at least a temperature or condition
        if (weatherInfo.temperature || (weatherInfo.condition && weatherInfo.condition !== 'Unknown')) {
          weatherCardHTML = generateWeatherCardHTML(weatherInfo);
        }
      }

      const forecastCardHTML = generateForecastHTML(forecastData);

      bubbleWrapper.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-weather-500/10 text-weather-500 flex items-center justify-center border border-weather-500/20 shrink-0">
          <i data-lucide="cloud-sun" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 space-y-1.5 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-weather-500">WeatherGPT</span>
            <span class="text-[10px] text-slate-500 font-medium">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <button type="button" class="tts-speak-btn ml-1.5 p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all focus:outline-none cursor-pointer" title="Speak Response" aria-label="Speak Response">
              <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 max-w-2xl shadow-lg prose prose-invert prose-sm max-w-none">
            ${weatherCardHTML}
            ${forecastCardHTML}
            <div class="markdown-content text-slate-300 text-sm leading-relaxed space-y-2.5 ${(weatherCardHTML || forecastCardHTML) ? 'border-t border-slate-800/60 pt-3 mt-3' : ''}">
              ${renderedHTML}
            </div>
          </div>
        </div>
      `;
    }

    messagesList.appendChild(bubbleWrapper);
    updateIcons();
    scrollToBottom();
  }

  // Safe HTML Escaping for User input injection
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- API Fetch Core Logic ---
  async function fetchWeather(city) {
    if (!city || isQuerying) return;
    
    const cityName = city.trim();
    if (!cityName) return;

    // Toggle view: hide welcome screen if visible
    welcomeScreen.classList.add('hidden');

    // 1. Natural Language & Tanglish parsing to resolve the actual city name
    let resolvedCity = cityName;
    const originalQuestion = cityName;
    
    // Check if it's already a resolved location from autocomplete or geocoding selection (which typically contains a comma)
    const isAlreadyResolved = cityName.includes(',');

    if (!isAlreadyResolved) {
      // Show loading UI on the input while we validate the city
      toggleLoading(true);
      
      // 1.a. Try direct geocoding validation on the entire raw input query first
      let cityObj = await validateCityGeocode(cityName);
      
      if (!cityObj) {
        // 1.b. Parse candidate phrases if direct geocoding fails
        const { rawPhrase, cleanPhrase } = extractCandidates(cityName);
        
        // Try geocoding unstripped candidate words first (resolves exact cities like Manila/Kerala cleanly)
        if (rawPhrase) {
          cityObj = await validateCityGeocode(rawPhrase);
        }
        
        // Try geocoding stripped candidate words next (resolves suffix connectors like coimbatoreku)
        if (!cityObj && cleanPhrase && cleanPhrase !== rawPhrase) {
          cityObj = await validateCityGeocode(cleanPhrase);
        }
      }
      
      toggleLoading(false);

      if (cityObj) {
        resolvedCity = cityObj.state 
          ? `${cityObj.name}, ${cityObj.state}, ${cityObj.country}` 
          : `${cityObj.name}, ${cityObj.country}`;
      } else {
        const { rawPhrase } = extractCandidates(cityName);
        resolvedCity = rawPhrase || cityName;
      }
    }

    // 2. Add user message bubble (render original question if natural query, else formatted message)
    const isSimpleCity = !cityName.includes(' ') || isAlreadyResolved;
    let userPromptText = originalQuestion;
    if (isSimpleCity) {
      userPromptText = `What is the current weather forecast for ${resolvedCity}?`;
      if (activeLanguage === 'ta') {
        userPromptText = `${resolvedCity} நகரத்தின் தற்போதைய வானிலை முன்னறிவிப்பு என்ன?`;
      } else if (activeLanguage === 'hi') {
        userPromptText = `${resolvedCity} के लिए वर्तमान मौसम का पूर्वानुमान क्या है?`;
      }
    }
    
    addMessageBubble('user', userPromptText);

    // Show loading skeleton
    toggleLoading(true);

    try {
      let backendQuestion = userPromptText;
      backendQuestion += `\n\n[STRICT LANGUAGE INSTRUCTION]: The default response language MUST be normal English. Do NOT default to Tanglish. Detect the language and style of the user's question above. If the input is clearly English, respond in English. If Tamil, respond in Tamil. If Hindi, respond in Hindi. If Tanglish (Tamil written using English/Latin characters), respond in natural Tanglish.`;
      
      const askUrl = `${BACKEND_BASE_URL}/ask/${encodeURIComponent(resolvedCity)}?language=${activeLanguage}&question=${encodeURIComponent(backendQuestion)}`;
      const forecastUrl = `${BACKEND_BASE_URL}/forecast/${encodeURIComponent(resolvedCity)}`;
      const hourlyUrl = `${BACKEND_BASE_URL}/hourly/${encodeURIComponent(resolvedCity)}`;

      // Fetch endpoints in parallel using Promise.allSettled to handle partial failures gracefully
      const [askResult, forecastResult, hourlyResult] = await Promise.allSettled([
        fetch(askUrl).then(async (res) => {
          let body = null;
          try { body = await res.json(); } catch (e) {}
          if (!res.ok && (!body || !body.answer)) {
            throw new Error(`Ask API returned ${res.status}`);
          }
          return { ok: res.ok, data: body };
        }),
        fetch(forecastUrl).then(async (res) => {
          if (!res.ok) throw new Error(`Forecast API returned ${res.status}`);
          return res.json();
        }),
        fetch(hourlyUrl).then(async (res) => {
          if (!res.ok) throw new Error(`Hourly API returned ${res.status}`);
          return res.json();
        })
      ]);

      let askData = null;
      if (askResult.status === 'fulfilled') {
        askData = askResult.value.data;
      } else {
        console.error('Ask API failed:', askResult.reason);
      }

      let forecastData = null;
      if (forecastResult.status === 'fulfilled') {
        forecastData = forecastResult.value;
      } else {
        console.error('Forecast API failed:', forecastResult.reason);
      }

      let hourlyData = null;
      if (hourlyResult.status === 'fulfilled') {
        hourlyData = hourlyResult.value;
      } else {
        console.error('Hourly API failed:', hourlyResult.reason);
      }

      // If we got a valid JSON containing 'answer', display it (even if HTTP status indicates error)
      if (askData && askData.answer) {
        toggleLoading(false);
        addMessageBubble('assistant', askData.answer, resolvedCity, forecastData, hourlyData, askData.alerts);
        saveToHistory(resolvedCity);
      } else {
        // Fallback: if not valid JSON or missing answer, throw based on HTTP response status
        throw new Error(askResult.reason || "Invalid response format received from backend");
      }

    } catch (error) {
      console.error('Fetch weather details failed:', error);
      toggleLoading(false);
      
      // Display a friendly error bubble
      addMessageBubble(
        'error', 
        `WeatherGPT is temporarily unable to connect to the weather service. Please try again. (${error.stack})`
      );
    }
  }

  // Handle Location Detection
  async function handleLocationSearch() {
    if (isQuerying) return;

    if (!navigator.geolocation) {
      addMessageBubble('error', 'Geolocation is not supported by your browser. Please type your city name manually.');
      return;
    }

    // Hide welcome screen
    welcomeScreen.classList.add('hidden');

    // Show a loading text on input
    isQuerying = true;
    locationBtn.disabled = true;
    sendBtn.disabled = true;
    cityInput.disabled = true;
    cityInput.placeholder = "Detecting your location...";
    
    // Add user message bubble indicating location lookup
    addMessageBubble('user', 'Find the weather forecast for my current location');
    
    // Show typing loader
    loadingIndicator.classList.remove('hidden');
    scrollToBottom();

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          // Fetch reverse geocoding from backend
          const response = await fetch(`${BACKEND_BASE_URL}/geocode/reverse?lat=${lat}&lon=${lon}`);
          
          if (!response.ok) {
            throw new Error(`Reverse geocoding failed with status ${response.status}`);
          }
          
          const data = await response.json();
          if (data.status === 'error' || !data.city) {
            throw new Error(data.message || 'No city matched for coordinates');
          }

          // Clean loading state before calling fetchWeather
          isQuerying = false;
          locationBtn.disabled = false;
          sendBtn.disabled = false;
          cityInput.disabled = false;
          cityInput.placeholder = "Type a city name (e.g. Chennai, Paris, London)...";
          loadingIndicator.classList.add('hidden');
          
          // Remove the dummy user location query bubble so we can place the real one
          const lastMsg = messagesList.lastElementChild;
          if (lastMsg) lastMsg.remove();

          // Trigger weather search for the detected city
          fetchWeather(data.city);

        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          resetLocationSearchUI();
          addMessageBubble('error', 'We successfully detected your coordinates but were unable to match them to a city. Please search for your city manually.');
        }
      },
      (error) => {
        console.error('Geolocation request failed:', error);
        resetLocationSearchUI();
        
        let errorMsg = 'Unable to detect your location. Please type your city name manually.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Please enable location permissions in your browser or type your city name manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is unavailable on your device. Please search for your city manually.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please try again or type your city name manually.';
        }
        
        addMessageBubble('error', errorMsg);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000
      }
    );
  }

  function resetLocationSearchUI() {
    isQuerying = false;
    locationBtn.disabled = false;
    sendBtn.disabled = false;
    cityInput.disabled = false;
    cityInput.placeholder = "Type a city name (e.g. Chennai, Paris, London)...";
    loadingIndicator.classList.add('hidden');
    
    // Remove the dummy location query bubble
    const lastMsg = messagesList.lastElementChild;
    if (lastMsg) lastMsg.remove();
  }

  // --- Autocomplete Suggestions Logic ---

  // Hide autocomplete dropdown list
  function hideAutocompleteDropdown() {
    autocompleteDropdown.classList.add('hidden');
    autocompleteDropdown.innerHTML = '';
  }

  // Fetch suggestions with debounce
  function handleAutocompleteInput(e) {
    const query = e.target.value.trim();
    
    // Clear existing debounce timer
    clearTimeout(autocompleteTimeout);

    if (query.length < 2) {
      hideAutocompleteDropdown();
      return;
    }

    // Set debounce timer of 300ms
    autocompleteTimeout = setTimeout(() => {
      fetchCitySuggestions(query);
    }, 300);
  }

  // API Call to fetch city matches
  async function fetchCitySuggestions(query) {
    if (!query) return;

    // Show dropdown and render a small loading state inside
    autocompleteDropdown.innerHTML = `
      <div class="px-5 py-3.5 text-xs text-slate-500 flex items-center gap-2">
        <div class="flex gap-1 shrink-0">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500 typing-dot"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500 typing-dot"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500 typing-dot"></span>
        </div>
        <span>Searching matching cities...</span>
      </div>
    `;
    autocompleteDropdown.classList.remove('hidden');

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/geocode/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`Autocomplete API failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'error' || !data.results || data.results.length === 0) {
        autocompleteDropdown.innerHTML = `
          <div class="px-5 py-3.5 text-xs text-slate-400 flex items-center gap-2 select-none">
            <i data-lucide="info" class="w-4 h-4 text-slate-500 shrink-0"></i>
            <span>No matching cities found</span>
          </div>
        `;
        updateIcons();
        return;
      }

      // Render suggestions
      renderCitySuggestions(data.results);

    } catch (err) {
      console.error('Autocomplete fetch failed:', err);
      autocompleteDropdown.innerHTML = `
        <div class="px-5 py-3.5 text-xs text-rose-400/90 flex items-center gap-2 select-none">
          <i data-lucide="alert-circle" class="w-4 h-4 text-rose-500 shrink-0"></i>
          <span>Failed to load suggestions</span>
        </div>
      `;
      updateIcons();
    }
  }

  // Render suggestion elements into dropdown
  function renderCitySuggestions(cities) {
    autocompleteDropdown.innerHTML = '';
    
    // Cap at 5 results
    const displayedCities = cities.slice(0, 5);

    displayedCities.forEach(city => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'autocomplete-item flex w-full items-center justify-between px-5 py-3.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-left group border-none outline-none focus:bg-slate-800';
      
      const statePart = city.state ? `${city.state}, ` : '';
      
      btn.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <i data-lucide="map-pin" class="w-4 h-4 text-slate-500 group-hover:text-weather-500 shrink-0 transition-colors"></i>
          <div class="truncate">
            <span class="font-semibold text-slate-200">${escapeHTML(city.name)}</span>
            <span class="text-xs text-slate-400 ml-1.5">${escapeHTML(statePart)}${escapeHTML(city.country)}</span>
          </div>
        </div>
        <i data-lucide="arrow-up-left" class="w-4 h-4 text-slate-600 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"></i>
      `;

      // Select handler
      btn.addEventListener('click', () => {
        const fullCityName = city.state ? `${city.name}, ${city.state}, ${city.country}` : `${city.name}, ${city.country}`;
        cityInput.value = '';
        hideAutocompleteDropdown();
        fetchWeather(fullCityName);
      });

      autocompleteDropdown.appendChild(btn);
    });

    updateIcons();
  }

  // --- Sidebar Mobile Actions ---
  function openMobileSidebar() {
    sidebar.classList.remove('-translate-x-full');
    sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
    sidebarOverlay.classList.add('opacity-100');
  }

  function closeMobileSidebar() {
    sidebar.classList.add('-translate-x-full');
    sidebarOverlay.classList.remove('opacity-100');
    sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
  }

  // --- Event Listeners ---

  // Handle Keystrokes for Autocomplete suggestions
  cityInput.addEventListener('input', handleAutocompleteInput);

  // Keyboard navigation for Autocomplete dropdown
  cityInput.addEventListener('keydown', (e) => {
    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    if (e.key === 'Escape') {
      hideAutocompleteDropdown();
      cityInput.blur();
    } else if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault();
      items[0].focus();
    }
  });

  // Handle keyboard navigation within the dropdown
  autocompleteDropdown.addEventListener('keydown', (e) => {
    const items = Array.from(autocompleteDropdown.querySelectorAll('.autocomplete-item'));
    const currentIndex = items.indexOf(document.activeElement);
    
    if (e.key === 'Escape') {
      hideAutocompleteDropdown();
      cityInput.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex === 0) {
        cityInput.focus();
      } else {
        const nextIndex = (currentIndex - 1 + items.length) % items.length;
        items[nextIndex].focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      document.activeElement.click();
    }
  });

  // Close dropdown on clicking outside the input/form
  document.addEventListener('click', (e) => {
    if (!chatForm.contains(e.target)) {
      hideAutocompleteDropdown();
    }
  });

  // Handle Location Button Click
  locationBtn.addEventListener('click', handleLocationSearch);

  // Handle Scan Sky Button & Modal
  const scanSkyBtn = document.getElementById('scan-sky-btn');
  const cameraModal = document.getElementById('camera-modal');
  const cameraModalContent = document.getElementById('camera-modal-content');
  const closeCameraBtn = document.getElementById('close-camera-btn');
  const cameraVideo = document.getElementById('camera-video');
  const cameraCanvas = document.getElementById('camera-canvas');
  const cameraLoading = document.getElementById('camera-loading');
  const cameraError = document.getElementById('camera-error');
  const cameraErrorMsg = document.getElementById('camera-error-msg');
  const cameraIdle = document.getElementById('camera-idle');
  
  const scanSkyNativeInput = document.getElementById('scan-sky-native-input');
  const scanSkyUploadInput = document.getElementById('scan-sky-upload-input');
  const capturePhotoBtn = document.getElementById('capture-photo-btn');
  const uploadPhotoBtn = document.getElementById('upload-photo-btn');

  let cameraStream = null;

  function closeCameraModal() {
    cameraModal.classList.add('opacity-0');
    cameraModalContent.classList.add('scale-95');
    setTimeout(() => {
      cameraModal.classList.add('hidden');
      stopCamera();
    }, 300);
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    cameraVideo.classList.add('hidden');
    cameraIdle.classList.remove('hidden');
    cameraLoading.classList.add('hidden');
    cameraError.classList.add('hidden');
    capturePhotoBtn.innerHTML = '<i data-lucide="camera" class="w-4 h-4"></i> Take Photo';
    capturePhotoBtn.classList.remove('bg-rose-600', 'hover:bg-rose-500');
    capturePhotoBtn.classList.add('bg-weather-600', 'hover:bg-weather-500');
    if (window.lucide) window.lucide.createIcons();
  }

  scanSkyBtn.addEventListener('click', () => {
    cameraModal.classList.remove('hidden');
    setTimeout(() => {
      cameraModal.classList.remove('opacity-0');
      cameraModalContent.classList.remove('scale-95');
    }, 10);
  });

  closeCameraBtn.addEventListener('click', closeCameraModal);
  
  cameraModal.addEventListener('click', (e) => {
    if (e.target === cameraModal) closeCameraModal();
  });

  uploadPhotoBtn.addEventListener('click', () => {
    scanSkyUploadInput.click();
  });

  capturePhotoBtn.addEventListener('click', async () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // If stream is active, capture photo from video
    if (cameraStream) {
      const context = cameraCanvas.getContext('2d');
      cameraCanvas.width = cameraVideo.videoWidth;
      cameraCanvas.height = cameraVideo.videoHeight;
      context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
      
      cameraCanvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "sky-photo.jpg", { type: "image/jpeg" });
          closeCameraModal();
          processSkyImage(file);
        }
      }, 'image/jpeg', 0.9);
      return;
    }
    
    if (isMobile) {
      scanSkyNativeInput.click();
    } else {
      cameraIdle.classList.add('hidden');
      cameraLoading.classList.remove('hidden');
      cameraError.classList.add('hidden');
      
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' },
          audio: false 
        });
        cameraVideo.srcObject = cameraStream;
        cameraVideo.onloadedmetadata = () => {
          cameraVideo.play();
          cameraLoading.classList.add('hidden');
          cameraVideo.classList.remove('hidden');
          
          capturePhotoBtn.innerHTML = '<i data-lucide="aperture" class="w-4 h-4"></i> Capture!';
          capturePhotoBtn.classList.remove('bg-weather-600', 'hover:bg-weather-500');
          capturePhotoBtn.classList.add('bg-rose-600', 'hover:bg-rose-500');
          if (window.lucide) window.lucide.createIcons();
        };
      } catch (err) {
        cameraLoading.classList.add('hidden');
        cameraError.classList.remove('hidden');
        cameraErrorMsg.textContent = 'Camera permission denied or unavailable.';
        console.warn('Camera error:', err);
      }
    }
  });

  scanSkyNativeInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      closeCameraModal();
      processSkyImage(e.target.files[0]);
    }
    e.target.value = '';
  });
  
  scanSkyUploadInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      closeCameraModal();
      processSkyImage(e.target.files[0]);
    }
    e.target.value = '';
  });

  function processSkyImage(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      
      const userBubble = `
        <div class="flex-1 space-y-1.5 flex flex-col items-end">
          <div class="p-2 rounded-2xl bg-indigo-600 text-white font-medium shadow-md shadow-indigo-900/10">
            <img src="${dataUrl}" class="max-w-[240px] max-h-[240px] object-cover rounded-xl" />
          </div>
        </div>
        <div class="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
          <i data-lucide="user" class="w-4 h-4"></i>
        </div>
      `;
      const bubbleWrapper = document.createElement('div');
      bubbleWrapper.className = 'flex gap-3 justify-end';
      bubbleWrapper.innerHTML = userBubble;
      
      if (!welcomeScreen.classList.contains('hidden')) {
        welcomeScreen.classList.add('hidden');
      }
      chatMessagesContainer.classList.remove('hidden');
      messagesList.appendChild(bubbleWrapper);
      
      if (window.lucide) window.lucide.createIcons();
      messagesList.scrollTop = messagesList.scrollHeight;
      
      toggleLoading(true);
      
      let activeCity = (history && history.length > 0) ? history[0] : null;

      let lat = null, lon = null;
      if (!activeCity && navigator.geolocation) {
        try {
           const pos = await new Promise((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: false });
           });
           lat = pos.coords.latitude;
           lon = pos.coords.longitude;
        } catch(err) {
           console.warn("Could not get location for scan sky");
        }
      }

      if (!activeCity && !lat) {
         toggleLoading(false);
         addMessageBubble('error', 'Location is required to correlate sky conditions with live weather. Please search for a city or enable GPS.');
         return;
      }
  
      const formData = new FormData();
      formData.append('image', file);
      if (activeCity) formData.append('city', activeCity);
      if (lat) formData.append('lat', lat);
      if (lon) formData.append('lon', lon);
      formData.append('language', activeLanguage);

      try {
        const response = await fetch(`${BACKEND_BASE_URL}/analyze-sky`, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error("API failed");
        const json = await response.json();
        
        if (json.status === 'success') {
          const { sky_analysis, live_correlation, insight } = json.data;
          
          const assistantBubble = `
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-weather-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-weather-500/20 shrink-0">
              <i data-lucide="camera" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 space-y-2 max-w-[85%]">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-semibold text-white">Weather Vision</span>
                <span class="text-[10px] text-slate-500 font-medium bg-slate-800 px-2 py-0.5 rounded-full">Sky Analysis</span>
              </div>
              <div class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 md:p-5 shadow-xl backdrop-blur-sm space-y-4">
                <div>
                  <h4 class="text-xs text-weather-400 font-semibold uppercase tracking-wider mb-1">Visual Sky Analysis</h4>
                  <p class="text-sm text-slate-300 leading-relaxed">${escapeHTML(sky_analysis)}</p>
                </div>
                <div class="h-px bg-slate-800"></div>
                <div>
                  <h4 class="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Live Weather Correlation</h4>
                  <p class="text-sm text-slate-300 leading-relaxed">${escapeHTML(live_correlation)}</p>
                </div>
                <div class="h-px bg-slate-800"></div>
                <div class="bg-indigo-900/20 border border-indigo-500/20 p-3 rounded-xl">
                  <h4 class="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-1">WeatherGPT Insight</h4>
                  <p class="text-sm text-indigo-200 font-medium">${escapeHTML(insight)}</p>
                </div>
              </div>
            </div>
          `;
          const asstWrapper = document.createElement('div');
          asstWrapper.className = 'flex gap-3 relative group fade-in';
          asstWrapper.innerHTML = assistantBubble;
          messagesList.appendChild(asstWrapper);
          if (window.lucide) window.lucide.createIcons();
          messagesList.scrollTop = messagesList.scrollHeight;

        } else {
          addMessageBubble('error', json.message || 'Failed to analyze sky image. Please try again.');
        }
      } catch (err) {
        addMessageBubble('error', 'WeatherGPT is temporarily unable to connect to the weather service. Please try again.');
      } finally {
        toggleLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // Handle Chat Input Form Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = cityInput.value;
    if (city.trim()) {
      hideAutocompleteDropdown();
      fetchWeather(city);
      cityInput.value = '';
    }
  });

  // Handle Preset City buttons in sidebar
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const city = e.currentTarget.getAttribute('data-city');
      closeMobileSidebar();
      fetchWeather(city);
    });
  });

  // Handle Suggestion Cards on Welcome Page
  document.querySelectorAll('.welcome-suggest-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const city = e.currentTarget.getAttribute('data-city');
      fetchWeather(city);
    });
  });

  // Clear search history
  clearHistoryBtn.addEventListener('click', clearHistory);

  // New Chat action
  newChatBtn.addEventListener('click', startNewChat);

  // Unit toggle actions
  unitCBtn.addEventListener('click', () => {
    if (activeUnit === 'C') return;
    activeUnit = 'C';
    localStorage.setItem('weather_gpt_unit', 'C');
    updateUnitToggleUI();
    convertDisplayTemperatures();
  });

  unitFBtn.addEventListener('click', () => {
    if (activeUnit === 'F') return;
    activeUnit = 'F';
    localStorage.setItem('weather_gpt_unit', 'F');
    updateUnitToggleUI();
    convertDisplayTemperatures();
  });

  // Language selector action
  langSelect.addEventListener('change', (e) => {
    activeLanguage = e.target.value;
    localStorage.setItem('weather_gpt_lang', activeLanguage);
    updateUILanguage();
  });

  // Microphone toggle action
  micBtn.addEventListener('click', toggleVoiceInput);

  // Mobile drawer controls
  toggleSidebarBtn.addEventListener('click', openMobileSidebar);
  closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Delegate clicks for buttons inside the chat message bubbles (retry actions, favorites toggle, TTS)
  messagesList.addEventListener('click', (e) => {
    // 1. Retry Button
    const retryBtn = e.target.closest('.retry-btn');
    if (retryBtn) {
      const retryCity = retryBtn.getAttribute('data-retry-city');
      if (retryCity) {
        const errorBubble = retryBtn.closest('.flex');
        if (errorBubble) {
          errorBubble.remove();
        }
        fetchWeather(retryCity);
      }
      return;
    }

    // 2. Favorite Toggle Button
    const favBtn = e.target.closest('.favorite-toggle-btn');
    if (favBtn) {
      const city = favBtn.getAttribute('data-favorite-city');
      toggleFavorite(city);
      return;
    }

    // 3. Text-to-Speech Speaker Button
    const ttsBtn = e.target.closest('.tts-speak-btn');
    if (ttsBtn) {
      const bubble = ttsBtn.closest('.flex-1');
      const mdContent = bubble ? bubble.querySelector('.markdown-content') : null;
      if (mdContent) {
        speakText(mdContent.innerHTML, ttsBtn);
      }
      return;
    }

    // 4. Alert Banner Dismiss Button
    const dismissBtn = e.target.closest('.alert-dismiss-btn');
    if (dismissBtn) {
      const banner = dismissBtn.closest('.alert-banner');
      if (banner) {
        banner.classList.add('opacity-0', 'transition-all', 'duration-300');
        setTimeout(() => {
          banner.remove();
        }, 300);
      }
      return;
    }
  });

  // --- App Startup Operations ---
  checkBackendStatus();
  renderHistory();
  renderFavorites();
  updateUnitToggleUI();
  updateUILanguage();
  updateIcons();
  
  // Periodically ping backend to check connectivity status
  setInterval(checkBackendStatus, 15000);
});
