import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

async function run(): Promise<void> {
    try {
        utils.setActionsCacheUrl();
        if (utils.isGhes()) {
            utils.logWarning(
                "Cache action is not supported on GHES. See https://github.com/actions/cache/issues/505 for more details"
            );
            utils.setCacheHitOutput(false);
            utils.setSuccessOutput(false);
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

        const forceCacheSave = utils.getInputAsBool(Inputs.ForceCacheSave, {
            required: false
        });

        if (forceCacheSave) {
            core.info(
                `forceCacheSave is ${forceCacheSave}, setting CacheHitOutput as false`
            );
            utils.setCacheHitOutput(false); // Indicate that cache hit is false because we're skipping cache restoration.
            return;
        }

        const primaryKey = core.getInput(Inputs.Key, { required: true });
        core.saveState(State.CachePrimaryKey, primaryKey);

        const restoreKeys = utils.getInputAsArray(Inputs.RestoreKeys);
        const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });

        try {
            const cacheKey = await cache.restoreCache(
                cachePaths,
                primaryKey,
                restoreKeys
            );
            if (!cacheKey) {
                core.info(
                    `Cache not found for input keys: ${[
                        primaryKey,
                        ...restoreKeys
                    ].join(", ")}`
                );
                utils.setCacheHitOutput(false);
                return;
            }

            utils.setCacheState(cacheKey);
            const isExactKeyMatch = utils.isExactKeyMatch(primaryKey, cacheKey);
            utils.setCacheHitOutput(isExactKeyMatch);
            core.info(`Cache restored from key: ${cacheKey}`);
        } catch (error) {
            const err = error as Error; // Type assertion here
            if (err.name === cache.ValidationError.name) {
                throw err;
            } else {
                core.error(err.message);
                utils.setCacheHitOutput(false); // Ensure cache hit is false on error.
            }
        }
    } catch (error) {
        const err = error as Error; // Type assertion here
        core.setFailed(err.message);
    }
}

run();
