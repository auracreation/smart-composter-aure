"use client";
import { useEffect, useRef, useCallback } from "react";
import { useComposterStore } from "@/store/composterStore";
import { getState } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const POLL_INTERVAL_MS = 5000;
const HEALTH_POLL_MS = 10000;

export function useLiveState() {
  const setState = useComposterStore((s) => s.setState);
  const setConnected = useComposterStore((s) => s.setConnected);
  const updateDeviceLastSeen = useComposterStore((s) => s.updateDeviceLastSeen);
  const selectedDeviceId = useComposterStore((s) => s.selectedDeviceId);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_MS);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHealthPoll = useCallback(() => {
    if (healthTimerRef.current) return;
    async function ping() {
      try {
        const res = await fetch(`${API_URL}/api/health`, { cache: "no-store" });
        if (mountedRef.current) setConnected(res.ok);
      } catch {
        if (mountedRef.current) setConnected(false);
      }
    }
    ping();
    healthTimerRef.current = setInterval(ping, HEALTH_POLL_MS);
  }, [setConnected]);

  const stopHealthPoll = useCallback(() => {
    if (healthTimerRef.current) {
      clearInterval(healthTimerRef.current);
      healthTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((deviceId: string) => {
    if (pollTimer.current) return;
    pollTimer.current = setInterval(async () => {
      try {
        const s = await getState(deviceId);
        if (mountedRef.current) setState(s);
      } catch {}
    }, POLL_INTERVAL_MS);
  }, [setState]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    let wsUrl = WS_URL;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        wsUrl = `${WS_URL}?token=${encodeURIComponent(session.access_token)}&device_id=${encodeURIComponent(deviceId)}`;
      }
    } catch {}

    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay.current = RECONNECT_BASE_MS;
        if (mountedRef.current) {
          setConnected(true);
          stopPolling();
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "state" && msg.payload && mountedRef.current) {
            setState(msg.payload);
            if (msg.payload.timestamp) {
              updateDeviceLastSeen(deviceId, msg.payload.timestamp);
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        startPolling(deviceId);
        scheduleReconnect(deviceId);
      };

      ws.onerror = () => { ws.close(); };
    } catch {
      if (mountedRef.current) {
        setConnected(false);
        startPolling(deviceId);
        scheduleReconnect(deviceId);
      }
    }
  }, [setState, setConnected, updateDeviceLastSeen, startPolling, stopPolling]);

  const scheduleReconnect = useCallback((deviceId: string) => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => {
      if (mountedRef.current) connect(deviceId);
    }, reconnectDelay.current);
    reconnectDelay.current = Math.min(reconnectDelay.current * 2, RECONNECT_MAX_MS);
  }, [connect]);

  useEffect(() => {
    if (!selectedDeviceId) {
      mountedRef.current = true;
      startHealthPoll();
      return () => {
        mountedRef.current = false;
        stopHealthPoll();
      };
    }

    stopHealthPoll();
    mountedRef.current = true;
    reconnectDelay.current = RECONNECT_BASE_MS;

    getState(selectedDeviceId)
      .then((s) => { if (mountedRef.current) setState(s); })
      .catch(() => {});

    connect(selectedDeviceId);

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      stopPolling();
    };
  }, [selectedDeviceId, connect, setState, stopPolling, startHealthPoll, stopHealthPoll]);
}
