//require("leaked-handles");
/* eslint-disable @typescript-eslint/camelcase */
import { FeedbackId, listFeedbacks } from '../feedbacks';
import { BroadcastLifecycle, StreamHealth, StateMemory } from '../cache';
import { CompanionFeedbackAdvancedEvent, CompanionAdvancedFeedbackResult, CompanionFeedbackContext, combineRgb, CompanionFeedbackDefinitions, CompanionFeedbackBooleanEvent, CompanionBooleanFeedbackDefinition } from '@companion-module/base';
import { clone } from '../common';
import { ModuleBase, Core } from '../core';
import { mocked, MockedShallow } from 'jest-mock';
import { YoutubeAPI } from '../youtube';
import { makeMockModule, makeMockYT } from './core'

//
// SAMPLE DATA
//

const SampleContext: CompanionFeedbackContext = {
	parseVariablesInString: function (text: string): Promise<string> {
		throw new Error('Function not implemented. Parameter was: ' + text);
	}
}

const SampleMemory: StateMemory = {
	Broadcasts: {
		test: {
			Id: 'test',
			Name: 'Test broadcast',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'abcd',
			ScheduledStartTime: '2021-11-30T20:00:00',
			LiveChatId: 'lcTest',
			LiveConcurrentViewers: '24',
		},
		testUnknownStreamID: {
			Id: 'testUnknownStreamID',
			Name: 'Test broadcast with unknown stream ID',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'unknownStream',
			ScheduledStartTime: '2021-11-30T20:00:00',
			LiveChatId: 'lcTest',
			LiveConcurrentViewers: '24',
		}
	},
	Streams: {
		abcd: {
			Id: 'abcd',
			Health: StreamHealth.Good,
		},
	},
	UnfinishedBroadcasts: [],
};

const SampleBroadcastCheck: CompanionFeedbackAdvancedEvent = {
	id: 'abcd1234',
	type: 'advanced',
	feedbackId: 'broadcast_status',
	options: {
		bg_ready: combineRgb(0, 255, 0),
		bg_testing: combineRgb(255, 255, 0),
		bg_live: combineRgb(255, 0, 0),
		bg_complete: combineRgb(0, 0, 255),
		broadcast: 'test',
	},
	_page: 0,
	_bank: 0,
	_rawBank: 'test' as any,
	controlId: 'control0'
};

const SampleStreamCheck: CompanionFeedbackAdvancedEvent = {
	id: 'abcd1234',
	type: 'advanced',
	feedbackId: 'broadcast_bound_stream_health',
	options: {
		bg_good: combineRgb(0, 255, 0),
		bg_ok: combineRgb(255, 255, 0),
		bg_bad: combineRgb(255, 0, 0),
		bg_no_data: combineRgb(0, 0, 255),
		broadcast: 'test',
	},
	_page: 0,
	_bank: 0,
	_rawBank: 'test' as any,
	controlId: 'control0'
};

const SampleBroadcastStatusEvent: CompanionFeedbackBooleanEvent = {
	_rawBank: 'test' as any,
	type: 'boolean',
	id: 'booleanEvent0',
	controlId: 'control0',
	feedbackId: '',
	options: {
		broadcast: 'test',
	}
}

//
// TEST IF FEEDBACKS ARE PRESENT
//

describe('Common tests', () => {
	test('Module has required feedbacks', () => {
		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 1, core: undefined }));
		// Legacy feedbacks
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatus);
		expect(feedbacks).toHaveProperty(FeedbackId.StreamHealth);
		// Boolean feedbacks
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusCreated);
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusReady);
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusTestStarting);
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusTesting);
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusLiveStarting);
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusLive);
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusComplete);
		expect(feedbacks).toHaveProperty(FeedbackId.BroadcastStatusRevoked);
		expect(feedbacks).toHaveProperty(FeedbackId.StreamHealthGood);
		expect(feedbacks).toHaveProperty(FeedbackId.StreamHealthOK);
		expect(feedbacks).toHaveProperty(FeedbackId.StreamHealthBad);
		expect(feedbacks).toHaveProperty(FeedbackId.StreamHealthNoData);
	});
});

//
// BROADCAST TESTS
//

