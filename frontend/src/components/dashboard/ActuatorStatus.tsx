"use client";
import { useComposterStore } from "@/store/composterStore";

const actuatorItems = [
  { key: "fan" as const, label: "Kipas", icon: "fa-fan", spinWhenOn: true },
  { key: "heater" as const, label: "Pemanas", icon: "fa-fire", spinWhenOn: false },
  { key: "pump" as const, label: "Pompa", icon: "fa-water", spinWhenOn: false },
];

export default function ActuatorStatus() {
  const actuator = useComposterStore((s) => s.state.actuator);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
      <h2 className="text-lg font-bold text-gray-800 mb-6">Status Aktuator</h2>
      <div className="flex justify-around items-center">
        {actuatorItems.map((item) => {
          const on = actuator[item.key];
          return (
            <div key={item.key} className="flex flex-col items-center gap-2">
              <div
                className={`w-16 h-16 rounded-full border-4 flex items-center justify-center ${
                  on
                    ? "border-brand-blue bg-white shadow-lg shadow-blue-100"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <i
                  className={`fa-solid ${item.icon} text-2xl ${
                    on ? "text-brand-blue" : "text-gray-400"
                  } ${on && item.spinWhenOn ? "animate-spin-slow" : ""}`}
                />
              </div>
              <span className="text-sm font-semibold text-brand-text">{item.label}</span>
              <span className={`text-xs font-medium ${on ? "text-brand-green" : "text-gray-400"}`}>
                {on ? "ON" : "OFF"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
