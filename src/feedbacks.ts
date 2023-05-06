/* eslint-disable @typescript-eslint/camelcase */
import {
	CompanionFeedbackDefinitions,
	CompanionAdvancedFeedbackResult,
	CompanionFeedbackAdvancedEvent,
	CompanionFeedbackBooleanEvent,
	DropdownChoice,
	combineRgb,
} from '@companion-module/base';
import { BroadcastMap, BroadcastLifecycle, StreamHealth, BroadcastID } from './cache';
import { Core } from './core';

export enum FeedbackId {
	// Legacy advanced feedbacks
	BroadcastStatus = 'broadcast_status',
	StreamHealth = 'broadcast_bound_stream_health',
	// Boolean feedbacks
	BroadcastStatusCreated = 'broadcast_status_created',
	BroadcastStatusReady = 'broadcast_status_ready',
	BroadcastStatusTestStarting = 'broadcast_status_teststarting',
	BroadcastStatusTesting = 'broadcast_status_testing',
	BroadcastStatusLiveStarting = 'broadcast_status_livestarting',
	BroadcastStatusLive = 'broadcast_status_live',
	BroadcastStatusComplete = 'broadcast_status_complete',
	BroadcastStatusRevoked = 'broadcast_status_revoked',
	StreamHealthGood = 'broadcast_bound_stream_health_good',
	StreamHealthOK = 'broadcast_bound_stream_health_ok',
	StreamHealthBad = 'broadcast_bound_stream_health_bad',
	StreamHealthNoData = 'broadcast_bound_stream_health_nodata',
}

/**
 * Get a list of feedbacks for this module
 * @param broadcasts Map of known broadcasts
 * @param unfinishedCount Number of unfinished broadcast
 * @param core Module core
 */
