// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPermissionedRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import { IRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import { RegistryRolesLib } from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import { PermissionedResolver } from "@ensdomains/contracts-v2/resolver/PermissionedResolver.sol";
import { PermissionedResolverLib } from "@ensdomains/contracts-v2/resolver/libraries/PermissionedResolverLib.sol";
import { NameCoder } from "@ens/contracts/utils/NameCoder.sol";

/// @title MoorRoles
/// @notice The role bitmaps Moor hands out, in one place so scripts, tests and the Live App agree (05 §7).
library MoorRoles {
    /// @dev The nine base roles of RegistryRolesLib. Kept separate from HOLDER_REGISTRY_ROOT because one
    /// eighteen-term expression is "stack too deep" for `forge coverage --ir-minimum`.
    uint256 internal constant REGISTRY_BASE_ROLES = RegistryRolesLib.ROLE_REGISTRAR
        | RegistryRolesLib.ROLE_REGISTER_RESERVED | RegistryRolesLib.ROLE_SET_PARENT | RegistryRolesLib.ROLE_UNREGISTER
        | RegistryRolesLib.ROLE_RENEW | RegistryRolesLib.ROLE_SET_SUBREGISTRY | RegistryRolesLib.ROLE_SET_RESOLVER
        | RegistryRolesLib.ROLE_SET_URI | RegistryRolesLib.ROLE_UPGRADE;

    /// @dev Same nine roles plus their admin variants (`role << 128` in EAC): what the holder gets on the root of their
    /// own UserRegistry at first-time setup, so they can delegate `ROLE_REGISTRAR` to MoorRegistrar and take it back.
    uint256 internal constant HOLDER_REGISTRY_ROOT = REGISTRY_BASE_ROLES | (REGISTRY_BASE_ROLES << 128);

    /// @dev The resolver's record roles (PermissionedResolverLib), without ROLE_CAN_NAME (the namer's).
    uint256 internal constant RESOLVER_BASE_ROLES = PermissionedResolverLib.ROLE_SET_ADDR
        | PermissionedResolverLib.ROLE_SET_TEXT | PermissionedResolverLib.ROLE_SET_CONTENTHASH
        | PermissionedResolverLib.ROLE_SET_PUBKEY | PermissionedResolverLib.ROLE_SET_ABI
        | PermissionedResolverLib.ROLE_SET_INTERFACE | PermissionedResolverLib.ROLE_SET_NAME
        | PermissionedResolverLib.ROLE_SET_ALIAS | PermissionedResolverLib.ROLE_CLEAR
        | PermissionedResolverLib.ROLE_SET_DATA | PermissionedResolverLib.ROLE_UPGRADE;

    /// @dev What the holder gets on the root of their own PermissionedResolver: every record role and its admin.
    /// The holder needs their own resolver: the one app.ens.dev creates at registration keeps its root roles on the
    /// wallet that registered, and transferring the name does not move them.
    uint256 internal constant HOLDER_RESOLVER_ROOT = RESOLVER_BASE_ROLES | (RESOLVER_BASE_ROLES << 128);

    /// @dev What MoorRegistrar needs on the holder's registry root: to create names, nothing else.
    uint256 internal constant REGISTRAR_ON_REGISTRY = RegistryRolesLib.ROLE_REGISTRAR;

    /// @dev What MoorRegistrar needs on the holder's resolver root: write records, and hand out
    /// per-key text roles to the agent (ROLE_SET_TEXT_ADMIN is what `authorizeTextRoles` checks).
    uint256 internal constant REGISTRAR_ON_RESOLVER = PermissionedResolverLib.ROLE_SET_TEXT
        | PermissionedResolverLib.ROLE_SET_ADDR | PermissionedResolverLib.ROLE_SET_TEXT_ADMIN;

    /// @dev What the holder owns on each position (and on the agent's name): resolver, close, renew — and the
    /// admin variants so they can delegate. **No `ROLE_CAN_TRANSFER_ADMIN`**: a position is bound to the wallet
    /// whose tokens Aqua uses, so the token is not transferable (04 §6).
    uint256 internal constant NAME_OWNER = RegistryRolesLib.ROLE_SET_RESOLVER | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN
        | RegistryRolesLib.ROLE_UNREGISTER | RegistryRolesLib.ROLE_UNREGISTER_ADMIN | RegistryRolesLib.ROLE_RENEW
        | RegistryRolesLib.ROLE_RENEW_ADMIN;
}

