import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { InferenceClient } from '@huggingface/inference'
import { z } from 'zod'

// Hugging Face Inference Client
const hfClient = new InferenceClient(process.env.HF_TOKEN)

// Create server instance
const server = new McpServer({
    name: 'YOUR_SERVER_NAME',
    version: '1.0.0'
})

server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('인사말')
                    })
                )
                .describe('인사말')
        })
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: greeting
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'calculator',
    {
        description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
        inputSchema: z.object({
            num1: z.number().describe('첫 번째 숫자'),
            num2: z.number().describe('두 번째 숫자'),
            operator: z
                .enum(['+', '-', '*', '/'])
                .describe('연산자 (+, -, *, /)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('계산 결과')
                    })
                )
                .describe('계산 결과')
        })
    },
    async ({ num1, num2, operator }) => {
        let result: number
        let resultText: string

        try {
            switch (operator) {
                case '+':
                    result = num1 + num2
                    break
                case '-':
                    result = num1 - num2
                    break
                case '*':
                    result = num1 * num2
                    break
                case '/':
                    if (num2 === 0) {
                        throw new Error('0으로 나눌 수 없습니다.')
                    }
                    result = num1 / num2
                    break
            }

            resultText = `${num1} ${operator} ${num2} = ${result}`
        } catch (error) {
            resultText = `오류: ${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}`
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: resultText
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ]
            }
        }
    }
)

// 지역 이름을 IANA timezone으로 매핑하는 함수
function getTimezoneByLocation(location: string): string | null {
    const locationMap: Record<string, string> = {
        // 한국
        seoul: 'Asia/Seoul',
        서울: 'Asia/Seoul',
        korea: 'Asia/Seoul',
        한국: 'Asia/Seoul',
        // 미국
        'new york': 'America/New_York',
        뉴욕: 'America/New_York',
        'los angeles': 'America/Los_Angeles',
        로스앤젤레스: 'America/Los_Angeles',
        chicago: 'America/Chicago',
        시카고: 'America/Chicago',
        'san francisco': 'America/Los_Angeles',
        샌프란시스코: 'America/Los_Angeles',
        // 일본
        tokyo: 'Asia/Tokyo',
        도쿄: 'Asia/Tokyo',
        // 중국
        beijing: 'Asia/Shanghai',
        베이징: 'Asia/Shanghai',
        shanghai: 'Asia/Shanghai',
        상하이: 'Asia/Shanghai',
        // 유럽
        london: 'Europe/London',
        런던: 'Europe/London',
        paris: 'Europe/Paris',
        파리: 'Europe/Paris',
        berlin: 'Europe/Berlin',
        베를린: 'Europe/Berlin',
        moscow: 'Europe/Moscow',
        모스크바: 'Europe/Moscow',
        // 기타
        sydney: 'Australia/Sydney',
        시드니: 'Australia/Sydney',
        dubai: 'Asia/Dubai',
        두바이: 'Asia/Dubai',
        singapore: 'Asia/Singapore',
        싱가포르: 'Asia/Singapore',
        hongkong: 'Asia/Hong_Kong',
        홍콩: 'Asia/Hong_Kong',
        mumbai: 'Asia/Kolkata',
        뭄바이: 'Asia/Kolkata',
        'sao paulo': 'America/Sao_Paulo',
        상파울루: 'America/Sao_Paulo'
    }

    const normalizedLocation = location.toLowerCase().trim()
    return locationMap[normalizedLocation] || null
}

