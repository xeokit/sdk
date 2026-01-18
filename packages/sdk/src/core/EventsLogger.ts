// SceneEventsLogger.ts
import { EventEmitter } from "../core"; // <-- adjust import path to where your EventEmitter lives

type AnyEmitter = EventEmitter<any, any>;

/**
 * Logs all events emitted by an event hub (e.g., SceneEvents) to the console.
 */
export class EventsLogger {
  private readonly unsubs: Array<() => void> = [];
  private enabled = true;

  constructor(
    private readonly events: any,
    private readonly opts?: {
      /** Prefix for each log line (e.g. `[Scene foo]`) */
      prefix?: string;
    }
  ) {
    this.bindAll();
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Unsubscribe from all events. Safe to call multiple times. */
  public dispose() {
    while (this.unsubs.length) {
      try {
        this.unsubs.pop()!();
      } catch {
        // ignore
      }
    }
  }

  private bindAll() {
    const prefix = this.opts?.prefix ? `${this.opts.prefix} ` : "";

    const log = ((eventName, sender, args) => {
        // eslint-disable-next-line no-console
        //console.log(`${prefix}${eventName}`, { sender, args });
      console.log(`%c${prefix}%c${eventName}`, `color: grey;`, "color:green;", { sender, args });
      });

    const error = ((eventName, sender, args) => {
        // eslint-disable-next-line no-console
        console.error(`%c${prefix}%c${eventName}: ${args.error} `, "color: red;", "color:red;", { sender, args });
      });

    for (const [name, maybeEmitter] of Object.entries(this.events as any)) {
      if (!name.startsWith("on")) {
        continue;
      }
      if (!this.isEventEmitter(maybeEmitter)) {
        continue;
      }
      const handler = (sender: unknown, args: unknown) => {
        if (!this.enabled) {
          return;
        }
        if (name === "onError") {
          error(name, sender, args);
        }
        else {
          log(name, sender, args);
        }
      };
      // Your EventEmitter.subscribe() returns an unsubscribe function.
      const unsub = maybeEmitter.subscribe(handler);

      this.unsubs.push(() => {
        try {
          unsub();
        } finally {
        }
      });
    }
  }

  private isEventEmitter(value: unknown): value is AnyEmitter {
    return (
      !!value &&
      typeof value === "object" &&
      typeof (value as any).subscribe === "function" &&
      typeof (value as any).clear === "function" &&
      typeof (value as any).count === "number"
    );
  }
}
