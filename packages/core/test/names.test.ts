import { keccak256, labelhash, namehash, stringToHex, toEventSelector } from "viem";
import { describe, expect, it } from "vitest";
import {
	AGENT_LABEL,
	agentResources,
	agentTextKeys,
	decodeRange,
	dnsEncode,
	encodePair,
	encodeRange,
	fullName,
	holderRecordKeys,
	labelId,
	labelRegisteredEvent,
	listPositions,
	MoorRoles,
	positionNode,
	positionsFromLogs,
	resolverResource,
	textPart,
} from "../src/names";
import { agentRecordKeys, positionRecordKeys } from "../src/records";

describe("names", () => {
	it("builds the position node as namehash(label.parent)", () => {
		expect(positionNode("salviega.eth", "btc-dip")).toBe(namehash("btc-dip.salviega.eth"));
		expect(fullName("salviega.eth", AGENT_LABEL)).toBe("agent.salviega.eth");
	});
	it("DNS-encodes like NameCoder.encode", () => {
		expect(dnsEncode("")).toBe("0x00");
		expect(dnsEncode("eth")).toBe("0x0365746800");
		expect(dnsEncode("salviega.eth")).toBe(
			`0x08${stringToHex("salviega").slice(2)}03${stringToHex("eth").slice(2)}00`,
		);
		expect(() => dnsEncode("a..b")).toThrow(/bad label/);
	});
	it("labelId is the labelhash", () => {
		expect(labelId("salviega")).toBe(BigInt(keccak256(stringToHex("salviega"))));
	});
});

describe("resolver resources (PermissionedResolverLib)", () => {
	it("resource(0,0) is the root, anything else is keccak(node ‖ part)", () => {
		const zero = `0x${"0".repeat(64)}` as const;
		expect(resolverResource(zero, zero)).toBe(0n);
		const node = namehash("btc-dip.salviega.eth");
		const part = textPart("moor.agent.proposal");
		expect(resolverResource(node, part)).toBe(
			BigInt(keccak256(`0x${node.slice(2)}${part.slice(2)}`)),
		);
	});
	it("gives one any-name resource per agent key, and none for holder keys", () => {
		const rs = agentResources();
		expect(rs.map((r) => r.key)).toEqual([...agentTextKeys]);
		expect(new Set(rs.map((r) => r.resource)).size).toBe(8);
		for (const k of holderRecordKeys) expect(agentTextKeys).not.toContain(k);
	});
	it("keeps the key lists in step with records.ts", () => {
		expect([...agentTextKeys]).toEqual([...agentRecordKeys]);
		expect([...holderRecordKeys]).toEqual([...positionRecordKeys]);
	});
});

describe("record values", () => {
	it("pair and range round-trip", () => {
		expect(
			encodePair(
				"0x274aaB610937e018310cCedC0b05B543b75557AB",
				"0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC",
			),
		).toBe("0x274aab610937e018310ccedc0b05b543b75557ab:0xfa92a297ec2ccc8ec010aca475f07240e2d47dec");
		expect(decodeRange(encodeRange("58000", "62000"))).toEqual({
			priceMin: "58000",
			priceMax: "62000",
		});
		expect(() => decodeRange("58000")).toThrow(/malformed/);
		expect(() => decodeRange("1:2:3")).toThrow(/malformed/);
	});
});

describe("listing positions", () => {
	const registrar = "0xe6915D2E5e8Db86661a66472e5B178d0dB419966" as const;
	const holder = "0xd7A4467a26d26d00cB6044CE09eBD69EDAC0564C" as const;
	const log = (label: string, sender: `0x${string}`, expiry: bigint, blockNumber: bigint) => ({
		args: {
			tokenId: labelId(label),
			labelHash: labelhash(label),
			label,
			owner: holder,
			expiry,
			sender,
		},
		blockNumber,
	});

	it("keeps Moor's position names and drops the agent's and strangers'", () => {
		const positions = positionsFromLogs(
			[
				log("agent", registrar, 100n, 1n),
				log("btc-dip", registrar, 200n, 2n),
				log("manual", holder, 300n, 3n),
			],
			registrar,
		);
		expect(positions.map((p) => p.label)).toEqual(["btc-dip"]);
		expect(positions[0]).toMatchObject({
			owner: holder,
			expiry: 200n,
			tokenId: labelId("btc-dip"),
		});
	});

	it("keeps only the latest registration of a re-used label", () => {
		const positions = positionsFromLogs(
			[log("btc-dip", registrar, 200n, 2n), log("btc-dip", registrar, 900n, 5n)],
			registrar,
		);
		expect(positions).toHaveLength(1);
		expect(positions[0]?.expiry).toBe(900n);
	});

	it("ignores logs with missing args and tolerates a null block number", () => {
		const positions = positionsFromLogs(
			[
				{ args: { sender: registrar, label: "x" }, blockNumber: 1n },
				{ ...log("btc-dip", registrar, 200n, 2n), blockNumber: null },
			],
			registrar,
		);
		expect(positions).toEqual([
			{
				label: "btc-dip",
				tokenId: labelId("btc-dip"),
				owner: holder,
				expiry: 200n,
				blockNumber: 0n,
			},
		]);
	});

	it("asks the client for LabelRegistered on the holder's registry from a block", async () => {
		const calls: unknown[] = [];
		const client = {
			getLogs: async (args: unknown) => {
				calls.push(args);
				return [log("btc-dip", registrar, 200n, 2n)];
			},
		};
		const positions = await listPositions(client, {
			registry: "0x6b1D890908f8cDEEF618dC3c278a76Bf28cf9E81",
			registrar,
			fromBlock: 11642814n,
		});
		expect(positions.map((p) => p.label)).toEqual(["btc-dip"]);
		expect(calls[0]).toMatchObject({
			address: "0x6b1D890908f8cDEEF618dC3c278a76Bf28cf9E81",
			fromBlock: 11642814n,
			event: labelRegisteredEvent,
		});
	});
});

describe("LabelRegistered", () => {
	it("has the registry's topic0 and indexing (tokenId, labelHash and sender are indexed)", () => {
		expect(toEventSelector(labelRegisteredEvent)).toBe(
			"0x2fe093918572373e9f1f0368f414dffd0043a74ae8c9fd7b0e390b26a0d20b6e",
		);
		expect(labelRegisteredEvent.inputs.filter((i) => i.indexed).map((i) => i.name)).toEqual([
			"tokenId",
			"labelHash",
			"sender",
		]);
	});
});

describe("role bitmaps", () => {
	it("matches MoorRoles in MoorRegistrar.sol (values seen in the Sepolia traces)", () => {
		expect(MoorRoles.REGISTRAR_ON_REGISTRY).toBe(1n);
		expect(MoorRoles.REGISTRAR_ON_RESOLVER).toBe(5444517870735015415413993718908291383313n);
	});
});
