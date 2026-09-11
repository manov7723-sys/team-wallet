/**
 * Logger Utility
 *
 * Centralized logging with environment-aware behavior.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

const isDevelopment = process.env.NODE_ENV !== "production";

function formatLog(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  if (entry.data) {
    return `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`;
  }
  return `${prefix} ${entry.message}`;
}

function createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
  return {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (isDevelopment) {
      console.debug(formatLog(createLogEntry("debug", message, data)));
    }
  },

  info(message: string, data?: unknown): void {
    console.info(formatLog(createLogEntry("info", message, data)));
  },

  warn(message: string, data?: unknown): void {
    console.warn(formatLog(createLogEntry("warn", message, data)));
  },

  error(message: string, data?: unknown): void {
    console.error(formatLog(createLogEntry("error", message, data)));
  },
};

export default logger;
