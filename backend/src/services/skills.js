// ─────────────────────────────────────────────────────
// MCP Skills — External tool integrations for Luna
//
// Skills are capabilities that Luna can invoke via
// [ACTION:skill_name ...] tags. They extend her beyond
// calendar/email into web search, weather, news, etc.
//
// Each skill:
//   1. Receives parsed params from action-executor
//   2. Calls an external API
//   3. Returns a human-readable result string
//
// Skills are lightweight — no database state, no auth.
// ─────────────────────────────────────────────────────

import env from '../config/env.js';

// ─── Web Search (via Brave Search API or DuckDuckGo) ──

/**
 * Search the web and return top results.
 * Uses DuckDuckGo Instant Answer API (no key required).
 */
export async function webSearch(query, maxResults = 3) {
  if (!query) return { success: false, result: '(No search query provided)' };

  try {
    // DuckDuckGo Instant Answer API (free, no key)
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    const results = [];

    // Abstract (direct answer)
    if (data.Abstract) {
      results.push(`${data.Abstract}`);
    }

    // Answer (instant answer like calculations)
    if (data.Answer) {
      results.push(`${data.Answer}`);
    }

    // Related topics
    if (data.RelatedTopics && results.length === 0) {
      const topics = data.RelatedTopics.slice(0, maxResults);
      for (const topic of topics) {
        if (topic.Text) {
          results.push(`• ${topic.Text}`);
        }
      }
    }

    if (results.length === 0) {
      return {
        success: true,
        result: `I searched for "${query}" but didn't find a quick answer. You could try searching directly on Google for more detailed results.`,
      };
    }

    return { success: true, result: results.join('\n\n') };
  } catch (err) {
    console.error(`[SKILL] Web search error: ${err.message}`);
    return { success: false, result: '(Web search temporarily unavailable)' };
  }
}

// ─── Weather ──

/**
 * Get current weather for a location.
 * Uses Open-Meteo API (free, no key required).
 */
export async function getWeather(location) {
  if (!location) return { success: false, result: '(No location provided)' };

  try {
    // Step 1: Geocode the location
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return { success: false, result: `(Couldn't find location: ${location})` };
    }

    const { latitude, longitude, name, admin1, country } = geoData.results[0];

    // Step 2: Get weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(5000) });
    const weather = await weatherRes.json();

    const current = weather.current;
    const locationName = admin1 ? `${name}, ${admin1}` : `${name}, ${country}`;

    const weatherCodes = {
      0: '☀️ Clear',
      1: '🌤️ Mostly clear',
      2: '⛅ Partly cloudy',
      3: '☁️ Overcast',
      45: '🌫️ Foggy',
      48: '🌫️ Foggy',
      51: '🌦️ Light drizzle',
      53: '🌧️ Drizzle',
      55: '🌧️ Heavy drizzle',
      61: '🌧️ Light rain',
      63: '🌧️ Rain',
      65: '🌧️ Heavy rain',
      71: '🌨️ Light snow',
      73: '🌨️ Snow',
      75: '🌨️ Heavy snow',
      80: '🌦️ Rain showers',
      81: '🌧️ Rain showers',
      82: '⛈️ Heavy showers',
      95: '⛈️ Thunderstorm',
      96: '⛈️ Thunderstorm with hail',
      99: '⛈️ Severe thunderstorm',
    };

    const condition = weatherCodes[current.weather_code] || '🌡️ Unknown';

    return {
      success: true,
      result: `${locationName}\n${condition}\n🌡️ ${Math.round(current.temperature_2m)}°F (feels like ${Math.round(current.apparent_temperature)}°F)\n💨 Wind: ${Math.round(current.wind_speed_10m)} mph\n💧 Humidity: ${current.relative_humidity_2m}%`,
    };
  } catch (err) {
    console.error(`[SKILL] Weather error: ${err.message}`);
    return { success: false, result: '(Weather service temporarily unavailable)' };
  }
}

// ─── News ──

/**
 * Get top news headlines.
 * Uses WikiMedia API (free, no key) for current events.
 */
export async function getNews(topic, maxResults = 5) {
  try {
    // Use DuckDuckGo news-like search
    const query = topic ? `${topic} news` : 'top news today';
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    const results = [];

    if (data.Abstract) {
      results.push(data.Abstract);
    }

    if (data.RelatedTopics) {
      const topics = data.RelatedTopics.slice(0, maxResults);
      for (const t of topics) {
        if (t.Text) {
          results.push(`• ${t.Text}`);
        }
      }
    }

    if (results.length === 0) {
      return {
        success: true,
        result: topic
          ? `I couldn't find specific news about "${topic}" right now. Try asking me something more specific or check a news site directly.`
          : "I couldn't pull the latest headlines right now. Try again in a moment.",
      };
    }

    const header = topic ? `News about "${topic}":` : 'Here\'s what I found:';
    return { success: true, result: `${header}\n\n${results.join('\n\n')}` };
  } catch (err) {
    console.error(`[SKILL] News error: ${err.message}`);
    return { success: false, result: '(News service temporarily unavailable)' };
  }
}

// ─── Quick Math / Unit Conversion ──

/**
 * Evaluate a simple math expression or unit conversion.
 */
export async function calculate(expression) {
  if (!expression) return { success: false, result: '(No expression provided)' };

  try {
    // Use DuckDuckGo calculator
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(expression)}&format=json&no_html=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    if (data.Answer) {
      return { success: true, result: data.Answer };
    }

    if (data.Abstract) {
      return { success: true, result: data.Abstract };
    }

    return { success: false, result: '(Could not calculate that)' };
  } catch (err) {
    console.error(`[SKILL] Calculate error: ${err.message}`);
    return { success: false, result: '(Calculator temporarily unavailable)' };
  }
}
