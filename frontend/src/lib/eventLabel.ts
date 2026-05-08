const EVENT_LABELS: Record<string, string> = {
  "---":                    "Belum ada kejadian",
  SYSTEM_BOOT:              "Perangkat dinyalakan",
  ENTER_STANDBY:            "Perangkat memasuki mode siaga",
  MANUAL_OVERRIDE_ON:       "Mode manual diaktifkan",
  MANUAL_OVERRIDE_OFF:      "Mode otomatis diaktifkan",
  PROCESS_STARTED:          "Siklus pengomposan dimulai",
  PROCESS_STARTED_WEB:      "Siklus pengomposan dimulai (via dasbor)",
  PROCESS_STOPPED_BY_USER:  "Siklus pengomposan dihentikan oleh pengguna",
  PROCESS_STOPPED_WEB:      "Siklus pengomposan dihentikan (via dasbor)",
  PROCESS_FINISHED:         "Siklus pengomposan selesai",
  PERIODIC_LOG:             "Pencatatan data berkala",
  GAS_HIGH:                 "Konsentrasi gas tinggi terdeteksi",
  HIGH_TEMP_SAFETY:         "Suhu tinggi — kipas pendingin diaktifkan",
  MANUAL_HIGH_TEMP_SAFETY:  "Suhu tinggi (mode manual) — kipas pendingin diaktifkan",
  EMERGENCY_TEMP_60C:       "Darurat: Suhu media melampaui 60°C",
  PUMP_PULSE_ON:            "Pembasahan media kompos aktif",
  WIFI_CONNECTED:           "Perangkat terhubung ke jaringan",
  WIFI_DISCONNECTED:        "Perangkat terputus dari jaringan",
  CORE_SENSOR_ERROR:        "Gangguan sensor suhu inti (DS18B20)",
  DHT_ERROR:                "Gangguan sensor suhu & kelembaban (DHT)",
  DHT_WARNING:              "Peringatan sensor suhu & kelembaban",
  SOIL_SENSOR_ERROR:        "Gangguan sensor kelembaban media",
  GAS_SENSOR_WARNING:       "Peringatan pembacaan sensor gas (MQ)",
};

export function eventLabel(code: string): string {
  return EVENT_LABELS[code] ?? code;
}

export function isWarningEvent(code: string): boolean {
  return (
    code.includes("ERROR") ||
    code.includes("HIGH") ||
    code.includes("SAFETY") ||
    code.includes("EMERGENCY") ||
    code.includes("WARNING") ||
    code.includes("DISCONNECTED")
  );
}
