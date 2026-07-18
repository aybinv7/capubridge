import type {
  ReplayDatabaseChange,
  ReplayDatabaseChangesResult,
  ReplayDatabaseChangeSummary,
  ReplayDatabaseRowsResult,
  ReplayDatabaseSource,
  ReplayDatabaseSourceChangeSummary,
  RustSessionListItem,
} from "@/types/replay.types";
import type { IpcCommand } from "@/runtime/ipc/contracts/common";

export interface RecordingSessionContents {
  manifest_json: string;
  tracks: Record<string, string>;
  database_path?: string | null;
}

export interface RecordingDatabaseSourceInput {
  id: string;
  kind: string;
  origin: string;
  databaseName: string;
  storeName: string;
  label: string;
  recordCount: number;
  metadataJson?: string;
}

export interface RecordingDatabaseSnapshotRowInput {
  keyJson: string;
  valueJson: string;
}

interface ReplayDatabasePositionArgs {
  databasePath: string;
  sourceId: string;
  positionMs: number;
}

export interface RecordingCommandMap {
  recording_session_start: IpcCommand<{ sessionId: string }, void>;
  recording_session_append: IpcCommand<
    { sessionId: string; track: string; ndjsonBatch: string },
    void
  >;
  recording_session_stop: IpcCommand<{ sessionId: string; manifestJson: string }, string>;
  recording_list_sessions: IpcCommand<undefined, RustSessionListItem[]>;
  recording_delete_session: IpcCommand<{ sessionId: string }, void>;
  recording_read_session: IpcCommand<{ filePath: string }, RecordingSessionContents>;
  recording_cleanup_orphans: IpcCommand<undefined, number>;
  recording_database_snapshot_begin: IpcCommand<
    {
      sessionId: string;
      source: RecordingDatabaseSourceInput;
      snapshotId: string;
      tMs: number;
    },
    void
  >;
  recording_database_snapshot_page: IpcCommand<
    {
      sessionId: string;
      snapshotId: string;
      sourceId: string;
      records: RecordingDatabaseSnapshotRowInput[];
    },
    void
  >;
  recording_database_snapshot_finish: IpcCommand<
    {
      sessionId: string;
      snapshotId: string;
      sourceId: string;
      tMs: number;
      reason: string;
    },
    void
  >;
  recording_database_sources: IpcCommand<{ databasePath: string }, ReplayDatabaseSource[]>;
  recording_database_table_rows: IpcCommand<
    ReplayDatabasePositionArgs & { offset: number; limit: number },
    ReplayDatabaseRowsResult
  >;
  recording_database_changed_rows: IpcCommand<
    ReplayDatabasePositionArgs & { offset: number; limit: number },
    ReplayDatabaseChangesResult
  >;
  recording_database_change_summary: IpcCommand<
    ReplayDatabasePositionArgs,
    ReplayDatabaseChangeSummary
  >;
  recording_database_change_summaries: IpcCommand<
    { databasePath: string; positionMs: number },
    ReplayDatabaseSourceChangeSummary[]
  >;
  recording_database_changes_for_keys: IpcCommand<
    ReplayDatabasePositionArgs & { keyJsons: string[] },
    ReplayDatabaseChange[]
  >;
}
