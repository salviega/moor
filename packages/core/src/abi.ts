/**
 * The ABI surface the Live App and the agent touch, as human-readable
 * fragments — enough to encode a session and decode a read, nothing more.
 * Anything signable here has its ERC-7730 descriptor in packages/erc7730.
 */
import { parseAbi } from "viem";

export const erc20Abi = parseAbi([
	"function approve(address spender, uint256 amount) returns (bool)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function balanceOf(address owner) view returns (uint256)",
	"function decimals() view returns (uint8)",
	"function symbol() view returns (string)",
]);

/** 1inch Aqua (official source, redeployed on Sepolia). The holder is the only caller of ship/dock. */
export const aquaAbi = parseAbi([
	"function approve(address spender, uint256 amount) returns (bool)",
	"function ship(address app, bytes strategy, address[] tokens, uint256[] amounts) returns (bytes32)",
	"function dock(address app, bytes32 strategyHash, address[] tokens)",
	"function safeBalances(address maker, address app, bytes32 strategyHash, address token0, address token1) view returns (uint256, uint256)",
]);

export const moorRegistrarAbi = parseAbi([
	"struct Record { string key; string value; }",
	"function createPosition(address registry, address resolver, string parentName, string label, uint64 expiry, Record[] records) returns (bytes32)",
	"function setupAgent(address registry, address resolver, string parentName, address agent, uint64 expiry) returns (bytes32)",
	"function revokeAgent(address resolver, address agent)",
	"function node(string parentName, string label) pure returns (bytes32)",
]);

/** ENSv2 UniversalResolverV2: one read for any record of any name. */
export const universalResolverAbi = parseAbi([
	"function resolve(bytes name, bytes data) view returns (bytes, address)",
	"function findResolver(bytes name) view returns (address, bytes32, uint256)",
]);

export const permissionedResolverAbi = parseAbi([
	"function text(bytes32 node, string key) view returns (string)",
	"function addr(bytes32 node) view returns (address)",
	"function setText(bytes32 node, string key, string value)",
	"function setAddr(bytes32 node, address addr)",
	"function multicall(bytes[] data) returns (bytes[])",
	"function hasRoles(uint256 resource, uint256 roleBitmap, address account) view returns (bool)",
	"function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
	"function grantRootRoles(uint256 roleBitmap, address account) returns (bool)",
]);

/** ENSv2 PermissionedRegistry / UserRegistry (the ETH registry and the holder's own). */
export const permissionedRegistryAbi = parseAbi([
	"function getSubregistry(string label) view returns (address)",
	"function getResolver(string label) view returns (address)",
	"function getExpiry(uint256 anyId) view returns (uint64)",
	"function ownerOf(uint256 tokenId) view returns (address)",
	"function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
	"function setSubregistry(uint256 anyId, address registry)",
	"function setResolver(uint256 anyId, address resolver)",
	"function grantRootRoles(uint256 roleBitmap, address account) returns (bool)",
	"function unregister(uint256 anyId)",
]);

/** Chainlink AggregatorV3. */
export const aggregatorV3Abi = parseAbi([
	"function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
	"function getRoundData(uint80 roundId) view returns (uint80, int256, uint256, uint256, uint80)",
	"function decimals() view returns (uint8)",
]);
