/*
  =========================================================
  RII AI - COMMAND VAULT V2
  File: command-vault-v2.js
  Version: 2.0.0
  =========================================================
*/

(function () {
  "use strict";

  const VAULT_VERSION = "2.0.0";

  const ROLES = Object.freeze({
    ROOT_OWNER: "ROOT_OWNER",
    USER: "USER"
  });

  const COMMAND_SCOPE = Object.freeze({
    MASTER: "master",
    USER: "user",
    SYSTEM: "system"
  });

  const COMMAND_STATUS = Object.freeze({
    DRAFT: "draft",
    TESTING: "testing",
    APPROVED: "approved",
    DEPRECATED: "deprecated"
  });

  const SYSTEM_COMMANDS = Object.freeze([
    "STOP",
    "EMERGENCY_STOP"
  ]);


  /*
    =====================================================
    ID
    =====================================================
  */

  function createId(prefix = "cmd") {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return (
      `${prefix}-` +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2)
    );
  }


  /*
    =====================================================
    TIME
    =====================================================
  */

  function nowISO() {
    return new Date().toISOString();
  }


  /*
    =====================================================
    OWNER CHECK
    =====================================================
  */

  function isRootOwner(actor) {
    return (
      actor &&
      actor.role === ROLES.ROOT_OWNER
    );
  }


  /*
    =====================================================
    CREATE EMPTY VAULT
    =====================================================
  */

  function createCommandVault(options = {}) {
    const createdAt = nowISO();

    return {
      id:
        options.id ||
        createId("vault"),

      version:
        VAULT_VERSION,

      ownerAccountId:
        String(
          options.ownerAccountId ||
          ""
        ),

      ownerRole:
        options.ownerRole ||
        ROLES.USER,

      scope:
        options.scope ||
        (
          options.ownerRole === ROLES.ROOT_OWNER
            ? COMMAND_SCOPE.MASTER
            : COMMAND_SCOPE.USER
        ),

      commands: {},

      history: [],

      stats: {
        totalCommands: 0,
        totalVersions: 0,
        lastUpdatedAt: null
      },

      createdAt,

      updatedAt: createdAt
    };
  }


  /*
    =====================================================
    NORMALIZE COMMAND NAME
    =====================================================
  */

  function normalizeCommandName(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "")
      .slice(0, 80);
  }


  /*
    =====================================================
    PERMISSION
    =====================================================
  */

  function assertCanCreateCommand(
    vault,
    actor
  ) {
    if (!vault) {
      throw new Error(
        "Command Vault không hợp lệ."
      );
    }

    if (!actor) {
      throw new Error(
        "Thiếu thông tin tài khoản."
      );
    }

    /*
      MASTER VAULT:
      chỉ ROOT_OWNER được tạo/sửa.
    */

    if (
      vault.scope ===
      COMMAND_SCOPE.MASTER
    ) {
      if (!isRootOwner(actor)) {
        throw new Error(
          "Chỉ ROOT_OWNER được thay đổi Master Command Vault."
        );
      }

      return true;
    }

    /*
      USER VAULT:
      chỉ đúng chủ tài khoản.
    */

    if (
      vault.scope ===
      COMMAND_SCOPE.USER
    ) {
      if (
        String(actor.accountId || "") !==
        String(vault.ownerAccountId || "")
      ) {
        throw new Error(
          "Không có quyền thay đổi Command Vault của tài khoản khác."
        );
      }

      return true;
    }

    throw new Error(
      "Command Vault scope không hợp lệ."
    );
  }


  /*
    =====================================================
    CREATE COMMAND
    =====================================================
  */

  function createCommand(
    vault,
    actor,
    data = {}
  ) {
    assertCanCreateCommand(
      vault,
      actor
    );

    const name =
      normalizeCommandName(
        data.name
      );

    if (!name) {
      throw new Error(
        "Tên command không hợp lệ."
      );
    }

    if (
      SYSTEM_COMMANDS.includes(name) &&
      !isRootOwner(actor)
    ) {
      throw new Error(
        "Command hệ thống chỉ ROOT_OWNER được quản lý."
      );
    }

    /*
      Nếu command đã tồn tại:
      không ghi đè.
      Phải dùng createNewVersion().
    */

    if (vault.commands[name]) {
      throw new Error(
        `Command ${name} đã tồn tại. Hãy tạo version mới.`
      );
    }

    const commandId =
      createId("command");

    const createdAt =
      nowISO();

    const versionRecord = {
      version: 1,

      code:
        String(
          data.code ||
          ""
        ),

      description:
        String(
          data.description ||
          ""
        ),

      parameters:
        Array.isArray(
          data.parameters
        )
          ? data.parameters
          : [],

      safety:
        {
          requiresConfirmation:
            Boolean(
              data.requiresConfirmation
            ),

          emergencyStopAllowed:
            true
        },

      simulator: {
        tested: false,
        passed: false,
        lastTestAt: null,
        notes: ""
      },

      createdBy:
        String(
          actor.accountId ||
          ""
        ),

      createdAt
    };

    const command = {
      id:
        commandId,

      name,

      scope:
        vault.scope,

      ownerAccountId:
        vault.ownerAccountId,

      protected:
        SYSTEM_COMMANDS.includes(
          name
        ),

      activeVersion:
        1,

      status:
        COMMAND_STATUS.DRAFT,

      versions: {
        1:
          versionRecord
      },

      createdAt,

      updatedAt:
        createdAt
    };

    vault.commands[name] =
      command;

    vault.stats.totalCommands += 1;

    vault.stats.totalVersions += 1;

    vault.stats.lastUpdatedAt =
      createdAt;

    vault.updatedAt =
      createdAt;

    vault.history.push({
      id:
        createId("history"),

      type:
        "COMMAND_CREATED",

      command:
        name,

      version:
        1,

      actor:
        String(
          actor.accountId ||
          ""
        ),

      createdAt
    });

    return command;
  }


  /*
    =====================================================
    CREATE NEW VERSION

    Không xóa version cũ.
    =====================================================
  */

  function createNewVersion(
    vault,
    actor,
    commandName,
    changes = {}
  ) {
    assertCanCreateCommand(
      vault,
      actor
    );

    const name =
      normalizeCommandName(
        commandName
      );

    const command =
      vault.commands[name];

    if (!command) {
      throw new Error(
        `Không tìm thấy command ${name}.`
      );
    }

    if (
      command.protected &&
      !isRootOwner(actor)
    ) {
      throw new Error(
        "Command được bảo vệ."
      );
    }

    const previousVersion =
      command.activeVersion;

    const previous =
      command.versions[
        previousVersion
      ];

    const nextVersion =
      Math.max(
        ...Object.keys(
          command.versions
        ).map(Number)
      ) + 1;

    const createdAt =
      nowISO();

    command.versions[
      nextVersion
    ] = {
      version:
        nextVersion,

      code:
        changes.code !== undefined
          ? String(changes.code)
          : previous.code,

      description:
        changes.description !== undefined
          ? String(
              changes.description
            )
          : previous.description,

      parameters:
        Array.isArray(
          changes.parameters
        )
          ? changes.parameters
          : previous.parameters,

      safety: {
        ...previous.safety,

        ...(
          changes.safety &&
          typeof changes.safety ===
          "object"
            ? changes.safety
            : {}
        )
      },

      simulator: {
        tested: false,
        passed: false,
        lastTestAt: null,
        notes: ""
      },

      createdBy:
        String(
          actor.accountId ||
          ""
        ),

      createdAt
    };

    command.activeVersion =
      nextVersion;

    command.status =
      COMMAND_STATUS.DRAFT;

    command.updatedAt =
      createdAt;

    vault.stats.totalVersions +=
      1;

    vault.stats.lastUpdatedAt =
      createdAt;

    vault.updatedAt =
      createdAt;

    vault.history.push({
      id:
        createId("history"),

      type:
        "VERSION_CREATED",

      command:
        name,

      fromVersion:
        previousVersion,

      toVersion:
        nextVersion,

      actor:
        String(
          actor.accountId ||
          ""
        ),

      createdAt
    });

    return command.versions[
      nextVersion
    ];
  }


  /*
    =====================================================
    GET ACTIVE VERSION
    =====================================================
  */

  function getActiveCommand(
    vault,
    commandName
  ) {
    const name =
      normalizeCommandName(
        commandName
      );

    const command =
      vault?.commands?.[
        name
      ];

    if (!command) {
      return null;
    }

    return {
      ...command,

      active:
        command.versions[
          command.activeVersion
        ]
    };
  }


  /*
    =====================================================
    MARK SIMULATOR RESULT
    =====================================================
  */

  function recordSimulationResult(
    vault,
    actor,
    commandName,
    result = {}
  ) {
    assertCanCreateCommand(
      vault,
      actor
    );

    const command =
      getActiveCommand(
        vault,
        commandName
      );

    if (!command) {
      throw new Error(
        "Command không tồn tại."
      );
    }

    const active =
      vault.commands[
        command.name
      ].versions[
        command.activeVersion
      ];

    active.simulator = {
      tested: true,

      passed:
        Boolean(
          result.passed
        ),

      lastTestAt:
        nowISO(),

      notes:
        String(
          result.notes ||
          ""
        )
    };

    vault.history.push({
      id:
        createId("history"),

      type:
        "SIMULATION_RESULT",

      command:
        command.name,

      version:
        command.activeVersion,

      passed:
        active.simulator.passed,

      actor:
        String(
          actor.accountId ||
          ""
        ),

      createdAt:
        nowISO()
    });

    return active.simulator;
  }


  /*
    =====================================================
    APPROVE VERSION
    =====================================================
  */

  function approveCommand(
    vault,
    actor,
    commandName
  ) {
    assertCanCreateCommand(
      vault,
      actor
    );

    const name =
      normalizeCommandName(
        commandName
      );

    const command =
      vault.commands[name];

    if (!command) {
      throw new Error(
        "Command không tồn tại."
      );
    }

    const active =
      command.versions[
        command.activeVersion
      ];

    if (
      !active.simulator.tested ||
      !active.simulator.passed
    ) {
      throw new Error(
        "Command phải vượt qua Simulator trước khi Approved."
      );
    }

    command.status =
      COMMAND_STATUS.APPROVED;

    command.updatedAt =
      nowISO();

    vault.history.push({
      id:
        createId("history"),

      type:
        "COMMAND_APPROVED",

      command:
        name,

      version:
        command.activeVersion,

      actor:
        String(
          actor.accountId ||
          ""
        ),

      createdAt:
        nowISO()
    });

    return command;
  }


  /*
    =====================================================
    ROLLBACK

    Không xóa version mới.
    Chỉ chuyển activeVersion.
    =====================================================
  */

  function rollbackCommand(
    vault,
    actor,
    commandName,
    targetVersion
  ) {
    assertCanCreateCommand(
      vault,
      actor
    );

    const name =
      normalizeCommandName(
        commandName
      );

    const command =
      vault.commands[name];

    if (!command) {
      throw new Error(
        "Command không tồn tại."
      );
    }

    const version =
      Number(
        targetVersion
      );

    if (
      !command.versions[
        version
      ]
    ) {
      throw new Error(
        "Version không tồn tại."
      );
    }

    const previousVersion =
      command.activeVersion;

    command.activeVersion =
      version;

    command.updatedAt =
      nowISO();

    vault.history.push({
      id:
        createId("history"),

      type:
        "ROLLBACK",

      command:
        name,

      fromVersion:
        previousVersion,

      toVersion:
        version,

      actor:
        String(
          actor.accountId ||
          ""
        ),

      createdAt:
        nowISO()
    });

    return getActiveCommand(
      vault,
      name
    );
  }


  /*
    =====================================================
    LIST
    =====================================================
  */

  function listCommands(vault) {
    if (!vault?.commands) {
      return [];
    }

    return Object.values(
      vault.commands
    )
    .map(
      command => ({
        id:
          command.id,

        name:
          command.name,

        scope:
          command.scope,

        protected:
          command.protected,

        activeVersion:
          command.activeVersion,

        status:
          command.status,

        versions:
          Object.keys(
            command.versions
          ).length,

        updatedAt:
          command.updatedAt
      })
    );
  }


  /*
    =====================================================
    EXPORT

    Dùng về sau cho simulator /
    server / robot controller.
    =====================================================
  */

  function exportVault(vault) {
    return JSON.stringify(
      {
        format:
          "RII-COMMAND-VAULT",

        version:
          VAULT_VERSION,

        exportedAt:
          nowISO(),

        vault
      },
      null,
      2
    );
  }


  /*
    =====================================================
    PUBLIC API
    =====================================================
  */

  window.RiiCommandVaultV2 = {
    version:
      VAULT_VERSION,

    roles:
      ROLES,

    scope:
      COMMAND_SCOPE,

    status:
      COMMAND_STATUS,

    systemCommands:
      SYSTEM_COMMANDS,

    createCommandVault,

    createCommand,

    createNewVersion,

    getActiveCommand,

    recordSimulationResult,

    approveCommand,

    rollbackCommand,

    listCommands,

    exportVault
  };


  console.log(
    `Rii Command Vault V${VAULT_VERSION} ready`
  );

})();