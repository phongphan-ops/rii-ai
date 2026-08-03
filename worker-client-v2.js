/*
  =========================================================
  RII AI - WORKER CLIENT V2
  File: worker-client-v2.js
  Version: 2.0.0
  =========================================================
*/

(function () {
  "use strict";

  const CLIENT_VERSION = "2.0.0";
  const DEFAULT_TIMEOUT = 30000;

  function getBaseUrl() {
    return String(
      localStorage.getItem("rii-v2-backend") || ""
    )
      .trim()
      .replace(/\/+$/, "");
  }

  function requireBaseUrl() {
    const baseUrl = getBaseUrl();

    if (!baseUrl) {
      throw new Error(
        "Chưa cấu hình Worker Backend trong Settings."
      );
    }

    return baseUrl;
  }

  async function fetchWithTimeout(
    url,
    options = {},
    timeout = DEFAULT_TIMEOUT
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        timeout
      );

    try {
      return await fetch(
        url,
        {
          ...options,
          signal: controller.signal
        }
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "Worker phản hồi quá thời gian."
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function readJsonResponse(response) {
    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Worker không trả JSON hợp lệ. HTTP ${response.status}`
      );
    }

    if (
      !response.ok ||
      data?.ok === false
    ) {
      const error =
        new Error(
          data?.error ||
          `Worker lỗi HTTP ${response.status}`
        );

      error.code =
        data?.code || "WORKER_ERROR";

      error.details =
        data?.details || {};

      error.workerVersion =
        data?.version || "";

      throw error;
    }

    return data;
  }

  async function health() {
    const baseUrl =
      requireBaseUrl();

    const response =
      await fetchWithTimeout(
        baseUrl + "/health",
        {
          method: "GET",
          headers: {
            "Accept":
              "application/json"
          }
        },
        15000
      );

    return readJsonResponse(
      response
    );
  }

  async function analyzeConcept(
    text,
    options = {}
  ) {
    const baseUrl =
      requireBaseUrl();

    const cleanText =
      String(text || "").trim();

    if (!cleanText) {
      throw new Error(
        "Thiếu nội dung cần phân tích."
      );
    }

    const response =
      await fetchWithTimeout(
        baseUrl + "/analyze-concept",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          body:
            JSON.stringify({
              text:
                cleanText,

              targetLanguage:
                options.targetLanguage ||
                "en",

              targetLanguageName:
                options.targetLanguageName ||
                "English"
            })
        }
      );

    return readJsonResponse(
      response
    );
  }

  async function normalizeObject(
    objectName,
    options = {}
  ) {
    const baseUrl =
      requireBaseUrl();

    const name =
      String(objectName || "").trim();

    if (!name) {
      throw new Error(
        "Thiếu objectName."
      );
    }

    const response =
      await fetchWithTimeout(
        baseUrl + "/normalize-object",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          body:
            JSON.stringify({
              objectName:
                name,

              targetLanguage:
                options.targetLanguage ||
                "en",

              targetLanguageName:
                options.targetLanguageName ||
                "English"
            })
        }
      );

    return readJsonResponse(
      response
    );
  }

  async function generateImages(
    objectName,
    options = {}
  ) {
    const baseUrl =
      requireBaseUrl();

    const name =
      String(objectName || "").trim();

    if (!name) {
      throw new Error(
        "Thiếu objectName."
      );
    }

    const count =
      Math.max(
        1,
        Math.min(
          6,
          Number.parseInt(
            options.count ?? 1,
            10
          ) || 1
        )
      );

    const response =
      await fetchWithTimeout(
        baseUrl +
        "/generate-object-images",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          body:
            JSON.stringify({
              objectName:
                name,

              count,

              prompt:
                String(
                  options.prompt || ""
                )
                .trim()
                .slice(0, 300),

              targetLanguage:
                options.targetLanguage ||
                "en",

              targetLanguageName:
                options.targetLanguageName ||
                "English"
            })
        },
        60000
      );

    return readJsonResponse(
      response
    );
  }

  function formatError(error) {
    return {
      message:
        String(
          error?.message ||
          error ||
          "Không xác định"
        ),

      code:
        error?.code ||
        "CLIENT_ERROR",

      details:
        error?.details ||
        {},

      workerVersion:
        error?.workerVersion ||
        ""
    };
  }

  window.RiiWorkerClientV2 = {
    version:
      CLIENT_VERSION,

    getBaseUrl,

    health,

    analyzeConcept,

    normalizeObject,

    generateImages,

    formatError
  };

  console.log(
    `Rii Worker Client V${CLIENT_VERSION} ready`
  );
})();