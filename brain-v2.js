/*
  =========================================================
  RII AI - BRAIN CORE V2
  File: brain-v2.js
  Version: 2.0.0

  Master Brain  = kiến thức nền chung
  User Brain    = bộ não riêng của từng tài khoản
  Robot Brain   = dữ liệu sau này có thể gắn với robot/chip
  =========================================================
*/

(function () {
  "use strict";

  const BRAIN_VERSION = "2.0.0";

  const KNOWLEDGE_CATEGORIES = Object.freeze({
    OBJECT: "object",
    ANIMAL: "animal",
    PLANT: "plant",
    FOOD: "food",
    CLOTHING: "clothing",
    VEHICLE: "vehicle",
    BODY: "body",
    PLACE: "place",

    COLOR: "color",
    SHAPE: "shape",
    NUMBER: "number",

    MATHEMATICS: "mathematics",

    ACTION: "action",
    SOUND: "sound",

    UNKNOWN: "unknown"
  });


  /*
    =====================================================
    TẠO ID
    =====================================================
  */

  function createId(prefix = "rii") {
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
    THỜI GIAN
    =====================================================
  */

  function nowISO() {
    return new Date().toISOString();
  }


  /*
    =====================================================
    MASTER BRAIN
    =====================================================
  */

  function createMasterBrain() {
    return {
      id: "rii-master-brain",

      type: "master",

      version: BRAIN_VERSION,

      enabled: true,

      knowledge: {},

      stats: {
        totalKnowledge: 0,
        lastUpdatedAt: null
      }
    };
  }


  /*
    =====================================================
    USER BRAIN
    MỖI TÀI KHOẢN CÓ MỘT BRAIN RIÊNG
    =====================================================
  */

  function createUserBrain(options = {}) {
    const createdAt = nowISO();

    return {
      id: createId("user-brain"),

      version: BRAIN_VERSION,

      type: "user",

      identity: {
        accountId: options.accountId || "",
        trainerId: options.trainerId || "",
        displayName: options.displayName || "",
        createdAt
      },

      learning: {
        level: 0,
        xp: 0,

        totalLessons: 0,
        totalCorrect: 0,
        totalWrong: 0,

        confidence: 0
      },

      knowledge: {},

      memories: [],

      skills: {},

      preferences: {},

      masterBrain: {
        enabled: true,
        source: "rii-master-brain",
        mode: "reference"
      },

      robot: {
        robotId: "",
        robotName: "Rii",
        hardwareProfile: "",
        linked: false
      },

      createdAt,

      updatedAt: createdAt
    };
  }


  /*
    =====================================================
    TẠO MỘT KIẾN THỨC MỚI
    =====================================================
  */

  function createKnowledgeRecord(data = {}) {
    const createdAt = nowISO();

    const quantity =
      Number.isFinite(Number(data.quantity))
        ? Math.max(1, Number(data.quantity))
        : 1;

    return {
      id: createId("knowledge"),

      version: BRAIN_VERSION,

      input: String(data.input || "").trim(),

      category:
        data.category ||
        KNOWLEDGE_CATEGORIES.UNKNOWN,

      concept: {
        originalName:
          String(data.originalName || "").trim(),

        normalizedEnglish:
          String(data.normalizedEnglish || "").trim(),

        quantity,

        color:
          String(data.color || "").trim(),

        shape:
          String(data.shape || "").trim(),

        attributes:
          Array.isArray(data.attributes)
            ? data.attributes
            : []
      },

      language: {
        detected:
          String(data.detectedLanguage || "").trim(),

        target:
          String(data.targetLanguage || "en").trim(),

        translations:
          data.translations &&
          typeof data.translations === "object"
            ? data.translations
            : {}
      },

      visual: {
        images:
          Array.isArray(data.images)
            ? data.images
            : [],

        embeddings: [],

        recognitionReady: false
      },

      learning: {
        timesSeen: 0,
        timesTaught: 1,

        correct: 0,
        wrong: 0,

        confidence: 0,

        verifiedByTrainer: false
      },

      source: {
        type:
          String(data.sourceType || "user-teach"),

        masterBrainId:
          data.masterBrainId || null
      },

      createdAt,

      updatedAt: createdAt
    };
  }


  /*
    =====================================================
    KIẾN THỨC TOÁN HỌC
    =====================================================
  */

  function createMathRecord(data = {}) {
    const left = Number(data.left);
    const right = Number(data.right);

    const operation =
      String(data.operation || "").trim();

    let answer = null;

    if (
      Number.isFinite(left) &&
      Number.isFinite(right)
    ) {
      switch (operation) {
        case "addition":
          answer = left + right;
          break;

        case "subtraction":
          answer = left - right;
          break;

        case "multiplication":
          answer = left * right;
          break;

        case "division":
          answer =
            right === 0
              ? null
              : left / right;
          break;
      }
    }

    return {
      id: createId("math"),

      version: BRAIN_VERSION,

      category:
        KNOWLEDGE_CATEGORIES.MATHEMATICS,

      input:
        String(data.input || "").trim(),

      math: {
        operation,
        left,
        right,
        answer
      },

      learning: {
        timesSeen: 0,
        correct: 0,
        wrong: 0,
        confidence: 0
      },

      createdAt: nowISO()
    };
  }


  /*
    =====================================================
    THÊM KIẾN THỨC VÀO USER BRAIN
    =====================================================
  */

  function addKnowledge(brain, record) {
    if (
      !brain ||
      typeof brain !== "object"
    ) {
      throw new Error(
        "Brain không hợp lệ."
      );
    }

    if (
      !record ||
      !record.id
    ) {
      throw new Error(
        "Knowledge record không hợp lệ."
      );
    }

    if (!brain.knowledge) {
      brain.knowledge = {};
    }

    brain.knowledge[record.id] =
      record;

    brain.updatedAt =
      nowISO();

    return record;
  }


  /*
    =====================================================
    TÍNH ĐỘ TIN CẬY
    =====================================================
  */

  function calculateConfidence(record) {
    const correct =
      Number(
        record?.learning?.correct || 0
      );

    const wrong =
      Number(
        record?.learning?.wrong || 0
      );

    const total =
      correct + wrong;

    if (total === 0) {
      return 0;
    }

    return Math.round(
      (correct / total) * 100
    );
  }


  /*
    =====================================================
    GHI NHẬN KẾT QUẢ HỌC
    =====================================================
  */

  function recordLearningResult(
    record,
    isCorrect
  ) {
    if (!record?.learning) {
      return record;
    }

    record.learning.timesSeen =
      Number(
        record.learning.timesSeen || 0
      ) + 1;

    if (isCorrect) {
      record.learning.correct =
        Number(
          record.learning.correct || 0
        ) + 1;
    } else {
      record.learning.wrong =
        Number(
          record.learning.wrong || 0
        ) + 1;
    }

    record.learning.confidence =
      calculateConfidence(record);

    record.updatedAt =
      nowISO();

    return record;
  }


  /*
    =====================================================
    ROBOT PROFILE

    Sau này profile này có thể ánh xạ
    sang phần cứng / chip / robot.
    =====================================================
  */

  function linkRobot(
    brain,
    robotData = {}
  ) {
    brain.robot = {
      robotId:
        robotData.robotId ||
        createId("robot"),

      robotName:
        robotData.robotName ||
        "Rii",

      hardwareProfile:
        robotData.hardwareProfile ||
        "",

      linked: true
    };

    brain.updatedAt =
      nowISO();

    return brain.robot;
  }


  /*
    =====================================================
    EXPORT BRAIN

    Sau này dùng để chuyển Brain
    sang server / app / robot.
    =====================================================
  */

  function exportBrain(brain) {
    return JSON.stringify(
      {
        format: "RII-BRAIN",
        version: BRAIN_VERSION,
        exportedAt: nowISO(),
        brain
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

  window.RiiBrainV2 = {
    version: BRAIN_VERSION,

    categories:
      KNOWLEDGE_CATEGORIES,

    createMasterBrain,

    createUserBrain,

    createKnowledgeRecord,

    createMathRecord,

    addKnowledge,

    calculateConfidence,

    recordLearningResult,

    linkRobot,

    exportBrain
  };


  console.log(
    `Rii Brain V${BRAIN_VERSION} ready`
  );
})();