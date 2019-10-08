/*
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Mjolnir } from "../Mjolnir";
import { execStatusCommand } from "./StatusCommand";
import { execBanCommand, execUnbanCommand } from "./UnbanBanCommand";
import { execDumpRulesCommand } from "./DumpRulesCommand";
import { LogService, RichReply } from "matrix-bot-sdk";
import * as htmlEscape from "escape-html";
import { execSyncCommand } from "./SyncCommand";
import { execPermissionCheckCommand } from "./PermissionCheckCommand";
import { execCreateListCommand } from "./CreateBanListCommand";
import { execUnwatchCommand, execWatchCommand } from "./WatchUnwatchCommand";

export const COMMAND_PREFIX = "!mjolnir";

export function handleCommand(roomId: string, event: any, mjolnir: Mjolnir) {
    const cmd = event['content']['body'];
    const parts = cmd.trim().split(' ');

    try {
        if (parts.length === 1 || parts[1] === 'status') {
            return execStatusCommand(roomId, event, mjolnir);
        } else if (parts[1] === 'ban' && parts.length > 4) {
            return execBanCommand(roomId, event, mjolnir, parts);
        } else if (parts[1] === 'unban' && parts.length > 4) {
            return execUnbanCommand(roomId, event, mjolnir, parts);
        } else if (parts[1] === 'rules') {
            return execDumpRulesCommand(roomId, event, mjolnir);
        } else if (parts[1] === 'sync') {
            return execSyncCommand(roomId, event, mjolnir);
        } else if (parts[1] === 'verify') {
            return execPermissionCheckCommand(roomId, event, mjolnir);
        } else if (parts.length >= 5 && parts[1] === 'list' && parts[2] === 'create') {
            return execCreateListCommand(roomId, event, mjolnir, parts);
        } else if (parts[1] === 'watch' && parts.length > 1) {
            return execWatchCommand(roomId, event, mjolnir, parts);
        } else if (parts[1] === 'unwatch' && parts.length > 1) {
            return execUnwatchCommand(roomId, event, mjolnir, parts);
        } else {
            // Help menu
            const menu = "" +
                "!mjolnir                                                            - Print status information\n" +
                "!mjolnir status                                                     - Print status information\n" +
                "!mjolnir ban <list_shortcode> <user|room|server> <glob> [reason]    - Adds an entity to the ban list\n" +
                "!mjolnir unban <list_shortcode> <user|room|server> <glob>           - Removes an entity from the ban list\n" +
                "!mjolnir rules                                                      - Lists the rules currently in use by Mjolnir\n" +
                "!mjolnir sync                                                       - Force updates of all lists and re-apply rules\n" +
                "!mjolnir verify                                                     - Ensures Mjolnir can moderate all your rooms\n" +
                "!mjolnir list create <shortcode> <alias_localpart>                  - Creates a new ban list with the given shortcode and alias\n" +
                "!mjolnir help                                                       - This menu\n";
            const html = `<b>Mjolnir help:</b><br><pre><code>${htmlEscape(menu)}</code></pre>`;
            const text = `Mjolnir help:\n${menu}`;
            const reply = RichReply.createFor(roomId, event, text, html);
            reply["msgtype"] = "m.notice";
            return mjolnir.client.sendMessage(roomId, reply);
        }
    } catch (e) {
        LogService.error("CommandHandler", e);
        const text = "There was an error processing your command - see console/log for details";
        const reply = RichReply.createFor(roomId, event, text, text);
        reply["msgtype"] = "m.notice";
        return mjolnir.client.sendMessage(roomId, reply);
    }
}
