import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

// Catch and log any unhandled exceptions. These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception. Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

async function run(): Promise<void> {
    try {
        utils.setActionsCacheUrl();
        if (utils.isGhes()) {
            utils.logWarning(
                "Cache action is not supported on GHES. See https://github.com/actions/cache/issues/505 for more details"
            );
            return;
        }

        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
            return;
        }

        const state = utils.getCacheState();

        // Inputs are re-evaluted before the post action, so we want the original key used for restore
        const primaryKey = core.getState(State.CachePrimaryKey);
        if (!primaryKey) {
            utils.logWarning("Error retrieving key from state.");
            return;
        }

        const forceCacheSave = core.getInput("force-cache-save") === "true";
        console.log("forceCacheSave: ", forceCacheSave);

        if (!forceCacheSave && utils.isExactKeyMatch(primaryKey, state)) {
            core.info(
                `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
            );
            return;
        }

        const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });

        try {
            await cache.saveCache(cachePaths, primaryKey, {
                uploadChunkSize: utils.getInputAsInt(Inputs.UploadChunkSize)
            });
            const message = forceCacheSave
                ? `Cache force save enabled`
                : `Cache saved`;
            core.info(`${message} with key: ${primaryKey}`);
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === cache.ValidationError.name) {
                    throw error;
                } else if (error.name === cache.ReserveCacheError.name) {
                    core.info(error.message);
                } else {
                    utils.logWarning(error.message);
                }
            } else {
                // Handle cases where the caught thing is not an Error object
                utils.logWarning("An unexpected error occurred.");
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            utils.logWarning(error.message);
        } else {
            utils.logWarning("An unexpected error occurred.");
        }
    }
}

run();

export default run;
