import type { IpcCommand, JsonValue } from "./common";
import type {
  AutomationTask,
  AutomationTaskEvent,
  AutomationTaskEventPage,
  AutomationTaskRun,
} from "@/types/automation.types";

export interface AutomationCommandMap {
  artemis_start_task: IpcCommand<
    {
      payload: {
        goal: string;
        deviceSerial: string | null;
        model: "flash" | "pro";
        lockedAppPackage: string | null;
      };
    },
    { traceId: string; status: string }
  >;
  artemis_get_trace: IpcCommand<{ payload: { traceId: string } }, JsonValue>;
  artemis_get_steps: IpcCommand<{ payload: { traceId: string } }, JsonValue>;
  artemis_stop_task: IpcCommand<{ payload: { traceId: string } }, void>;
  artemis_diagnose: IpcCommand<undefined, JsonValue>;
  jev_decide: IpcCommand<{ payload: { body: JsonValue } }, JsonValue>;
  reasoning_provider_set_credential: IpcCommand<
    { payload: { provider: "openrouter" | "openai" | "anthropic"; apiKey: string } },
    { provider: "openrouter" | "openai" | "anthropic"; configured: boolean }
  >;
  reasoning_provider_get_credential_status: IpcCommand<
    { payload: { provider: "openrouter" | "openai" | "anthropic" } },
    { provider: "openrouter" | "openai" | "anthropic"; configured: boolean }
  >;
  reasoning_provider_delete_credential: IpcCommand<
    { payload: { provider: "openrouter" | "openai" | "anthropic" } },
    { provider: "openrouter" | "openai" | "anthropic"; configured: boolean }
  >;
  reasoning_provider_complete: IpcCommand<
    {
      payload: {
        provider: "openrouter" | "openai" | "anthropic";
        model: string;
        messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      };
    },
    { provider: "openrouter" | "openai" | "anthropic"; model: string; text: string }
  >;
  automation_task_upsert: IpcCommand<{ task: AutomationTask; run: AutomationTaskRun }, void>;
  automation_event_append: IpcCommand<{ event: AutomationTaskEvent }, void>;
  automation_events_read: IpcCommand<
    { taskId: string; runId: string; cursor?: string | null; limit?: number },
    AutomationTaskEventPage
  >;
  automation_tasks_list: IpcCommand<
    undefined,
    Array<{
      task: AutomationTask;
      runs: AutomationTaskRun[];
      events: AutomationTaskEvent[];
    }>
  >;
}
