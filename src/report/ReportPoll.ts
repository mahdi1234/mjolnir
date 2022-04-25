/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Mjolnir, REPORT_POLL_EVENT_TYPE } from "../Mjolnir";
import { ReportManager } from './ReportManager';
import { LogLevel } from "matrix-bot-sdk";

class InvalidStateError extends Error {}

export class ReportPoll {
    /*
     * https://matrix-org.github.io/synapse/latest/admin_api/event_reports.html
     * "from" is an opaque token that is returned from the API to paginate reports
     */
    private from = 0;
    private timeout: ReturnType<typeof setTimeout> | null = null;

    /*
     * A class to poll synapse's report endpoint, so we can act on new reports
     *
     * @param client The Matrix client underpinning the running Mjolnir
     * @param manager The report manager in to which we feed new reports
     * @param save An abstract function to persist where we got to in report reading
     */
    constructor(
        private mjolnir: Mjolnir,
        private manager: ReportManager,
    ) { }

    private schedulePoll() {
        if (this.timeout === null) {
            /*
             * Important that we use `setTimeout` here, not `setInterval`,
             * because if there's networking problems and `getAbuseReports`
             * hangs for longer thank the interval, it could cause a stampede
             * of requests when networking problems resolve
             */
            this.timeout = setTimeout(
                this.getAbuseReports.bind(this),
                60_000 // a minute in milliseconds
            );
        else {
            throw new InvalidStateError("poll already scheduled");
        }
    }

    private async getAbuseReports() {
        this.timeout = null;

        let response_: {
            event_reports: { room_id: string, event_id: string, sender: string, reason: string }[],
            next_token: number | undefined
        } | undefined = undefined;
        try {
            response_ = await this.mjolnir.client.doRequest(
                "GET",
                "/_synapse/admin/v1/event_reports",
                { from: this.from.toString() }
            );
        } catch (ex) {
            await this.mjolnir.logMessage(LogLevel.ERROR, "getAbuseReports", `failed to poll events: ${ex}`);
            this.schedulePoll();
            return;
        }

        const response = response_!;
        for (let report of response.event_reports) {
            let event: any; // `any` because `handleServerAbuseReport` uses `any`
            try {
                event = (await this.mjolnir.client.doRequest(
                    "GET",
                    `/_synapse/admin/v1/rooms/${report.room_id}/context/${report.event_id}?limit=1`
                )).event;
            } catch (ex) {
                continue;
            }

            await this.manager.handleServerAbuseReport({
                roomId: report.room_id,
                reporterId: report.sender,
                event: event,
                reason: report.reason,
            });
        }

        if (response.next_token !== undefined) {
            this.from = response.next_token;
            try {
               await this.mjolnir.client.setAccountData(REPORT_POLL_EVENT_TYPE, { from: response.next_token });
            } catch (ex) {
                await this.mjolnir.logMessage(LogLevel.ERROR, "getAbuseReports", `failed to update progress: ${ex}`);
            }
        }

        this.schedulePoll();
    }

    public start(startFrom: number) {
        if (this.timeout === null) {
            this.from = startFrom;
            this.schedulePoll();
        } else {
            throw new InvalidStateError("cannot start an already started poll");
        }
    }
    public stop() {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        } else {
            throw new InvalidStateError("cannot stop a poll that hasn't started");
        }
    }
}
