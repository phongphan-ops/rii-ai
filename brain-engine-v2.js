/*
  =========================================================
  RII AI - BRAIN ENGINE V2
  File: brain-engine-v2.js
  Version: 2.0.0
  =========================================================
*/

(function () {
  "use strict";

  const ENGINE_VERSION = "2.0.0";


  /*
    =====================================================
    CHUẨN HÓA TEXT
    =====================================================
  */

  function cleanText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
  }


  /*
    =====================================================
    NHẬN DIỆN PHÉP TOÁN CƠ BẢN

    Hỗ trợ:
    2 + 3
    5 - 2
    4 x 3
    6 × 2
    8 / 4

    và:
    2 cộng 3
    5 trừ 2
    4 nhân 3
    8 chia 2
    =====================================================
  */

  function parseMath(input) {
    const text = cleanText(input)
      .toLowerCase();

    const normalized = text
      .replace(/\bcộng\b/g, "+")
      .replace(/\bplus\b/g, "+")
      .replace(/\btrừ\b/g, "-")
      .replace(/\bminus\b/g, "-")
      .replace(/\bnhân\b/g, "*")
      .replace(/\blần\b/g, "*")
      .replace(/[x×]/g, "*")
      .replace(/\bchia\b/g, "/")
      .replace(/÷/g, "/");

    const match = normalized.match(
      /^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/
    );

    if (!match) {
      return null;
    }

    const left = Number(match[1]);
    const operator = match[2];
    const right = Number(match[3]);

    let operation = "";
    let answer = null;

    switch (operator) {
      case "+":
        operation = "addition";
        answer = left + right;
        break;

      case "-":
        operation = "subtraction";
        answer = left - right;
        break;

      case "*":
        operation = "multiplication";
        answer = left * right;
        break;

      case "/":
        operation = "division";

        answer =
          right === 0
            ? null
            : left / right;

        break;
    }

    return {
      type: "mathematics",
      category: "mathematics",

      math: {
        operation,
        operator,
        left,
        right,
        answer,
        valid: answer !== null
      }
    };
  }


  /*
    =====================================================
    TÁCH SỐ LƯỢNG

    Ví dụ:
    "3 con mèo trắng"

    =>
    quantity: 3
    remainingText: "con mèo trắng"
    =====================================================
  */

  function extractQuantity(input) {
    const text = cleanText(input);

    const match =
      text.match(
        /^(\d+)\s+(.+)$/
      );

    if (!match) {
      return {
        quantity: 1,
        remainingText: text,
        explicitQuantity: false
      };
    }

    return {
      quantity:
        Math.max(
          1,
          Number(match[1])
        ),

      remainingText:
        cleanText(match[2]),

      explicitQuantity: true
    };
  }


  /*
    =====================================================
    NHẬN DIỆN MÀU CƠ BẢN

    Đây chỉ là parser local.
    Worker AI V2 sau này sẽ hiểu
    màu sắc ở mọi ngôn ngữ.
    =====================================================
  */

  function detectBasicColor(input) {
    const text =
      cleanText(input)
        .toLowerCase();

    const colors = [
      ["trắng", "white"],
      ["đen", "black"],
      ["đỏ", "red"],
      ["xanh lá", "green"],
      ["xanh dương", "blue"],
      ["xanh", "blue"],
      ["vàng", "yellow"],
      ["cam", "orange"],
      ["tím", "purple"],
      ["hồng", "pink"],
      ["nâu", "brown"],
      ["xám", "gray"],

      ["white", "white"],
      ["black", "black"],
      ["red", "red"],
      ["green", "green"],
      ["blue", "blue"],
      ["yellow", "yellow"],
      ["orange", "orange"],
      ["purple", "purple"],
      ["pink", "pink"],
      ["brown", "brown"],
      ["gray", "gray"],
      ["grey", "gray"]
    ];

    for (const [word, english] of colors) {
      if (
        text.includes(word)
      ) {
        return {
          original: word,
          english
        };
      }
    }

    return null;
  }


  /*
    =====================================================
    NHẬN DIỆN HÌNH HỌC CƠ BẢN
    =====================================================
  */

  function detectBasicShape(input) {
    const text =
      cleanText(input)
        .toLowerCase();

    const shapes = [
      ["hình tròn", "circle"],
      ["hình vuông", "square"],
      ["hình tam giác", "triangle"],
      ["hình chữ nhật", "rectangle"],
      ["hình bầu dục", "oval"],

      ["circle", "circle"],
      ["square", "square"],
      ["triangle", "triangle"],
      ["rectangle", "rectangle"],
      ["oval", "oval"]
    ];

    for (const [word, english] of shapes) {
      if (
        text.includes(word)
      ) {
        return {
          original: word,
          english
        };
      }
    }

    return null;
  }


  /*
    =====================================================
    PHÂN TÍCH LOCAL

    Đây KHÔNG phải hệ thống nhận diện cuối.

    Nó chỉ xử lý nhanh:
    - toán
    - số lượng
    - màu
    - hình học

    Những khái niệm khó sẽ gửi
    sang Worker AI V2.
    =====================================================
  */

  function analyzeLocal(input) {
    const originalInput =
      cleanText(input);

    if (!originalInput) {
      return {
        ok: false,
        error: "EMPTY_INPUT"
      };
    }

    /*
      TOÁN HỌC
    */

    const math =
      parseMath(
        originalInput
      );

    if (math) {
      return {
        ok: true,

        input:
          originalInput,

        source:
          "local-math",

        needsAI:
          false,

        ...math
      };
    }


    /*
      SỐ LƯỢNG
    */

    const quantityData =
      extractQuantity(
        originalInput
      );


    /*
      MÀU
    */

    const color =
      detectBasicColor(
        quantityData
          .remainingText
      );


    /*
      HÌNH HỌC
    */

    const shape =
      detectBasicShape(
        quantityData
          .remainingText
      );


    /*
      NẾU NHẬN RA HÌNH
    */

    if (shape) {
      return {
        ok: true,

        input:
          originalInput,

        source:
          "local-parser",

        needsAI:
          false,

        category:
          "shape",

        quantity:
          quantityData.quantity,

        shape:
          shape.english,

        shapeOriginal:
          shape.original,

        color:
          color
            ? color.english
            : "",

        colorOriginal:
          color
            ? color.original
            : ""
      };
    }


    /*
      NHỮNG THỨ CÒN LẠI

      Ví dụ:
      3 con mèo trắng
      2 cái điện thoại
      con hổ
      áo khoác
      cây xoài

      Worker AI V2 sẽ quyết định:
      animal / object / plant /
      clothing / food / ...
    */

    return {
      ok: true,

      input:
        originalInput,

      source:
        "local-parser",

      needsAI:
        true,

      category:
        "unknown",

      quantity:
        quantityData.quantity,

      explicitQuantity:
        quantityData
          .explicitQuantity,

      conceptText:
        quantityData
          .remainingText,

      color:
        color
          ? color.english
          : "",

      colorOriginal:
        color
          ? color.original
          : ""
    };
  }


  /*
    =====================================================
    GHÉP KẾT QUẢ AI

    Worker V2 sau này có thể trả:

    {
      category: "animal",
      normalizedEnglish: "cat",
      originalConcept: "con mèo",
      color: "white"
    }
    =====================================================
  */

  function mergeAIAnalysis(
    localResult,
    aiResult
  ) {
    if (
      !localResult ||
      !localResult.ok
    ) {
      throw new Error(
        "Local analysis không hợp lệ."
      );
    }

    if (
      !aiResult ||
      typeof aiResult !== "object"
    ) {
      return localResult;
    }

    return {
      ...localResult,

      needsAI: false,

      source:
        "worker-ai",

      category:
        String(
          aiResult.category ||
          localResult.category ||
          "unknown"
        ),

      normalizedEnglish:
        String(
          aiResult.normalizedEnglish ||
          ""
        ),

      originalConcept:
        String(
          aiResult.originalConcept ||
          localResult.conceptText ||
          ""
        ),

      quantity:
        Number(
          aiResult.quantity ||
          localResult.quantity ||
          1
        ),

      color:
        String(
          aiResult.color ||
          localResult.color ||
          ""
        ),

      shape:
        String(
          aiResult.shape ||
          localResult.shape ||
          ""
        ),

      attributes:
        Array.isArray(
          aiResult.attributes
        )
          ? aiResult.attributes
          : []
    };
  }


  /*
    =====================================================
    CHUYỂN PHÂN TÍCH THÀNH
    KNOWLEDGE RECORD
    =====================================================
  */

  function toKnowledgeData(
    analysis
  ) {
    if (
      !analysis ||
      !analysis.ok
    ) {
      return null;
    }

    if (
      analysis.category ===
      "mathematics"
    ) {
      return {
        type:
          "mathematics",

        data: {
          input:
            analysis.input,

          operation:
            analysis.math.operation,

          left:
            analysis.math.left,

          right:
            analysis.math.right
        }
      };
    }

    return {
      type:
        "knowledge",

      data: {
        input:
          analysis.input,

        category:
          analysis.category ||
          "unknown",

        originalName:
          analysis.originalConcept ||
          analysis.conceptText ||
          analysis.shapeOriginal ||
          "",

        normalizedEnglish:
          analysis.normalizedEnglish ||
          analysis.shape ||
          "",

        quantity:
          analysis.quantity || 1,

        color:
          analysis.color || "",

        shape:
          analysis.shape || "",

        attributes:
          analysis.attributes || []
      }
    };
  }


  /*
    =====================================================
    DEBUG / TEST
    =====================================================
  */

  function runSelfTest() {
    const tests = [
      "2 + 3",
      "10 trừ 4",
      "5 nhân 6",
      "8 chia 2",

      "3 con mèo trắng",
      "2 cái điện thoại",

      "hình tròn màu đỏ",
      "hình vuông màu xanh"
    ];

    return tests.map(
      input => ({
        input,
        result:
          analyzeLocal(input)
      })
    );
  }


  /*
    =====================================================
    PUBLIC API
    =====================================================
  */

  window.RiiBrainEngineV2 = {
    version:
      ENGINE_VERSION,

    cleanText,

    parseMath,

    extractQuantity,

    detectBasicColor,

    detectBasicShape,

    analyzeLocal,

    mergeAIAnalysis,

    toKnowledgeData,

    runSelfTest
  };


  console.log(
    `Rii Brain Engine V${ENGINE_VERSION} ready`
  );

})();