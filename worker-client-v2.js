(function () {
  "use strict";

  const CLIENT_VERSION = "2.0.3";

  const DEFAULT_BACKEND =
    "https://rii-backend.phongphan327272.workers.dev";

  const STORAGE_KEY =
    "rii-v2-backend";

  // Thời gian chờ
  const HEALTH_TIMEOUT = 20000;
  const AI_TIMEOUT = 90000;
  const IMAGE_TIMEOUT = 120000;

  const ENDPOINTS = {
    health: "/health",
    analyze: "/analyze-concept",
    normalize: "/normalize-object",
    generate: "/generate-object-images"
  };


  /* =====================================================
     URL
  ===================================================== */

  function cleanUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "");
  }


  function getBaseUrl() {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    return cleanUrl(
      saved || DEFAULT_BACKEND
    );
  }


  function setBaseUrl(value) {
    const url = cleanUrl(value);

    if (!url) {
      throw new Error(
        "Worker Backend URL không hợp lệ."
      );
    }

    localStorage.setItem(
      STORAGE_KEY,
      url
    );

    return url;
  }


  /* =====================================================
     FETCH TIMEOUT
  ===================================================== */

  async function fetchWithTimeout(
    url,
    options = {},
    timeoutMs = AI_TIMEOUT
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(() => {
        controller.abort();
      }, timeoutMs);

    try {
      const response =
        await fetch(url, {
          ...options,
          signal: controller.signal
        });

      return response;

    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        const timeoutError =
          new Error(
            `Worker phản hồi quá thời gian (${Math.round(
              timeoutMs / 1000
            )} giây).`
          );

        timeoutError.code =
          "CLIENT_TIMEOUT";

        timeoutError.details = {
          timeoutMs,
          url
        };

        throw timeoutError;
      }

      throw error;

    } finally {
      clearTimeout(timer);
    }
  }


  /* =====================================================
     RESPONSE
  ===================================================== */

  async function readResponse(response) {
    let data = null;

    try {
      data =
        await response.json();
    } catch {
      const error =
        new Error(
          "Worker không trả về JSON hợp lệ."
        );

      error.code =
        "INVALID_WORKER_RESPONSE";

      error.status =
        response.status;

      throw error;
    }

    if (
      !response.ok ||
      data?.ok === false
    ) {
      const error =
        new Error(
          data?.message ||
          data?.error ||
          `Worker HTTP ${response.status}`
        );

      error.code =
        data?.code ||
        `HTTP_${response.status}`;

      error.status =
        response.status;

      error.details =
        data?.details || {};

      error.workerVersion =
        data?.workerVersion ||
        data?.version ||
        "";

      error.raw =
        data;

      throw error;
    }

    return data;
  }


  /* =====================================================
     POST
  ===================================================== */

  async function postJson(
    endpoint,
    body,
    timeoutMs = AI_TIMEOUT
  ) {
    const base =
      getBaseUrl();

    if (!base) {
      throw new Error(
        "Chưa cấu hình Worker Backend."
      );
    }

    const response =
      await fetchWithTimeout(
        base + endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(body)
        },
        timeoutMs
      );

    return readResponse(response);
  }


  /* =====================================================
     HEALTH
  ===================================================== */

  async function health() {
    const base =
      getBaseUrl();

    const response =
      await fetchWithTimeout(
        base + ENDPOINTS.health,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json"
          }
        },
        HEALTH_TIMEOUT
      );

    return readResponse(response);
  }


  /* =====================================================
     ANALYZE CONCEPT
  ===================================================== */

  async function analyzeConcept(
    input,
    options = {}
  ) {
    const text =
      String(input || "").trim();

    if (!text) {
      throw new Error(
        "Thiếu nội dung cần phân tích."
      );
    }

    return postJson(
      ENDPOINTS.analyze,
      {
        input: text,

        targetLanguage:
          options.targetLanguage ||
          "en",

        targetLanguageName:
          options.targetLanguageName ||
          "English"
      },
      AI_TIMEOUT
    );
  }


  /* =====================================================
     NORMALIZE OBJECT
  ===================================================== */

  async function normalizeObject(
    objectName,
    options = {}
  ) {
    const text =
      String(
        objectName || ""
      ).trim();

    if (!text) {
      throw new Error(
        "Thiếu tên đối tượng."
      );
    }

    return postJson(
      ENDPOINTS.normalize,
      {
        objectName: text,

        targetLanguage:
          options.targetLanguage ||
          "en",

        targetLanguageName:
          options.targetLanguageName ||
          "English"
      },
      AI_TIMEOUT
    );
  }


  /* =====================================================
     GENERATE IMAGES
  ===================================================== */

  async function generateImages(
    objectName,
    options = {}
  ) {
    const text =
      String(
        objectName || ""
      ).trim();

    if (!text) {
      throw new Error(
        "Thiếu tên đối tượng."
      );
    }

    let count =
      Number.parseInt(
        options.count ?? 1,
        10
      );

    if (
      !Number.isFinite(count)
    ) {
      count = 1;
    }

    count =
      Math.max(
        1,
        Math.min(4, count)
      );

    return postJson(
      ENDPOINTS.generate,
      {
        objectName: text,

        count,

        prompt:
          String(
            options.prompt || ""
          ).trim(),

        targetLanguage:
          options.targetLanguage ||
          "en",

        targetLanguageName:
          options.targetLanguageName ||
          "English"
      },
      IMAGE_TIMEOUT
    );
  }


  /* =====================================================
     ERROR FORMAT
  ===================================================== */

  function formatError(error) {
    if (!error) {
      return {
        message:
          "Lỗi không xác định.",
        code:
          "UNKNOWN_ERROR",
        details: {},
        workerVersion: ""
      };
    }

    /*
      Timeout phía trình duyệt
    */

    if (
      error.code ===
      "CLIENT_TIMEOUT"
    ) {
      return {
        message:
          error.message ||
          "Worker phản hồi quá thời gian.",

        code:
          "CLIENT_TIMEOUT",

        details:
          error.details || {},

        workerVersion:
          ""
      };
    }


    /*
      Lỗi do Worker trả về
    */

    if (error.raw) {
      return {
        message:
          error.raw.message ||
          error.raw.error ||
          error.message ||
          "Worker error",

        code:
          error.raw.code ||
          error.code ||
          "WORKER_ERROR",

        details:
          error.raw.details ||
          error.details ||
          {},

        workerVersion:
          error.raw.workerVersion ||
          error.raw.version ||
          error.workerVersion ||
          ""
      };
    }


    /*
      Network / JS error
    */

    return {
      message:
        error.message ||
        String(error),

      code:
        error.code ||
        "CLIENT_ERROR",

      details:
        error.details ||
        {},

      workerVersion:
        error.workerVersion ||
        ""
    };
  }


  /* =====================================================
     SELF TEST
  ===================================================== */

  async function selfTest() {
    const result = {
      ok: true,
      clientVersion:
        CLIENT_VERSION,
      backend:
        getBaseUrl(),
      tests: []
    };

    /*
      Health
    */

    try {
      const data =
        await health();

      result.tests.push({
        name: "health",
        ok: true,
        workerVersion:
          data.version || "",
        hasAI:
          Boolean(data.hasAI)
      });

    } catch (error) {
      result.ok = false;

      result.tests.push({
        name: "health",
        ok: false,
        error:
          formatError(error)
      });
    }


    /*
      Local API object
    */

    result.tests.push({
      name:
        "client-functions",
      ok:
        typeof health ===
          "function" &&
        typeof analyzeConcept ===
          "function" &&
        typeof normalizeObject ===
          "function" &&
        typeof generateImages ===
          "function"
    });

    return result;
  }


  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.RiiWorkerClientV2 = {
    version:
      CLIENT_VERSION,

    endpoints:
      { ...ENDPOINTS },

    getBaseUrl,
    setBaseUrl,

    health,

    analyzeConcept,

    normalizeObject,

    generateImages,

    formatError,

    selfTest
  };


  console.log(
    `Rii Worker Client V${CLIENT_VERSION} ready`
  );

})();