export interface IpcCommand<Args extends object | undefined, Result> {
  readonly args: Args;
  readonly result: Result;
}

export interface CdpJsonTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  devtoolsFrontendUrl?: string | null;
  webSocketDebuggerUrl: string;
  faviconUrl?: string | null;
}

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
