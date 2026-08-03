(function () {
  "use strict";

  const CLIENT_VERSION = "2.0.4";

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
    translate: "/translate-concept",
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
    const url =
      cleanUrl(value);

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
        await fetch(
          url,
          {
            ...options,
            signal:
              controller.signal
          }
        );

      return response;

    } catch (error) {
      if (
        error?.name ===
        "AbortError"
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
      clearTimeout(
        timer
      );
    }
  }


  /* =====================================================
     RESPONSE
  ===================================================== */

  async function readResponse(
    response
  ) {
    let data =
      null;

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
        data?.details ||
        {};

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
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              body
            )
        },
        timeoutMs
      );

    return readResponse(
      response
    );
  }


  /* =====================================================
     HEALTH
  ===================================================== */

  async function health() {
    const base =
      getBaseUrl();

    const response =
      await fetchWithTimeout(
        base +
        ENDPOINTS.health,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json"
          }
        },
        HEALTH_TIMEOUT
      );

    return readResponse(
      response
    );
  }


  /* =====================================================
     ANALYZE CONCEPT
  ===================================================== */

  async function analyzeConcept(
    input,
    options = {}
  ) {
    const text =
      String(
        input || ""
      ).trim();

    if (!text) {
      throw new Error(
        "Thiếu nội dung cần phân tích."
      );
    }

    return postJson(
      ENDPOINTS.analyze,
      {
        input:
          text,

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
        objectName:
          text,

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
     TRANSLATE CONCEPT
     NEW IN CLIENT V2.0.4
  ===================================================== */

  async function translateConcept(
    concept,
    options = {}
  ) {
    const source =
      concept &&
      typeof concept ===
        "object"
        ?
        concept
        :
        {
          normalizedEnglish:
            String(
              concept || ""
            ).trim()
        };


    const normalizedEnglish =
      String(
        source.normalizedEnglish ||
        source.core ||
        source.object ||
        source.concept ||
        ""
      ).trim();


    if (!normalizedEnglish) {
      throw new Error(
        "Thiếu normalizedEnglish để dịch."
      );
    }


    const targetLanguage =
      String(
        options.targetLanguage ||
        "en"
      ).trim() ||
      "en";


    const targetLanguageName =
      String(
        options.targetLanguageName ||
        targetLanguage
      ).trim() ||
      targetLanguage;


    return postJson(
      ENDPOINTS.translate,
      {
        normalizedEnglish,

        color:
          String(
            source.color ||
            ""
          ).trim(),

        shape:
          String(
            source.shape ||
            ""
          ).trim(),

        targetLanguage,

        targetLanguageName
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
      !Number.isFinite(
        count
      )
    ) {
      count =
        1;
    }

    count =
      Math.max(
        1,
        Math.min(
          4,
          count
        )
      );

    return postJson(
      ENDPOINTS.generate,
      {
        objectName:
          text,

        count,

        prompt:
          String(
            options.prompt ||
            ""
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

  function formatError(
    error
  ) {
    if (!error) {
      return {
        message:
          "Lỗi không xác định.",

        code:
          "UNKNOWN_ERROR",

        details:
          {},

        workerVersion:
          ""
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
          error.details ||
          {},

        workerVersion:
          ""
      };
    }


    /*
      Lỗi do Worker trả về
    */

    if (
      error.raw
    ) {
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
        String(
          error
        ),

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
      ok:
        true,

      clientVersion:
        CLIENT_VERSION,

      backend:
        getBaseUrl(),

      tests:
        []
    };


    /*
      Health
    */

    try {
      const data =
        await health();

      result.tests.push({
        name:
          "health",

        ok:
          true,

        workerVersion:
          data.version ||
          "",

        hasAI:
          Boolean(
            data.hasAI
          ),

        hasTranslateEndpoint:
          Boolean(
            data
              ?.endpoints
              ?.translate
          )
      });

    } catch (error) {
      result.ok =
        false;

      result.tests.push({
        name:
          "health",

        ok:
          false,

        error:
          formatError(
            error
          )
      });
    }


    /*
      Local API object
    */

    const functionsOk =
      typeof health ===
        "function" &&

      typeof analyzeConcept ===
        "function" &&

      typeof normalizeObject ===
        "function" &&

      typeof translateConcept ===
        "function" &&

      typeof generateImages ===
        "function";


    if (
      !functionsOk
    ) {
      result.ok =
        false;
    }


    result.tests.push({
      name:
        "client-functions",

      ok:
        functionsOk,

      functions: {
        health:
          typeof health ===
          "function",

        analyzeConcept:
          typeof analyzeConcept ===
          "function",

        normalizeObject:
          typeof normalizeObject ===
          "function",

        translateConcept:
          typeof translateConcept ===
          "function",

        generateImages:
          typeof generateImages ===
          "function"
      }
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
      {
        ...ENDPOINTS
      },

    getBaseUrl,
    setBaseUrl,

    health,

    analyzeConcept,

    normalizeObject,

    translateConcept,

    generateImages,

    formatError,

    selfTest
  };


  console.log(
    `Rii Worker Client V${CLIENT_VERSION} ready`
  );

})();