/// @title MoorRegistrar
/// @notice Creates positions as ENSv2 subnames under the holder's own name, and gives the agent exactly one
/// capability: writing `moor.agent.*` text records (05 §7). Stateless and shared: every call names the holder's
/// registry and resolver, and is accepted only from an account that is root admin of that registry — the
/// holder. Nothing here touches Aqua or any token.
///
/// First-time setup, by the holder (04 §4.0): deploy a `UserRegistry` proxy (anyone can pay for it),
/// `ETHRegistry.setSubregistry(<holder name>, registry)`, `registry.grantRootRoles(REGISTRAR_ON_REGISTRY, this)`,
/// `resolver.grantRootRoles(REGISTRAR_ON_RESOLVER, this)`, then `setupAgent`. Revoking either root grant
/// switches Moor off for that holder without touching any position.
contract MoorRegistrar {
    error MoorNotRegistryAdmin(address registry, address account);
    error MoorNotResolverAdmin(address resolver, address account);
    error MoorRecordKeyNotAllowed(string key);
    error MoorEmptyLabel();

    event PositionCreated(
        address indexed holder, address indexed registry, bytes32 indexed node, string label, uint64 expiry
    );
    event AgentSetUp(address indexed holder, address indexed resolver, address indexed agent, bytes32 node);
    event AgentRevoked(address indexed holder, address indexed resolver, address indexed agent);

    struct Record {
        string key;
        string value;
    }

    /// @notice The agent's label under the holder's name: `agent.<holder>.eth`.
    string public constant AGENT_LABEL = "agent";

    /// @notice The only text keys the agent may write, on any name of the holder's resolver (04 §3).
    function agentKeys() public pure returns (string[8] memory) {
        return [
            "moor.agent.checkedAt",
            "moor.agent.price",
            "moor.agent.state",
            "moor.agent.filled",
            "moor.agent.fees",
            "moor.agent.proposal",
            "moor.agent.reasoning",
            "moor.agent.simulation"
        ];
    }

    // ------------------------------------------------------------------ positions

    /// @notice Registers `<label>.<parentName>` to the caller with the position's records (04 §3).
    /// @param registry The holder's UserRegistry (the subregistry of `parentName`)
    /// @param resolver The holder's PermissionedResolver
    /// @param parentName The holder's name, e.g. "salviega.eth"
    /// @param label The position label, e.g. "btc-dip"
    /// @param expiry Unix seconds. Mirrors the program's deadline (05 §7): when the strategy dies, so does the name
    /// @param records `moor.*` text records written by the holder. `moor.agent.*` keys are refused here: those
    /// belong to the agent, and keeping the two namespaces apart is what makes the permission boundary legible
    function createPosition(
        IPermissionedRegistry registry,
        PermissionedResolver resolver,
        string calldata parentName,
        string calldata label,
        uint64 expiry,
        Record[] calldata records
    )
        external
        returns (bytes32 positionNode)
    {
        _requireHolder(registry, resolver);
        if (bytes(label).length == 0) {
            revert MoorEmptyLabel();
        }

        positionNode = _node(parentName, label);
        registry.register(label, msg.sender, IRegistry(address(0)), address(resolver), MoorRoles.NAME_OWNER, expiry);
        resolver.setAddr(positionNode, msg.sender);
        for (uint256 i; i < records.length; ++i) {
            _requireHolderKey(records[i].key);
            resolver.setText(positionNode, records[i].key, records[i].value);
        }
        emit PositionCreated(msg.sender, address(registry), positionNode, label, expiry);
    }

    // ------------------------------------------------------------------ agent

    /// @notice Gives the agent an identity (`agent.<parentName>`, addr = agent) and its single capability:
    /// `ROLE_SET_TEXT` on each `moor.agent.*` key, for any name of the holder's resolver. Nothing on the
    /// registry, nothing on other keys, no admin roles (05 §7).
    function setupAgent(
        IPermissionedRegistry registry,
        PermissionedResolver resolver,
        string calldata parentName,
        address agent,
        uint64 expiry
    )
        external
        returns (bytes32 agentNode)
    {
        _requireHolder(registry, resolver);

        agentNode = _node(parentName, AGENT_LABEL);
        registry.register(
            AGENT_LABEL, msg.sender, IRegistry(address(0)), address(resolver), MoorRoles.NAME_OWNER, expiry
        );
        resolver.setAddr(agentNode, agent);
        _authorizeAgent(resolver, agent, true);
        emit AgentSetUp(msg.sender, address(resolver), agent, agentNode);
    }

    /// @notice The kill switch (04 §4.6): the agent loses its only capability. Positions keep working.
    function revokeAgent(PermissionedResolver resolver, address agent) external {
        if (!resolver.hasRootRoles(PermissionedResolverLib.ROLE_SET_TEXT_ADMIN, msg.sender)) {
            revert MoorNotResolverAdmin(address(resolver), msg.sender);
        }
        _authorizeAgent(resolver, agent, false);
        emit AgentRevoked(msg.sender, address(resolver), agent);
    }

    // ------------------------------------------------------------------ views

    /// @notice The namehash of `<label>.<parentName>` — what the resolver keys records by.
    function node(string calldata parentName, string calldata label) external pure returns (bytes32) {
        return _node(parentName, label);
    }

    // ------------------------------------------------------------------ internals

    function _requireHolder(IPermissionedRegistry registry, PermissionedResolver resolver) internal view {
        if (!registry.hasRootRoles(RegistryRolesLib.ROLE_REGISTRAR_ADMIN, msg.sender)) {
            revert MoorNotRegistryAdmin(address(registry), msg.sender);
        }
        if (!resolver.hasRootRoles(PermissionedResolverLib.ROLE_SET_TEXT_ADMIN, msg.sender)) {
            revert MoorNotResolverAdmin(address(resolver), msg.sender);
        }
    }

    /// @dev `moor.` prefix, and never the agent's namespace.
    function _requireHolderKey(string calldata key) internal pure {
        bytes calldata k = bytes(key);
        bool moor = k.length > 5 && k[0] == "m" && k[1] == "o" && k[2] == "o" && k[3] == "r" && k[4] == ".";
        bool agent = k.length > 11 && moor && k[5] == "a" && k[6] == "g" && k[7] == "e" && k[8] == "n" && k[9] == "t"
            && k[10] == ".";
        if (!moor || agent) {
            revert MoorRecordKeyNotAllowed(key);
        }
    }

    function _authorizeAgent(PermissionedResolver resolver, address agent, bool grant) internal {
        bytes memory anyName = NameCoder.encode(""); // hex"00": every name of this resolver
        string[8] memory keys = agentKeys();
        for (uint256 i; i < keys.length; ++i) {
            resolver.authorizeTextRoles(anyName, keys[i], agent, grant);
        }
    }

    function _node(string calldata parentName, string memory label) internal pure returns (bytes32) {
        return NameCoder.namehash(NameCoder.encode(string.concat(label, ".", parentName)), 0);
    }
}
