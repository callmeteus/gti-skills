import { join } from "node:path";

import { JsonFile, Paths, type AssetRecord } from "../core";

/**
 * Simple asset license manifest stored at `.artdirector/assets.json`.
 */
export namespace AssetManifest {
    /**
     * Loads the manifest, creating an empty list when missing.
     *
     * @param projectRoot Project root
     * @returns Records
     */
    export function load(projectRoot: string): AssetRecord[] {
        return JsonFile.readOr<AssetRecord[]>(path(projectRoot), []);
    }

    /**
     * Replaces the manifest.
     *
     * @param projectRoot Project root
     * @param records Records
     */
    export function save(projectRoot: string, records: AssetRecord[]): void {
        JsonFile.write(path(projectRoot), records);
    }

    /**
     * Adds or replaces a record by id.
     *
     * @param projectRoot Project root
     * @param record Asset record
     * @returns Updated list
     */
    export function upsert(projectRoot: string, record: AssetRecord): AssetRecord[] {
        const records = load(projectRoot).filter((item) => item.id !== record.id);
        records.push(record);
        save(projectRoot, records);
        return records;
    }

    /**
     * Manifest path.
     *
     * @param projectRoot Project root
     * @returns Absolute path
     */
    function path(projectRoot: string): string {
        return join(Paths.stateDir(projectRoot), "assets.json");
    }
}
