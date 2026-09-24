// Basic monitoring and logging system for production

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "critical";
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  route?: string;
}

class Monitoring {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private isProduction = process.env.NODE_ENV === "production";

  log(level: LogEntry["level"], message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output based on level
    if (this.isProduction) {
      // In production, only log errors and critical to console
      if (level === "error" || level === "critical") {
        console.error(`[${level.toUpperCase()}] ${message}`, context);
      }
    } else {
      // In development, log everything
      console.log(`[${level.toUpperCase()}] ${message}`, context);
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log("error", message, context);
  }

  critical(message: string, context?: Record<string, unknown>) {
    this.log("critical", message, context);
  }

  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  getLogsByLevel(level: LogEntry["level"]): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  clearLogs() {
    this.logs = [];
  }
}

export const monitoring = new Monitoring();

// Helper for API route error logging
export function logApiError(route: string, error: unknown, context?: Record<string, unknown>) {
  monitoring.error(`API Error: ${route}`, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

// Helper for API route success logging
export function logApiSuccess(route: string, context?: Record<string, unknown>) {
  monitoring.info(`API Success: ${route}`, context);
}