async function tryBroadcast(phase: BroadcastLifecycle, core: Core): Promise<CompanionAdvancedFeedbackResult> {
	await core.init();
	core.Cache.Broadcasts.test.Status = phase;
	const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));	
	return feedbacks.broadcast_status!.callback(SampleBroadcastCheck, SampleContext) as CompanionAdvancedFeedbackResult;
}

describe('[Legacy] Broadcast lifecycle feedbacks', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = clone(SampleMemory);
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	});

	afterAll(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
	});

	test('Created state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Created, core);

		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Ready state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Ready, core);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_ready);
	});

	test('TestStarting state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.TestStarting, core);
		const checking: boolean = (
			result.bgcolor === SampleBroadcastCheck.options.bg_testing ||
			result.bgcolor === SampleBroadcastCheck.options.bg_ready
		);
		expect(checking).toBe(true);
	});

	test('Testing state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Testing, core);
		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
	});

	test('LiveStarting state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.LiveStarting, core);
		const checking: boolean = (
			result.bgcolor === SampleBroadcastCheck.options.bg_live ||
			result.bgcolor === SampleBroadcastCheck.options.bg_testing
		);
		expect(checking).toBe(true);
	});

	test('Live state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Live, core);
		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_live);
	});

	test('Complete state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Complete, core);
		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_complete);
	});

	test('Revoked state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Revoked, core);
		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Missing colors', async () => {
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_status',
			options: {
				broadcast: 'test',
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		await core.init();

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		const result = feedbacks.broadcast_status!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_status',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
				broadcast: 'test',
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		const result = feedbacks.broadcast_status!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_status',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		const result = feedbacks.broadcast_status!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(Object.keys(result)).toHaveLength(0);
	});
});

