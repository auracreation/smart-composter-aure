type Phase = "MESOFILIK" | "TERMOFILIK" | "PENDINGINAN" | "PEMATANGAN";

const phases: Phase[] = ["MESOFILIK", "TERMOFILIK", "PENDINGINAN", "PEMATANGAN"];
let tick = 0;

function randomBetween(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

export function startSimulator(intervalMs = 3000) {
  const apiKey = process.env.SIMULATOR_API_KEY;
  const port = process.env.PORT || "3001";
  const endpoint = `http://localhost:${port}/api/telemetry`;

  if (!apiKey) {
    console.warn("[Simulator] SIMULATOR_API_KEY not set — simulator disabled. Set it in .env to enable.");
    return;
  }

  console.log(`[Simulator] Running via HTTP POST to ${endpoint} every ${intervalMs}ms`);

  setInterval(async () => {
    tick++;
    const phaseIndex = Math.floor((tick / 20) % phases.length);
    const phase = phases[phaseIndex];

    let coreTemp: number;
    let airTemp: number;

    switch (phase) {
      case "MESOFILIK":
        coreTemp = randomBetween(28, 40);
        airTemp = randomBetween(25, 32);
        break;
      case "TERMOFILIK":
        coreTemp = randomBetween(42, 52);
        airTemp = randomBetween(30, 38);
        break;
      case "PENDINGINAN":
        coreTemp = randomBetween(35, 42);
        airTemp = randomBetween(28, 34);
        break;
      case "PEMATANGAN":
        coreTemp = randomBetween(27, 35);
        airTemp = randomBetween(26, 32);
        break;
    }

    const humidity    = randomBetween(55, 85);
    const soilPercent = randomBetween(40, 70);
    const gasRaw      = Math.round(randomBetween(200, 2500));
    const heater      = coreTemp < 45;
    const fan         = coreTemp > 40 || gasRaw > 2200;
    const pump        = soilPercent < 45;

    const events = [
      "PERIODIC_LOG", "PERIODIC_LOG", "PERIODIC_LOG",
      "GAS_HIGH", "HIGH_TEMP_SAFETY", "PUMP_PULSE_ON",
    ];
    const lastEvent = gasRaw > 2200 ? "GAS_HIGH" : events[tick % events.length];

    const payload = {
      mode: "PROCESS",
      phase,
      autoMode: true,
      wifi: "ONLINE",
      lastEvent,
      sensor: {
        coreTemp,
        airTempAvg: airTemp,
        airHumidityAvg: humidity,
        soilPercent,
        gasRaw,
        dht1Valid: true,
        dht2Valid: true,
        ds18b20Valid: true,
        soilValid: true,
        gasValid: true,
      },
      actuator: {
        heater,
        fan,
        pump,
        servo: coreTemp >= 50 ? "OPEN" : coreTemp < 35 ? "CLOSE" : "HALF",
      },
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[Simulator] POST failed ${res.status}: ${body}`);
      }
    } catch (err: any) {
      console.error("[Simulator] POST error:", err.message);
    }
  }, intervalMs);
}
