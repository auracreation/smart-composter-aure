# Smart Composter Backend

Express + WebSocket server that replaces Blynk for the Smart Composter IoT system.

## Quick Start

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3001` by default.

## Environment Variables

Copy `.env.example` → `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP/WS port |
| `AUTH_TOKEN` | (empty) | Optional shared token for `X-Auth-Token` header |
| `SIMULATE` | `1` | Set to `1` to auto-generate mock sensor data |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Current composter state snapshot |
| `POST` | `/api/telemetry` | ESP32 pushes sensor/actuator data (JSON body) |
| `POST` | `/api/control/mode` | Set `{ autoMode: true/false }` |
| `POST` | `/api/control/actuator` | Set `{ heater, fan, pump, servo }` |
| `POST` | `/api/control/cycle` | Set `{ action: "start" | "stop" }` |
| `GET` | `/api/events?limit=50` | Recent event log |
| `WS` | `/ws` | Real-time state broadcast |

## Blynk Virtual Pin Mapping

| V-Pin | Data | API field |
|-------|------|-----------|
| V0 | Core Temp | `sensor.coreTemp` |
| V1 | Air Temp | `sensor.airTempAvg` |
| V2 | Air Humidity | `sensor.airHumidityAvg` |
| V3 | Soil % | `sensor.soilPercent` |
| V4 | Gas Raw | `sensor.gasRaw` |
| V5 | Mode | `mode` |
| V6 | Phase | `phase` |
| V7 | Fan | `actuator.fan` |
| V8 | Heater | `actuator.heater` |
| V9 | Pump | `actuator.pump` |
| V10 | Servo | `actuator.servo` |
| V11 | Event | `lastEvent` |
| V12 | Auto Mode | `autoMode` |
| V13-V16 | Manual controls | via `/api/control/actuator` |
