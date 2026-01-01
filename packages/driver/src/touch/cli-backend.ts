import type { Point } from "../types";
import type { TouchBackend } from "./backend";
import { TouchBackendUnavailableError } from "./backend";

export class CliTouchBackend implements TouchBackend {
  readonly name = "cli" as const;

  async init(): Promise<void> {
    throw new TouchBackendUnavailableError(
      this.name,
      "CLI touch backend not implemented yet. Configure XCTest/Instrumentation or use the JS harness.",
    );
  }

  async dispose(): Promise<void> {
    return;
  }

  async tap(_x: number, _y: number): Promise<void> {
    throw new TouchBackendUnavailableError(this.name, "CLI touch backend not available.");
  }

  async down(_x: number, _y: number): Promise<void> {
    throw new TouchBackendUnavailableError(this.name, "CLI touch backend not available.");
  }

  async move(_x: number, _y: number): Promise<void> {
    throw new TouchBackendUnavailableError(this.name, "CLI touch backend not available.");
  }

  async up(): Promise<void> {
    throw new TouchBackendUnavailableError(this.name, "CLI touch backend not available.");
  }

  async swipe(_from: Point, _to: Point, _durationMs: number): Promise<void> {
    throw new TouchBackendUnavailableError(this.name, "CLI touch backend not available.");
  }

  async longPress(_x: number, _y: number, _durationMs: number): Promise<void> {
    throw new TouchBackendUnavailableError(this.name, "CLI touch backend not available.");
  }

  async typeText(_text: string): Promise<void> {
    throw new TouchBackendUnavailableError(this.name, "CLI touch backend not available.");
  }
}
