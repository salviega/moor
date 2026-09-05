// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { UserRegistry } from "@ensdomains/contracts-v2/registry/UserRegistry.sol";
import { IPermissionedRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import { IRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import { RegistryRolesLib } from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import { PermissionedResolver } from "@ensdomains/contracts-v2/resolver/PermissionedResolver.sol";
import { PermissionedResolverLib } from "@ensdomains/contracts-v2/resolver/libraries/PermissionedResolverLib.sol";
import { LabelStore } from "@ensdomains/contracts-v2/utils/LabelStore.sol";
import { IContractNamer } from "@ensdomains/contracts-v2/reverse-registrar/interfaces/IContractNamer.sol";
import { ILabelStore } from "@ensdomains/contracts-v2/utils/interfaces/ILabelStore.sol";
import { NameCoder } from "@ens/contracts/utils/NameCoder.sol";

import { MoorRegistrar, MoorRoles } from "../src/MoorRegistrar.sol";

/// @notice Phase 2 (07): the agent's permission boundary, each promise of 05 §7 with a test that tries to
/// break it. The holder's registry and resolver are the real ENSv2 contracts behind ERC1967 proxies, as on
/// Sepolia; the parent name is a string because records are keyed by namehash, not by the registry tree.
contract MoorRegistrarTest is Test {
    string internal constant PARENT = "salviega.eth";
    string internal constant LABEL = "btc-dip";
    uint64 internal constant DEADLINE = 1_800_000_000;
    address internal constant NAMER = address(0xAA0);

    address internal holder = vm.addr(0xd7a4);
    address internal agent = vm.addr(0xa6e7);
    address internal stranger = vm.addr(0xbad);

    MoorRegistrar internal registrar;
    UserRegistry internal registry;
    PermissionedResolver internal resolver;
    bytes32 internal positionNode;
    bytes32 internal agentNode;

    function setUp() public {
        vm.warp(DEADLINE - 30 days);
        registrar = new MoorRegistrar();

        LabelStore labelStore = new LabelStore(IContractNamer(NAMER));
        UserRegistry registryImpl = new UserRegistry(ILabelStore(address(labelStore)), NAMER);
        registry = UserRegistry(
            address(
                new ERC1967Proxy(
                    address(registryImpl),
                    abi.encodeCall(UserRegistry.initialize, (holder, MoorRoles.HOLDER_REGISTRY_ROOT))
                )
            )
        );
        PermissionedResolver resolverImpl = new PermissionedResolver(NAMER);
        bytes[] memory noSetters;
        resolver = PermissionedResolver(
            address(
                new ERC1967Proxy(
                    address(resolverImpl),
                    abi.encodeCall(
                        PermissionedResolver.initialize,
                        (
                            holder,
                            PermissionedResolverLib.ROLE_SET_TEXT | PermissionedResolverLib.ROLE_SET_TEXT_ADMIN
                                | PermissionedResolverLib.ROLE_SET_ADDR | PermissionedResolverLib.ROLE_SET_ADDR_ADMIN,
                            noSetters
                        )
                    )
                )
            )
        );

        // First-time setup (04 §4.0): the holder delegates exactly what the registrar needs.
        vm.startPrank(holder);
        registry.grantRootRoles(MoorRoles.REGISTRAR_ON_REGISTRY, address(registrar));
        resolver.grantRootRoles(MoorRoles.REGISTRAR_ON_RESOLVER, address(registrar));
        vm.stopPrank();

        positionNode = NameCoder.namehash(NameCoder.encode(string.concat(LABEL, ".", PARENT)), 0);
        agentNode = NameCoder.namehash(NameCoder.encode(string.concat("agent.", PARENT)), 0);
    }

    function _records() internal pure returns (MoorRegistrar.Record[] memory r) {
        r = new MoorRegistrar.Record[](3);
        r[0] = MoorRegistrar.Record("moor.version", "1");
        r[1] = MoorRegistrar.Record(
            "moor.strategy", "11155111:0x35a92a7debbc1ba1edecc1d42e08010af7001608847186b40dc6d10b3670b477"
        );
        r[2] = MoorRegistrar.Record("moor.side", "buy");
    }

    function _createPosition() internal returns (bytes32 node) {
        vm.prank(holder);
        node = registrar.createPosition(
            IPermissionedRegistry(address(registry)), resolver, PARENT, LABEL, DEADLINE, _records()
        );
    }

    function _setupAgent() internal returns (bytes32 node) {
        vm.prank(holder);
        node =
            registrar.setupAgent(IPermissionedRegistry(address(registry)), resolver, PARENT, agent, DEADLINE + 365 days);
    }

    // ---------------------------------------------------------------- the position

    function test_createPosition_registersNameOwnedByHolderWithRecords() public {
        bytes32 node = _createPosition();
        assertEq(node, positionNode, "node = namehash(btc-dip.salviega.eth)");
        assertEq(registry.findOwner(LABEL), holder, "holder owns the name");
        assertEq(registry.findExpiry(LABEL), DEADLINE, "expiry = deadline");
        assertEq(registry.getResolver(LABEL), address(resolver), "resolver set");
        assertEq(resolver.addr(node), holder, "addr -> holder");
        assertEq(resolver.text(node, "moor.strategy"), _records()[1].value, "moor.strategy written");
        assertEq(resolver.text(node, "moor.side"), "buy");
    }

    function test_createPosition_onlyTheHolder() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(MoorRegistrar.MoorNotRegistryAdmin.selector, address(registry), stranger)
        );
        registrar.createPosition(
            IPermissionedRegistry(address(registry)), resolver, PARENT, LABEL, DEADLINE, _records()
        );
    }

    function test_createPosition_refusesAgentKeysAndForeignKeys() public {
        MoorRegistrar.Record[] memory bad = new MoorRegistrar.Record[](1);
        bad[0] = MoorRegistrar.Record("moor.agent.proposal", "x");
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(MoorRegistrar.MoorRecordKeyNotAllowed.selector, "moor.agent.proposal"));
        registrar.createPosition(IPermissionedRegistry(address(registry)), resolver, PARENT, LABEL, DEADLINE, bad);

        bad[0] = MoorRegistrar.Record("avatar", "x");
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(MoorRegistrar.MoorRecordKeyNotAllowed.selector, "avatar"));
        registrar.createPosition(IPermissionedRegistry(address(registry)), resolver, PARENT, LABEL, DEADLINE, bad);
    }

    function test_position_isNotTransferable() public {
        _createPosition();
        uint256 tokenId = registry.findTokenId(LABEL);
        assertFalse(registry.hasRoles(tokenId, RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, holder), "no transfer admin");
        vm.prank(holder);
        vm.expectRevert(); // TransferDisallowed(tokenId, holder)
        registry.safeTransferFrom(holder, stranger, tokenId, 1, "");
        assertEq(registry.findOwner(LABEL), holder);
    }

    function test_holder_canCloseThePosition() public {
        _createPosition();
        uint256 tokenId = registry.findTokenId(LABEL);
        vm.prank(holder);
        registry.unregister(tokenId);
        assertEq(registry.findOwner(LABEL), address(0), "name gone");
        assertEq(registry.getResolver(LABEL), address(0), "no resolver once expired");
    }

    function test_position_expiresWithTheDeadline() public {
        _createPosition();
        vm.warp(uint256(DEADLINE) + 1);
        assertEq(registry.findOwner(LABEL), address(0), "expired -> no owner");
        assertEq(registry.getResolver(LABEL), address(0));
    }

    // ---------------------------------------------------------------- the agent

    function test_setupAgent_identityAndExactlyOneCapability() public {
        bytes32 node = _setupAgent();
        assertEq(node, agentNode);
        assertEq(registry.findOwner("agent"), holder, "the holder owns the agent's name");
        assertEq(resolver.addr(node), agent, "addr -> the agent key");

        _createPosition();
        // The one thing it can do: moor.agent.* on any name of this resolver — the position included.
        vm.startPrank(agent);
        resolver.setText(positionNode, "moor.agent.checkedAt", "1700000000");
        resolver.setText(positionNode, "moor.agent.proposal", "none");
        resolver.setText(agentNode, "moor.agent.state", "alive");
        vm.stopPrank();
        assertEq(resolver.text(positionNode, "moor.agent.proposal"), "none");
    }

    function test_agent_cannotTouchThePositionsOwnRecords() public {
        _setupAgent();
        _createPosition();
        vm.startPrank(agent);
        vm.expectRevert();
        resolver.setText(positionNode, "moor.strategy", "11155111:0xdead");
        vm.expectRevert();
        resolver.setText(positionNode, "moor.side", "sell");
        vm.expectRevert();
        resolver.setAddr(positionNode, agent);
        vm.expectRevert();
        resolver.setContenthash(positionNode, hex"00");
        vm.stopPrank();
        assertEq(resolver.text(positionNode, "moor.strategy"), _records()[1].value, "unchanged");
    }

    function test_agent_cannotGrantDelegateOrClearAnything() public {
        _setupAgent();
        _createPosition();
        vm.startPrank(agent);
        vm.expectRevert();
        resolver.authorizeTextRoles(NameCoder.encode(""), "moor.strategy", agent, true);
        vm.expectRevert();
        resolver.grantRootRoles(PermissionedResolverLib.ROLE_SET_TEXT, agent);
        vm.expectRevert();
        resolver.clearRecords(positionNode);
        vm.stopPrank();
    }

    function test_agent_hasNoRoleOnTheRegistry() public {
        _setupAgent();
        _createPosition();
        uint256 tokenId = registry.findTokenId(LABEL);
        assertEq(registry.roles(tokenId, agent), 0, "no roles on the position token");
        assertFalse(registry.hasRootRoles(RegistryRolesLib.ROLE_REGISTRAR, agent));
        vm.startPrank(agent);
        vm.expectRevert();
        registry.unregister(tokenId);
        vm.expectRevert();
        registry.renew(tokenId, DEADLINE + 1 days);
        vm.expectRevert();
        registry.setResolver(tokenId, agent);
        vm.expectRevert();
        registry.register("evil", agent, IRegistry(address(0)), address(resolver), 0, DEADLINE);
        vm.stopPrank();
        assertEq(registry.findOwner(LABEL), holder);
    }

    /// @dev What a judge can check with `cast call hasRoles(...)`: the agent's roles are exactly the eight keys.
    function test_agent_hasRolesIsFalseForEverythingButItsKeys() public {
        _setupAgent();
        string[8] memory keys = registrar.agentKeys();
        for (uint256 i; i < keys.length; ++i) {
            uint256 anyNameKey = PermissionedResolverLib.resource(bytes32(0), PermissionedResolverLib.partHash(keys[i]));
            assertTrue(resolver.hasRoles(anyNameKey, PermissionedResolverLib.ROLE_SET_TEXT, agent), keys[i]);
        }
        uint256 strategyKey =
            PermissionedResolverLib.resource(bytes32(0), PermissionedResolverLib.partHash("moor.strategy"));
        assertFalse(resolver.hasRoles(strategyKey, PermissionedResolverLib.ROLE_SET_TEXT, agent), "moor.strategy");
        assertFalse(resolver.hasRootRoles(PermissionedResolverLib.ROLE_SET_TEXT, agent), "no node-wide text role");
        assertFalse(resolver.hasRootRoles(PermissionedResolverLib.ROLE_SET_ADDR, agent), "no addr role");
        assertEq(
            resolver.roles(PermissionedResolverLib.resource(positionNode, bytes32(0)), agent),
            0,
            "nothing on the position node"
        );
    }

    function test_revokeAgent_isTheKillSwitchAndOnlyTheHoldersToPull() public {
        _setupAgent();
        _createPosition();

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(MoorRegistrar.MoorNotResolverAdmin.selector, address(resolver), stranger)
        );
        registrar.revokeAgent(resolver, agent);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(MoorRegistrar.MoorNotResolverAdmin.selector, address(resolver), agent));
        registrar.revokeAgent(resolver, agent);

        vm.prank(holder);
        registrar.revokeAgent(resolver, agent);

        vm.prank(agent);
        vm.expectRevert();
        resolver.setText(positionNode, "moor.agent.proposal", "widen");
        // The position is untouched by the revocation.
        assertEq(registry.findOwner(LABEL), holder);
        assertEq(resolver.text(positionNode, "moor.strategy"), _records()[1].value);
    }

    // ---------------------------------------------------------------- the holder's own kill switch on Moor

    function test_holder_canSwitchMoorOff() public {
        vm.startPrank(holder);
        registry.revokeRootRoles(MoorRoles.REGISTRAR_ON_REGISTRY, address(registrar));
        vm.stopPrank();
        vm.prank(holder);
        vm.expectRevert();
        registrar.createPosition(
            IPermissionedRegistry(address(registry)), resolver, PARENT, LABEL, DEADLINE, _records()
        );
    }
}
