"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", icon: "fa-house", label: "Dasbor" },
  { href: "/controls", icon: "fa-sliders", label: "Kontrol" },
  { href: "/history", icon: "fa-clock-rotate-left", label: "Riwayat" },
  { href: "/schedule", icon: "fa-calendar", label: "Jadwal" },
  { href: "/settings", icon: "fa-gear", label: "Pengaturan" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`${
        expanded ? "w-60" : "w-16 lg:w-20"
      } bg-white border-r border-gray-100 flex flex-col py-6 h-full shadow-sm z-10 flex-shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden`}
    >
      {/* Header: brand + toggle */}
      <div
        className={`mb-8 flex items-center flex-shrink-0 ${
          expanded ? "px-4 justify-between" : "justify-center"
        }`}
      >
        {expanded && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand-light flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-seedling text-brand-blue text-xs" />
            </div>
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap truncate">
              Smart Composter
            </span>
          </div>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Ciutkan sidebar" : "Perluas sidebar"}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-brand-blue hover:bg-brand-light transition-colors flex-shrink-0"
        >
          <i
            className={`fa-solid text-sm transition-transform duration-300 ${
              expanded ? "fa-chevron-left" : "fa-bars"
            }`}
          />
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 mb-4 border-t border-gray-100" />

      {/* Navigation */}
      <nav className={`flex-1 flex flex-col ${expanded ? "gap-6 px-2" : "gap-6 items-center"}`}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              aria-label={item.label}
              className={`transition-all duration-200 flex items-center rounded-xl ${
                expanded ? "w-full pr-3" : "w-10 h-10 justify-center"
              } ${
                active
                  ? "bg-brand-light text-brand-blue shadow-sm"
                  : "text-gray-400 hover:bg-gray-50 hover:text-brand-blue"
              }`}
            >
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${item.icon}`} />
              </div>
              {expanded && (
                <span className="text-sm font-medium whitespace-nowrap">
                  {item.label}
                </span>
              )}
              {active && expanded && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-blue flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 mt-4 mb-4 border-t border-gray-100" />

      {/* Tips button */}
      <div className="px-2">
        <button
          className={`w-full bg-brand-blue text-white rounded-xl shadow-md hover:bg-brand-dark transition-colors flex items-center ${
            expanded ? "pr-3" : "flex-col justify-center py-1 text-xs"
          }`}
        >
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <i className="fa-regular fa-lightbulb" />
          </div>
          {expanded ? (
            <span className="text-sm font-medium whitespace-nowrap">Tips &amp; Info</span>
          ) : (
            <span className="mb-1">Kiat</span>
          )}
        </button>
      </div>
    </aside>
  );
}