server.registerTool(
    'timezone',
    {
        description: '지역 위치를 입력하면 해당 지역의 시간대 정보와 현재 시간을 반환합니다.',
        inputSchema: z.object({
            location: z
                .string()
                .describe('지역 이름 (예: Seoul, New York, Tokyo, 서울, 뉴욕 등)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('시간대 정보')
                    })
                )
                .describe('시간대 정보')
        })
    },
    async ({ location }) => {
        try {
            // 지역 이름으로 timezone 찾기
            let timezone = getTimezoneByLocation(location)

            // 매핑되지 않은 경우, 입력값을 그대로 timezone으로 시도
            if (!timezone) {
                // IANA timezone 형식인지 확인 (예: Asia/Seoul, America/New_York)
                if (location.includes('/')) {
                    timezone = location
                } else {
                    // 일반적인 도시 이름인 경우, 첫 글자를 대문자로 변환하여 시도
                    const capitalized = location
                        .split(' ')
                        .map(
                            (word) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase()
                        )
                        .join(' ')
                    timezone = getTimezoneByLocation(capitalized)
                }
            }

            if (!timezone) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `죄송합니다. "${location}" 지역의 시간대 정보를 찾을 수 없습니다.\n\n지원하는 지역: Seoul, New York, Tokyo, London, Paris, Berlin, Sydney, Dubai, Singapore, Hong Kong 등\n또는 IANA timezone 형식으로 입력해주세요 (예: Asia/Seoul, America/New_York)`
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: `죄송합니다. "${location}" 지역의 시간대 정보를 찾을 수 없습니다.`
                            }
                        ]
                    }
                }
            }

            // 현재 시간 가져오기
            const now = new Date()
            const formatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: timezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            })

            const timeString = formatter.format(now)

            // UTC 오프셋 계산
            const utcFormatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: timezone,
                timeZoneName: 'longOffset'
            })
            const parts = utcFormatter.formatToParts(now)
            const offsetPart = parts.find((part) => part.type === 'timeZoneName')
            const offset = offsetPart ? offsetPart.value : ''

            const resultText = `📍 지역: ${location}\n🕐 시간대: ${timezone}\n⏰ 현재 시간: ${timeString}\n${offset ? `🌍 UTC 오프셋: ${offset}` : ''}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = `오류: ${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

server.registerTool(
    'geocode',
    {
        description: '도시 이름이나 주소를 입력받아서 위도와 경도 좌표를 반환합니다.',
        inputSchema: z.object({
            address: z
                .string()
                .describe('도시 이름이나 주소 (예: 서울, Seoul, New York, 1600 Amphitheatre Parkway, Mountain View 등)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('위도와 경도 좌표 정보')
                    })
                )
                .describe('위도와 경도 좌표 정보')
        })
    },
    async ({ address }) => {
        try {
            // Nominatim API 엔드포인트
            const apiUrl = 'https://nominatim.openstreetmap.org/search'
            const params = new URLSearchParams({
                q: address,
                format: 'json',
                limit: '1',
                addressdetails: '1'
            })

            // User-Agent 헤더는 Nominatim 사용 정책에 따라 필수입니다
            const response = await fetch(`${apiUrl}?${params.toString()}`, {
                headers: {
                    'User-Agent': 'MCP-Geocode-Tool/1.0'
                }
            })

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

            if (!Array.isArray(data) || data.length === 0) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `죄송합니다. "${address}"에 대한 위치 정보를 찾을 수 없습니다.\n\n다른 검색어로 시도해보세요.`
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: `"${address}"에 대한 위치 정보를 찾을 수 없습니다.`
                            }
                        ]
                    }
                }
            }

            const result = data[0]
            const lat = parseFloat(result.lat)
            const lon = parseFloat(result.lon)
            const displayName = result.display_name || address

            const resultText = `📍 주소: ${displayName}\n🌐 위도: ${lat}\n🌐 경도: ${lon}\n\n좌표: ${lat}, ${lon}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = `오류: ${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// 날씨 코드를 한글로 변환하는 함수
function getWeatherDescription(code: number): string {
    const weatherMap: Record<number, string> = {
        0: '맑음',
        1: '대체로 맑음',
        2: '부분적으로 흐림',
        3: '흐림',
        45: '안개',
        48: '서리 안개',
        51: '약한 이슬비',
        53: '보통 이슬비',
        55: '강한 이슬비',
        56: '약한 동결 이슬비',
        57: '강한 동결 이슬비',
        61: '약한 비',
        63: '보통 비',
        65: '강한 비',
        66: '약한 동결 비',
        67: '강한 동결 비',
        71: '약한 눈',
        73: '보통 눈',
        75: '강한 눈',
        77: '눈알',
        80: '약한 소나기',
        81: '보통 소나기',
        82: '강한 소나기',
        85: '약한 눈 소나기',
        86: '강한 눈 소나기',
        95: '뇌우',
        96: '우박과 함께하는 뇌우',
        99: '강한 우박과 함께하는 뇌우'
    }
    return weatherMap[code] || `날씨 코드: ${code}`
}

server.registerTool(
    'get-weather',
    {
        description: '위도와 경도 좌표, 예보 기간을 입력받아서 해당 위치의 현재 날씨와 예보 정보를 제공합니다.',
        inputSchema: z.object({
            latitude: z
                .number()
                .min(-90)
                .max(90)
                .describe('위도 좌표 (-90 ~ 90)'),
            longitude: z
                .number()
                .min(-180)
                .max(180)
                .describe('경도 좌표 (-180 ~ 180)'),
            forecast_days: z
                .number()
                .int()
                .min(1)
                .max(16)
                .optional()
                .default(7)
                .describe('예보 기간 (일) - 기본값: 7일, 최대: 16일')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('날씨 정보')
                    })
                )
                .describe('날씨 정보')
        })
    },
    async ({ latitude, longitude, forecast_days = 7 }) => {
        try {
            // Open-Meteo Weather API 엔드포인트
            const apiUrl = 'https://api.open-meteo.com/v1/forecast'
            const params = new URLSearchParams({
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                forecast_days: forecast_days.toString(),
                hourly: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
                daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
                timezone: 'auto'
            })

            const response = await fetch(`${apiUrl}?${params.toString()}`)

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

            if (data.error) {
                throw new Error(data.reason || '알 수 없는 오류가 발생했습니다.')
            }

            // 현재 날씨 정보 (첫 번째 시간대 데이터)
            const currentHourly = data.hourly
            const currentTime = currentHourly.time[0]
            const currentTemp = currentHourly.temperature_2m[0]
            const currentHumidity = currentHourly.relative_humidity_2m[0]
            const currentPrecipitation = currentHourly.precipitation[0]
            const currentWeatherCode = currentHourly.weather_code[0]
            const currentWindSpeed = currentHourly.wind_speed_10m[0]

            // 일일 예보 정보
            const daily = data.daily
            const dailyForecasts: string[] = []

            for (let i = 0; i < Math.min(forecast_days, daily.time.length); i++) {
                const date = daily.time[i]
                const maxTemp = daily.temperature_2m_max[i]
                const minTemp = daily.temperature_2m_min[i]
                const precipitation = daily.precipitation_sum[i]
                const weatherCode = daily.weather_code[i]

                dailyForecasts.push(
                    `📅 ${date}\n` +
                    `   최고: ${maxTemp}°C / 최저: ${minTemp}°C\n` +
                    `   날씨: ${getWeatherDescription(weatherCode)}\n` +
                    `   강수량: ${precipitation}mm`
                )
            }

            const resultText =
                `🌤️ 현재 날씨 (${currentTime})\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🌡️ 온도: ${currentTemp}°C\n` +
                `💧 습도: ${currentHumidity}%\n` +
                `🌧️ 강수량: ${currentPrecipitation}mm\n` +
                `🌬️ 풍속: ${currentWindSpeed}km/h\n` +
                `☁️ 날씨: ${getWeatherDescription(currentWeatherCode)}\n\n` +
                `📊 ${forecast_days}일 예보\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                dailyForecasts.join('\n\n') +
                `\n\n📍 위치: 위도 ${latitude}, 경도 ${longitude}\n` +
                `🌍 시간대: ${data.timezone}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = `오류: ${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// 서버 정보 리소스 등록
server.registerResource(
    'server-info',
    'server://info',
    {
        description: '현재 서버 정보와 사용 가능한 도구 목록',
        mimeType: 'application/json'
    },
    async (uri: URL, extra) => {
        const serverInfo = {
            server: {
                name: 'YOUR_SERVER_NAME',
                version: '1.0.0'
            },
            tools: [
                {
                    name: 'greet',
                    description: '이름과 언어를 입력하면 인사말을 반환합니다.',
                    parameters: {
                        name: {
                            type: 'string',
                            description: '인사할 사람의 이름'
                        },
                        language: {
                            type: 'string',
                            enum: ['ko', 'en'],
                            optional: true,
                            default: 'en',
                            description: '인사 언어 (기본값: en)'
                        }
                    }
                },
                {
                    name: 'calculator',
                    description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
                    parameters: {
                        num1: {
                            type: 'number',
                            description: '첫 번째 숫자'
                        },
                        num2: {
                            type: 'number',
                            description: '두 번째 숫자'
                        },
                        operator: {
                            type: 'string',
                            enum: ['+', '-', '*', '/'],
                            description: '연산자 (+, -, *, /)'
                        }
                    }
                },
                {
                    name: 'timezone',
                    description: '지역 위치를 입력하면 해당 지역의 시간대 정보와 현재 시간을 반환합니다.',
                    parameters: {
                        location: {
                            type: 'string',
                            description: '지역 이름 (예: Seoul, New York, Tokyo, 서울, 뉴욕 등)'
                        }
                    }
                },
                {
                    name: 'geocode',
                    description: '도시 이름이나 주소를 입력받아서 위도와 경도 좌표를 반환합니다.',
                    parameters: {
                        address: {
                            type: 'string',
                            description: '도시 이름이나 주소 (예: 서울, Seoul, New York, 1600 Amphitheatre Parkway, Mountain View 등)'
                        }
                    }
                },
                {
                    name: 'get-weather',
                    description: '위도와 경도 좌표, 예보 기간을 입력받아서 해당 위치의 현재 날씨와 예보 정보를 제공합니다.',
                    parameters: {
                        latitude: {
                            type: 'number',
                            min: -90,
                            max: 90,
                            description: '위도 좌표 (-90 ~ 90)'
                        },
                        longitude: {
                            type: 'number',
                            min: -180,
                            max: 180,
                            description: '경도 좌표 (-180 ~ 180)'
                        },
                        forecast_days: {
                            type: 'number',
                            integer: true,
                            min: 1,
                            max: 16,
                            optional: true,
                            default: 7,
                            description: '예보 기간 (일) - 기본값: 7일, 최대: 16일'
                        }
                    }
                },
                {
                    name: 'generate-image',
                    description: '텍스트 프롬프트를 입력받아 AI 이미지를 생성합니다. Hugging Face의 FLUX.1-schnell 모델을 사용합니다.',
                    parameters: {
                        prompt: {
                            type: 'string',
                            description: '생성할 이미지에 대한 텍스트 설명 (영어 권장)'
                        }
                    }
                }
            ],
            timestamp: new Date().toISOString()
        }

        return {
            contents: [
                {
                    uri: uri.toString(),
                    mimeType: 'application/json',
                    text: JSON.stringify(serverInfo, null, 2)
                }
            ]
        }
    }
)

// 코드 리뷰 프롬프트 템플릿
const CODE_REVIEW_PROMPT_TEMPLATE = `다음 코드를 리뷰해주세요. 다음 항목들을 중점적으로 확인해주세요:

## 리뷰 체크리스트

### 1. 코드 품질
- [ ] 코드 가독성과 명확성
- [ ] 네이밍 컨벤션 준수
- [ ] 코드 중복 여부
- [ ] 적절한 주석 및 문서화

### 2. 기능성
- [ ] 요구사항 충족 여부
- [ ] 엣지 케이스 처리
- [ ] 에러 핸들링
- [ ] 로직의 정확성

### 3. 성능
- [ ] 알고리즘 효율성
- [ ] 불필요한 연산 제거
- [ ] 메모리 사용 최적화

### 4. 보안
- [ ] 입력 검증
- [ ] 보안 취약점
- [ ] 민감 정보 처리

### 5. 유지보수성
- [ ] 모듈화 및 재사용성
- [ ] 테스트 가능성
- [ ] 확장 가능성

## 리뷰할 코드

\`\`\`
{code}
\`\`\`

위 코드에 대한 상세한 리뷰를 제공해주세요. 개선 사항이 있다면 구체적인 예시와 함께 제안해주세요.`

server.registerPrompt(
    'code-review',
    {
        title: '코드 리뷰',
        description: '코드를 입력받아서 코드 리뷰를 위한 프롬프트 템플릿과 결합하여 반환합니다.',
        argsSchema: {
            code: z
                .string()
                .describe('리뷰할 코드'),
            language: z
                .string()
                .optional()
                .describe('프로그래밍 언어 (예: typescript, javascript, python 등)'),
            context: z
                .string()
                .optional()
                .describe('코드의 맥락이나 목적에 대한 추가 설명')
        }
    },
    async ({ code, language, context }, extra) => {
        // 언어별 코드 블록 형식 지정
        const codeBlockLanguage = language || ''
        const codeBlockStart = codeBlockLanguage ? `\`\`\`${codeBlockLanguage}` : '```'
        
        // 프롬프트 템플릿에 코드 삽입 (코드 블록 시작 부분만 언어 지정)
        let reviewPrompt = CODE_REVIEW_PROMPT_TEMPLATE.replace(
            /\`\`\`\n\{code\}/,
            `${codeBlockStart}\n${code}`
        )
        
        // 추가 맥락 정보가 있으면 프롬프트에 추가
        if (context) {
            reviewPrompt += `\n\n## 추가 맥락\n${context}\n`
        }

        return {
            description: '코드 리뷰를 위한 프롬프트',
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: reviewPrompt
                    }
                }
            ]
        }
    }
)