describe('Broadcast lifecycle feedbacks', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
	let core: Core;
	let feedbacks: CompanionFeedbackDefinitions;

	beforeAll(async () => {
		memory = clone(SampleMemory);
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
		await core.init();
		feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
	});

	afterAll(() => {
		core.destroy();
		jest.clearAllMocks();
		jest.clearAllTimers();
	});

	test('Created state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusCreated] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusCreated });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.Created;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});

	test('Ready state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusReady] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusReady });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.Ready;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});

	test('Test starting state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusTestStarting] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusTestStarting });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.TestStarting;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});

	test('Testing state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusTesting] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusTesting });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.Testing;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});

	test('Live starting state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusLiveStarting] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusLiveStarting });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.LiveStarting;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});

	test('Live state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusLive] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusLive });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.Live;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});

	test('Complete state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusComplete] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusComplete });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.Complete;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});

	test('Revoked state', () => {
		let event = clone(SampleBroadcastStatusEvent);
		const feedback = feedbacks[FeedbackId.BroadcastStatusRevoked] as CompanionBooleanFeedbackDefinition;

		// Change properties for the test
		Object.defineProperty(event, 'feedbackId', { value: FeedbackId.BroadcastStatusRevoked });
		core.Cache.Broadcasts['test'].Status = BroadcastLifecycle.Revoked;

		// Test
		const result = feedback.callback(event, SampleContext);
		expect(result).toBe(true);
	});
});

//
// STREAM TESTS
//

async function tryStream(health: StreamHealth, core: Core): Promise<CompanionAdvancedFeedbackResult> {
	await core.init();
	core.Cache.Streams['abcd'].Health = health;
	const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
	return feedbacks.broadcast_bound_stream_health!.callback(SampleStreamCheck, SampleContext) as CompanionAdvancedFeedbackResult;
}

describe('[Legacy] Stream health feedbacks', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = clone(SampleMemory);
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	});

	afterAll(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
	});

	test('Good health', async () => {
		const result = await tryStream(StreamHealth.Good, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_good);
	});

	test('OK health', async () => {
		const result = await tryStream(StreamHealth.OK, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_ok);
	});

	test('Bad health', async () => {
		const result = await tryStream(StreamHealth.Bad, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_bad);
	});

	test('NoData health', async () => {
		const result = await tryStream(StreamHealth.NoData, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_no_data);
	});

	test('Missing colors', async () => {
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				broadcast: 'test',
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		await core.init();

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
				broadcast: 'test',
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};
		
		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Unknown streams', async () => {
		const data: StateMemory = {
			Broadcasts: {
				test: {
					Id: 'test',
					Name: 'Test Broadcast',
					MonitorStreamEnabled: true,
					Status: BroadcastLifecycle.Live,
					BoundStreamId: 'abcd',
					ScheduledStartTime: '2021-11-30T20:00:00',
					LiveChatId: 'lcTest',
					LiveConcurrentViewers: '24',
				},
			},
			Streams: {},
			UnfinishedBroadcasts: [],
		};

		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
				broadcast: 'test',
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;
		
		expect(Object.keys(result)).toHaveLength(0);
	});
});

describe('Stream health feedbacks', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
	let core: Core;
	let feedbacks: CompanionFeedbackDefinitions;

	beforeAll(async () => {
		memory = clone(SampleMemory);
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
		await core.init();
		feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
	});

	afterAll(() => {
		core.destroy();
		jest.clearAllMocks();
		jest.clearAllTimers();
	});

	describe('"Good" feedback', () => {
		test('Test feedback', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthGood] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthGood });
			core.Cache.Streams['abcd'].Health = StreamHealth.Good;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(true);
		});

		test('Test feedback with unknown broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthGood] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'unknown' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthGood });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback without broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthGood] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'options', { value: {} })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthGood });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback with unknown stream ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthGood] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'testUnknownStreamID' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthGood });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});
	});
	
	describe('"OK" feedback', () => {
		test('Test feedback', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthOK] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthOK });
			core.Cache.Streams['abcd'].Health = StreamHealth.OK;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(true);
		});

		test('Test feedback with unknown broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthOK] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'unknown' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthOK });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback without broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthOK] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'options', { value: {} })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthOK });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback with unknown stream ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthOK] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'testUnknownStreamID' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthOK });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});
	});

	describe('"Bad" feedback', () => {
		test('Test feedback', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthBad] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthBad });
			core.Cache.Streams['abcd'].Health = StreamHealth.Bad;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(true);
		});

		test('Test feedback with unknown broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthBad] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'unknown' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthBad });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback without broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthBad] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'options', { value: {} })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthBad });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback with unknown stream ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthBad] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'testUnknownStreamID' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthBad });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});
	});

	describe('"No data" feedback', () => {
		test('Test feedback', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthNoData] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthNoData });
			core.Cache.Streams['abcd'].Health = StreamHealth.NoData;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(true);
		});

		test('Test feedback with unknown broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthNoData] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'unknown' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthNoData });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback without broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthNoData] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'options', { value: {} })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthNoData });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback with unknown stream ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthNoData] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'testUnknownStreamID' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthNoData });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});
	});

	describe('Health issue feedback', () => {
		test('Test feedback with "Good" health state', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthIssue] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthIssue });
			core.Cache.Streams['abcd'].Health = StreamHealth.Good;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback with "OK" health state', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthIssue] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthIssue });
			core.Cache.Streams['abcd'].Health = StreamHealth.OK;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback with "Bad" health state', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthIssue] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthIssue });
			core.Cache.Streams['abcd'].Health = StreamHealth.Bad;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(true);
		});
	
		test('Test feedback with "No data" health state', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthIssue] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthIssue });
			core.Cache.Streams['abcd'].Health = StreamHealth.NoData;
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(true);
		});

		test('Test feedback with unknown broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthIssue] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'unknown' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthIssue });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback without broadcast ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthIssue] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event, 'options', { value: {} })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthIssue });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});

		test('Test feedback with unknown stream ID', () => {
			let event = clone(SampleBroadcastStatusEvent);
			const feedback = feedbacks[FeedbackId.StreamHealthIssue] as CompanionBooleanFeedbackDefinition;
	
			// Change properties for the test
			Object.defineProperty(event.options, 'broadcast', { value: 'testUnknownStreamID' })
			Object.defineProperty(event, 'feedbackId', { value: FeedbackId.StreamHealthIssue });
	
			// Test
			const result = feedback.callback(event, SampleContext);
			expect(result).toBe(false);
		});
	})
});