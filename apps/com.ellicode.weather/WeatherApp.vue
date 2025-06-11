<script setup lang="ts">
import { Building2, Navigation, Search, Star } from "lucide-vue-next";
import { ref } from "vue";
import {
    BlankSlate,
    SearchBar,
    Button,
    ListItem,
    getLocation,
    SplitView,
} from "../../kit/sdk";
import {
    Cloud,
    CloudRain,
    CloudSnow,
    CloudFog,
    CloudLightning,
    Sun,
    CloudSun,
    Wind,
    CloudDrizzle,
} from "lucide-vue-next";

const getWeatherIcon = (code) => {
    // WMO Weather codes: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
    if (code <= 3) return CloudSun; // Clear to partly cloudy
    if (code <= 9) return Cloud; // Cloudy conditions
    if (code <= 19) return CloudFog; // Fog
    if (code <= 29) return CloudDrizzle; // Drizzle
    if (code <= 39) return CloudRain; // Rain
    if (code <= 49) return CloudSnow; // Snow
    if (code <= 59) return CloudDrizzle; // Drizzle
    if (code <= 69) return CloudRain; // Rain
    if (code <= 79) return CloudSnow; // Snow
    if (code <= 99) return CloudLightning; // Thunderstorm
    return Sun;
};

const getWeatherDescription = (code) => {
    if (code <= 3) return "Partly Cloudy";
    if (code <= 9) return "Cloudy";
    if (code <= 19) return "Foggy";
    if (code <= 29) return "Drizzle";
    if (code <= 39) return "Rain";
    if (code <= 49) return "Snow";
    if (code <= 59) return "Drizzle";
    if (code <= 69) return "Rain";
    if (code <= 79) return "Snow";
    if (code <= 99) return "Thunderstorm";
    return "Clear";
};

const formatDay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { weekday: "short" });
};

interface City {
    name: string;
    latitude: number;
    longitude: number;
}

interface WeatherData {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    current_units: {
        time: string;
        interval: string;
        temperature_2m: string;
        precipitation: string;
        apparent_temperature: string;
        weather_code: string;
    };
    current: {
        time: string;
        interval: number;
        temperature_2m: number;
        precipitation: number;
        apparent_temperature: number;
        weather_code: number;
    };
    daily_units: {
        time: string;
        weather_code: string;
        temperature_2m_max: string;
        temperature_2m_min: string;
        precipitation_probability_max: string;
    };
    daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
    };
}

const location = ref("");

const weatherData = ref<WeatherData | null>(null);
const cities = ref<City[]>([]);

const search = async () => {
    if (location.value) {
        const geocoding = await fetch(
            `http://geocoding-api.open-meteo.com/v1/search?name=${encodeURI(
                location.value
            )}&count=10&language=en&format=json`
        );
        const data = await geocoding.json();
        console.log(data);
        cities.value = data.results.map((city) => {
            return {
                name: city.name,
                latitude: city.latitude,
                longitude: city.longitude,
            };
        });
    } else {
        cities.value = [];
    }
};

const selectedCity = ref<City | null>(null);

const selectCity = (city: City) => {
    weatherData.value = null;
    selectedCity.value = city;

    fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=temperature_2m,precipitation,apparent_temperature,weather_code&timezone=auto`
    )
        .then((response) => response.json())
        .then((data) => {
            weatherData.value = data;
            console.log(data);
        })
        .catch((error) => {
            alert("Error fetching weather data:" + error);
        });
};

const askLocation = async () => {
    const response = await getLocation(
        "com.ellicode.weather",
        "Weather",
        "We need your location to show the weather forecast."
    );
    if (response) {
        console.log(response);

        fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${response.latitude}&longitude=${response.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=temperature_2m,precipitation,apparent_temperature,weather_code&timezone=auto`
        )
            .then((response) => response.json())
            .then((data) => {
                weatherData.value = data;
                console.log(data);
            })
            .catch((error) => {
                alert("Error fetching weather data:" + error);
            });
    }
};
</script>

<template>
    <SearchBar
        v-model="location"
        @enter="search"
        placeholder="Type a location"
    />
    <SplitView>
        <template #leading>
            <ListItem
                @click="askLocation"
                v-if="!cities.length"
                title="Current location"
            >
                <template #icon>
                    <Navigation class="w-5 h-5 text-sky-500" />
                </template>
            </ListItem>
            <ListItem
                v-for="(city, index) in cities"
                :key="index"
                :title="city.name"
                :description="`${city.latitude}, ${city.longitude}`"
                @click="selectCity(city)"
            >
                <template #icon>
                    <Building2 class="w-5 h-5 text-neutral-500" />
                </template>
            </ListItem>
        </template>
        <template #trailing>
            <div v-if="weatherData" class="p-5 overflow-auto pb-20">
                <div class="flex gap-5 mb-2">
                    <component
                        :is="getWeatherIcon(weatherData?.current.weather_code)"
                        class="w-8 h-8 text-sky-500"
                    />
                    <h2 class="text-2xl font-medium">
                        {{
                            selectedCity
                                ? selectedCity.name
                                : "Current Location"
                        }}
                    </h2>
                    <div class="flex-1"></div>
                    <div class="text-2xl font-medium">
                        {{ weatherData?.current.temperature_2m }}°C
                    </div>
                </div>
                <div class="text-neutral-500 text-sm mb-2">
                    {{
                        getWeatherDescription(weatherData?.current.weather_code)
                    }}
                </div>
                <div class="mt-6">
                    <h3 class="text-lg font-medium mb-3">7-Day Forecast</h3>
                    <div class="space-y-3">
                        <div
                            v-for="(day, index) in weatherData.daily.time"
                            :key="index"
                            class="flex items-center"
                        >
                            <div class="w-12 font-medium">
                                {{ formatDay(day) }}
                            </div>
                            <div class="flex-1">
                                <component
                                    :is="
                                        getWeatherIcon(
                                            weatherData.daily.weather_code[
                                                index
                                            ]
                                        )
                                    "
                                    class="w-5 h-5 text-sky-500"
                                />
                            </div>
                            <div class="text-neutral-400 text-sm">
                                {{
                                    getWeatherDescription(
                                        weatherData.daily.weather_code[index]
                                    )
                                }}
                            </div>
                            <div class="w-24 text-right">
                                <span class="text-sm text-neutral-400">
                                    {{
                                        Math.round(
                                            weatherData.daily
                                                .temperature_2m_min[index]
                                        )
                                    }}° /
                                </span>
                                <span class="text-sm font-medium">
                                    {{
                                        Math.round(
                                            weatherData.daily
                                                .temperature_2m_max[index]
                                        )
                                    }}°
                                </span>
                            </div>
                            <div class="w-14 text-right">
                                <span
                                    v-if="
                                        weatherData.daily
                                            .precipitation_probability_max[
                                            index
                                        ] > 0
                                    "
                                    class="text-sm text-sky-400"
                                >
                                    {{
                                        weatherData.daily
                                            .precipitation_probability_max[
                                            index
                                        ]
                                    }}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <BlankSlate
                v-else
                title="No location selected"
                description="Please select a location to see the weather forecast."
            >
                <template #icon>
                    <Search class="w-8 h-8 text-neutral-500" />
                </template>
                <Button accentColor="sky" type="accent" @click="askLocation">
                    <template #icon>
                        <Navigation fill="currentColor" class="w-4 h-4" />
                    </template>
                    Use current location
                </Button>
            </BlankSlate>
        </template>
    </SplitView>
</template>

<style>
/* Add your styles here */
</style>