// Blob을 Base64로 변환하는 함수
async function blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i])
    }
    return btoa(binary)
}

// Buffer를 Base64로 변환하는 함수
function bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64')
}

server.registerTool(
    'generate-image',
    {
        description: '텍스트 프롬프트를 입력받아 AI 이미지를 생성합니다. Hugging Face의 FLUX.1-schnell 모델을 사용합니다.',
        inputSchema: z.object({
            prompt: z
                .string()
                .describe('생성할 이미지에 대한 텍스트 설명 (영어 권장)')
        })
    },
    async ({ prompt }) => {
        try {
            // Hugging Face API를 사용하여 이미지 생성
            const imageResult: unknown = await hfClient.textToImage({
                provider: 'auto',
                model: 'black-forest-labs/FLUX.1-schnell',
                inputs: prompt,
                parameters: { num_inference_steps: 5 }
            })

            // 이미지를 Base64로 변환
            let base64Data: string
            if (imageResult instanceof Blob) {
                base64Data = await blobToBase64(imageResult)
            } else if (Buffer.isBuffer(imageResult)) {
                base64Data = bufferToBase64(imageResult)
            } else if (typeof imageResult === 'string') {
                // URL 또는 이미 Base64인 경우
                if (imageResult.startsWith('data:') || imageResult.startsWith('http')) {
                    // URL인 경우, fetch로 가져와서 Base64로 변환
                    const response = await fetch(imageResult)
                    const blob = await response.blob()
                    base64Data = await blobToBase64(blob)
                } else {
                    base64Data = imageResult
                }
            } else {
                throw new Error('알 수 없는 이미지 형식입니다.')
            }

            return {
                content: [
                    {
                        type: 'image' as const,
                        data: base64Data,
                        mimeType: 'image/png',
                        annotations: {
                            audience: ['user'] as const,
                            priority: 0.9
                        }
                    }
                ]
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `이미지 생성 실패: ${errorMessage}\n\nHF_TOKEN 환경 변수가 설정되어 있는지 확인해주세요.`
                    }
                ],
                isError: true
            }
        }
    }
)

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        console.log('MCP server started')
    })