export function listFeedbacks(
	getProps: () => { broadcasts: BroadcastMap; unfinishedCount: number; core: Core | undefined; }
): CompanionFeedbackDefinitions {
	const { broadcasts } = getProps();
	const { unfinishedCount } = getProps();
	const { core } = getProps();

	const color = {
		status: {
			created: { bg: combineRgb(0, 0, 0), text: combineRgb(255, 255, 255) },
			ready: { bg: combineRgb(209, 209, 0), text: combineRgb(0, 0, 0) },
			testStarting: { bg: combineRgb(0, 172, 0), text: combineRgb(255, 255, 255) },
			testing: { bg: combineRgb(0, 172, 0), text: combineRgb(255, 255, 255) },
			liveStarting: { bg: combineRgb(222, 0, 0), text: combineRgb(255, 255, 255) },
			live: { bg: combineRgb(222, 0, 0), text: combineRgb(255, 255, 255) },
			complete: { bg: combineRgb(0, 0, 168), text: combineRgb(126, 126, 126) },
			revoked: { bg: combineRgb(50, 50, 50), text: combineRgb(255, 255, 255) },
		},
		health: {
			good: { bg: combineRgb(0, 204, 0), text: combineRgb(255, 255, 255) },
			ok: { bg: combineRgb(204, 204, 0), text: combineRgb(255, 255, 255) },
			bad: { bg: combineRgb(255, 102, 0), text: combineRgb(255, 255, 255) },
			noData: { bg: combineRgb(255, 0, 0), text: combineRgb(255, 255, 255) },
		}
	};

	const broadcastEntries: DropdownChoice[] = Object.values(broadcasts).map(
		(item): DropdownChoice => {
			return { id: item.Id, label: item.Name };
		}
	);

	const broadcastUnfinishedEntries: DropdownChoice[] = [...Array(unfinishedCount).keys()].map(
		(i): DropdownChoice => {
			return { id: `unfinished_${i}`, label: `Unfinished/planned #${i}` };
		}
	);

	const defaultBroadcast = broadcastEntries.length == 0 ? '' : broadcastEntries[0].id;

	const checkCore = (): boolean => {
		if (!core) {
			return false;
		}
		return true
	}

	return {
		// Legacy advanced feedbacks
		[FeedbackId.BroadcastStatus]: {
			type: 'advanced',
			name: 'Broadcast status',
			description: 'Feedback providing information about state of a broadcast in a broadcast lifecycle',
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (ready)',
					id: 'bg_ready',
					default: color.status.ready.bg,
				},
				{
					type: 'colorpicker',
					label: 'Background color (testing)',
					id: 'bg_testing',
					default: color.status.testing.bg,
				},
				{
					type: 'colorpicker',
					label: 'Background color (live)',
					id: 'bg_live',
					default: color.status.live.bg,
				},
				{
					type: 'colorpicker',
					label: 'Text color',
					id: 'text',
					default: color.status.live.text,
				},
				{
					type: 'colorpicker',
					label: 'Background color (complete)',
					id: 'bg_complete',
					default: color.status.complete.bg,
				},
				{
					type: 'colorpicker',
					label: 'Text color (complete)',
					id: 'text_complete',
					default: color.status.complete.text,
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackAdvancedEvent): CompanionAdvancedFeedbackResult => {
				if (!checkCore) return {};
				if (!event.options.broadcast) return {};
				const id = event.options.broadcast as BroadcastID;
				const dimStarting = Math.floor(Date.now() / 1000) % 2 == 0;
		
				let broadcastStatus: BroadcastLifecycle;
				if (id in core!.Cache.Broadcasts) {
					broadcastStatus = core!.Cache.Broadcasts[id].Status;
				} else {
					const hit = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id);
					if (hit) {
						broadcastStatus = hit.Status;
					} else {
						return {};
					}
				}
		
				// Handle missing fields
				event.options.bg_ready = event.options.bg_ready ?? color.status.ready.bg;
				event.options.bg_testing = event.options.bg_testing ?? color.status.testing.bg;
				event.options.bg_live = event.options.bg_live ?? color.status.live.bg;
				event.options.bg_complete = event.options.bg_complete ?? color.status.complete.bg;
				event.options.text = event.options.text ?? color.status.live.text;
				event.options.text_complete = event.options.text_complete ?? color.status.complete.text;
		
				switch (broadcastStatus) {
					case BroadcastLifecycle.LiveStarting:
						if (dimStarting)
							return { bgcolor: event.options.bg_testing as number, color: event.options.text as number };
						else return { bgcolor: event.options.bg_live as number, color: event.options.text as number };
					case BroadcastLifecycle.Live:
						return { bgcolor: event.options.bg_live as number, color: event.options.text as number };
					case BroadcastLifecycle.TestStarting:
						if (dimStarting)
							return { bgcolor: event.options.bg_ready as number, color: event.options.text as number };
						else return { bgcolor: event.options.bg_testing as number, color: event.options.text as number };
					case BroadcastLifecycle.Testing:
						return { bgcolor: event.options.bg_testing as number, color: event.options.text as number };
					case BroadcastLifecycle.Complete:
						return { bgcolor: event.options.bg_complete as number, color: event.options.text_complete as number };
					case BroadcastLifecycle.Ready:
						return { bgcolor: event.options.bg_ready as number, color: event.options.text as number };
					default:
						return {};
				}
			},
		},
		[FeedbackId.StreamHealth]: {
			type: 'advanced',
			name: 'Health of stream bound to broadcast',
			description: 'Feedback reflecting the health of video stream bound to a broadcast',
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (good)',
					id: 'bg_good',
					default: color.health.good.bg,
				},
				{
					type: 'colorpicker',
					label: 'Text color (good)',
					id: 'text_good',
					default: color.health.good.text,
				},
				{
					type: 'colorpicker',
					label: 'Background color (ok)',
					id: 'bg_ok',
					default: color.health.ok.bg,
				},
				{
					type: 'colorpicker',
					label: 'Text color (ok)',
					id: 'text_ok',
					default: color.health.ok.text,
				},
				{
					type: 'colorpicker',
					label: 'Background color (bad)',
					id: 'bg_bad',
					default: color.health.bad.bg,
				},
				{
					type: 'colorpicker',
					label: 'Text color (bad)',
					id: 'text_bad',
					default: color.health.bad.text,
				},
				{
					type: 'colorpicker',
					label: 'Background color (No data)',
					id: 'bg_no_data',
					default: color.health.noData.bg,
				},
				{
					type: 'colorpicker',
					label: 'Text color (No data)',
					id: 'text_no_data',
					default: color.health.noData.text,
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackAdvancedEvent): CompanionAdvancedFeedbackResult => {
				if (!checkCore) return {};
				if (!event.options.broadcast) return {};
				const id = event.options.broadcast as BroadcastID;

				let streamId: string | null;
				let broadcastStatus: BroadcastLifecycle;
				if (id in core!.Cache.Broadcasts) {
					streamId = core!.Cache.Broadcasts[id].BoundStreamId;
					broadcastStatus = core!.Cache.Broadcasts[id].Status;
				} else {
					const hit = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id);
					if (hit) {
						streamId = hit.BoundStreamId;
						broadcastStatus = hit.Status;
					} else {
						return {};
					}
				}
				if (streamId == null || !(streamId in core!.Cache.Streams)) return {};

				// Handle missing fields
				event.options.bg_good = event.options.bg_good ?? color.health.good.bg;
				event.options.bg_ok = event.options.bg_ok ?? color.health.ok.bg;
				event.options.bg_bad = event.options.bg_bad ?? color.health.bad.bg;
				event.options.bg_no_data = event.options.bg_no_data ?? color.health.noData.bg;
				event.options.text_good = event.options.text_good ?? color.health.good.text;
				event.options.text_ok = event.options.text_ok ?? color.health.ok.text;
				event.options.text_bad = event.options.text_bad ?? color.health.bad.text;
				event.options.text_no_data = event.options.text_no_data ?? color.health.noData.text;

				switch (core!.Cache.Streams[streamId].Health) {
					case StreamHealth.Good:
						return { bgcolor: event.options.bg_good as number, color: event.options.text_good as number };
					case StreamHealth.OK:
						return { bgcolor: event.options.bg_ok as number, color: event.options.text_ok as number };
					case StreamHealth.Bad:
						return { bgcolor: event.options.bg_bad as number, color: event.options.text_bad as number };
					case StreamHealth.NoData:
						if (broadcastStatus == BroadcastLifecycle.Complete) {
							return {};
						}
						return { bgcolor: event.options.bg_no_data as number, color: event.options.text_no_data as number };
				}
			},
		},
		// Boolean feedbacks
		[FeedbackId.BroadcastStatusCreated]: {
			type: 'boolean',
			name: 'Broadcast is created',
			description: 'Indicate if the lifecycle of the broadcast is at the "created" state',
			defaultStyle: {
				color: color.status.created.text,
				bgcolor: color.status.created.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;

				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.Created) ? true : false;
			},
		},
		[FeedbackId.BroadcastStatusReady]: {
			type: 'boolean',
			name: 'Broadcast is ready',
			description: 'Indicate if the lifecycle of the broadcast is at the "ready" state',
			defaultStyle: {
				color: color.status.ready.text,
				bgcolor: color.status.ready.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;
				
				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.Ready) ? true : false;
			},
		},
		[FeedbackId.BroadcastStatusTestStarting]: {
			type: 'boolean',
			name: 'Broadcast test is starting',
			description: 'Indicate if the lifecycle of the broadcast is at the "test starting" state',
			defaultStyle: {
				color: color.status.testStarting.text,
				bgcolor: color.status.testStarting.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;
				
				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.TestStarting) ? true : false;
			},
		},
		[FeedbackId.BroadcastStatusTesting]: {
			type: 'boolean',
			name: 'Broadcast testing',
			description: 'Indicate if the lifecycle of the broadcast is at the "testing" state',
			defaultStyle: {
				color: color.status.testing.text,
				bgcolor: color.status.testing.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;
				
				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.Testing) ? true : false;
			},
		},
		[FeedbackId.BroadcastStatusLiveStarting]: {
			type: 'boolean',
			name: 'Broadcast live is starting',
			description: 'Indicate if the lifecycle of the broadcast is at the "live starting" state',
			defaultStyle: {
				color: color.status.liveStarting.text,
				bgcolor: color.status.liveStarting.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;
				
				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.LiveStarting) ? true : false;
			},
		},
		[FeedbackId.BroadcastStatusLive]: {
			type: 'boolean',
			name: 'Broadcast is live',
			description: 'Indicate if the lifecycle of the broadcast is at the "live" state',
			defaultStyle: {
				color: color.status.live.text,
				bgcolor: color.status.live.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;
				
				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.Live) ? true : false;
			},
		},
		[FeedbackId.BroadcastStatusComplete]: {
			type: 'boolean',
			name: 'Broadcast is completed',
			description: 'Indicate if the lifecycle of the broadcast is at the "complete" state',
			defaultStyle: {
				color: color.status.complete.text,
				bgcolor: color.status.complete.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;
				
				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.Complete) ? true : false;
			},
		},
		[FeedbackId.BroadcastStatusRevoked]: {
			type: 'boolean',
			name: 'Broadcast is revoked',
			description: 'Indicate if the lifecycle of the broadcast is at the "revoked" state',
			defaultStyle: {
				color: color.status.revoked.text,
				bgcolor: color.status.revoked.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let broadcastStatus: BroadcastLifecycle;
				
				if (id in core!.Cache.Broadcasts) broadcastStatus = core!.Cache.Broadcasts[id].Status;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) broadcastStatus = unfinished.Status
					else return false
				}

				return (broadcastStatus === BroadcastLifecycle.Revoked) ? true : false;
			},
		},
		[FeedbackId.StreamHealthGood]: {
			type: 'boolean',
			name: 'Stream health is good',
			description: 'Indicate if the health of the stream bounded to the broadcast is good',
			defaultStyle: {
				color: color.health.good.text,
				bgcolor: color.health.good.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let streamId: string | null;
				
				if (id in core!.Cache.Broadcasts) streamId = core!.Cache.Broadcasts[id].BoundStreamId;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) streamId = unfinished.BoundStreamId
					else return false
				}

				if (streamId == null || !(streamId in core!.Cache.Streams)) return false
				return (core!.Cache.Streams[streamId].Health === StreamHealth.Good) ? true : false;
			},
		},
		[FeedbackId.StreamHealthOK]: {
			type: 'boolean',
			name: 'Stream health is ok',
			description: 'Indicate if the health of the stream bounded to the broadcast is ok',
			defaultStyle: {
				color: color.health.ok.text,
				bgcolor: color.health.ok.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let streamId: string | null;
				
				if (id in core!.Cache.Broadcasts) streamId = core!.Cache.Broadcasts[id].BoundStreamId;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) streamId = unfinished.BoundStreamId
					else return false
				}

				if (streamId == null || !(streamId in core!.Cache.Streams)) return false
				return (core!.Cache.Streams[streamId].Health === StreamHealth.OK) ? true : false;
			},
		},
		[FeedbackId.StreamHealthBad]: {
			type: 'boolean',
			name: 'Stream health is bad',
			description: 'Indicate if the health of the stream bounded to the broadcast is bad',
			defaultStyle: {
				color: color.health.bad.text,
				bgcolor: color.health.bad.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let streamId: string | null;
				
				if (id in core!.Cache.Broadcasts) streamId = core!.Cache.Broadcasts[id].BoundStreamId;
				else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished) streamId = unfinished.BoundStreamId
					else return false
				}

				if (streamId == null || !(streamId in core!.Cache.Streams)) return false
				return (core!.Cache.Streams[streamId].Health === StreamHealth.Bad) ? true : false;
			},
		},
		[FeedbackId.StreamHealthNoData]: {
			type: 'boolean',
			name: 'Stream receives no data',
			description: 'Indicate if the stream bounded to the broadcast receives no data',
			defaultStyle: {
				color: color.health.noData.text,
				bgcolor: color.health.noData.bg,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: (event: CompanionFeedbackBooleanEvent): boolean => {
				if (!checkCore) return false;
				if (!event.options.broadcast) return false;

				const id = event.options.broadcast as BroadcastID;
				let streamId: string | null;
				
				if (id in core!.Cache.Broadcasts) {
					if (core!.Cache.Broadcasts[id].Status === BroadcastLifecycle.Complete) return false;
					streamId = core!.Cache.Broadcasts[id].BoundStreamId
				} else {
					const unfinished = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id)
					if (unfinished && unfinished.Status !== BroadcastLifecycle.Complete) streamId = unfinished.BoundStreamId
					else return false
				}

				if (streamId == null || !(streamId in core!.Cache.Streams)) return false
				return (core!.Cache.Streams[streamId].Health === StreamHealth.NoData) ? true : false;
			},
		},
	};
}