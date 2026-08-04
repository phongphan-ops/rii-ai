(function () {
"use strict";


const CLIENT_VERSION =
  "2.1.0";


const DEFAULT_BACKEND =
  "https://rii-backend.phongphan327272.workers.dev";


const STORAGE_KEY =
  "rii-v2-backend";


const HEALTH_TIMEOUT =
  20000;


const AI_TIMEOUT =
  90000;


const VISION_TIMEOUT =
  120000;


const IMAGE_TIMEOUT =
  120000;


const ENDPOINTS = {

  health:
    "/health",

  analyze:
    "/analyze-concept",

  normalize:
    "/normalize-object",

  translate:
    "/translate-concept",

  vision:
    "/analyze-image",

  generate:
    "/generate-object-images"
};



/* =====================================================
   BASE URL
===================================================== */

function cleanUrl(
  value
) {

  return String(
    value ||
    ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}


function getBaseUrl() {

  const saved =
    cleanUrl(
      localStorage.getItem(
        STORAGE_KEY
      )
    );


  return (
    saved ||
    DEFAULT_BACKEND
  );
}


function setBaseUrl(
  value
) {

  const url =
    cleanUrl(
      value
    );


  if (!url) {

    throw new Error(
      "Backend URL không hợp lệ."
    );
  }


  localStorage.setItem(
    STORAGE_KEY,
    url
  );


  return url;
}



/* =====================================================
   TIMEOUT
===================================================== */

function createTimeoutController(
  timeout
) {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => {

        controller.abort();

      },
      timeout
    );


  return {

    controller,

    clear() {

      clearTimeout(
        timer
      );
    }
  };
}



/* =====================================================
   ERROR
===================================================== */

function createClientError(
  message,
  code,
  details,
  status,
  workerVersion
) {

  const error =
    new Error(
      String(
        message ||
        "Unknown error"
      )
    );


  error.code =
    code ||
    "CLIENT_ERROR";


  error.details =
    details ||
    {};


  error.status =
    Number(
      status ||
      0
    );


  error.workerVersion =
    workerVersion ||
    "";


  return error;
}


function formatError(
  error
) {

  return {

    message:
      String(
        error?.message ||
        error ||
        "Unknown error"
      ),

    code:
      error?.code ||
      "CLIENT_ERROR",

    details:
      error?.details ||
      {},

    status:
      Number(
        error?.status ||
        0
      ),

    workerVersion:
      error?.workerVersion ||
      ""
  };
}



/* =====================================================
   REQUEST
===================================================== */

async function requestJson(
  endpoint,
  options = {}
) {

  const method =
    options.method ||
    "GET";


  const timeout =
    Number(
      options.timeout ||
      AI_TIMEOUT
    );


  const body =
    options.body;


  const baseUrl =
    getBaseUrl();


  const url =
    baseUrl +
    endpoint;


  const timeoutControl =
    createTimeoutController(
      timeout
    );


  try {

    const requestOptions = {

      method,

      headers:{

        "Accept":
          "application/json"
      },

      signal:
        timeoutControl
          .controller
          .signal
    };


    if (
      body !==
      undefined
    ) {

      requestOptions
        .headers[
          "Content-Type"
        ] =
        "application/json";


      requestOptions.body =
        JSON.stringify(
          body
        );
    }


    const response =
      await fetch(
        url,
        requestOptions
      );


    let data =
      null;


    try {

      data =
        await response.json();

    } catch {

      const text =
        await response.text()
          .catch(
            () => ""
          );


      throw createClientError(

        text ||
        "Worker trả về dữ liệu không hợp lệ.",

        "INVALID_WORKER_RESPONSE",

        {
          endpoint,
          url
        },

        response.status
      );
    }


    if (
      !response.ok
    ) {

      throw createClientError(

        data?.message ||
        (
          "Worker request failed: "
          +
          response.status
        ),

        data?.code ||
        "WORKER_REQUEST_FAILED",

        data?.details ||
        {},

        response.status,

        data?.workerVersion ||
        ""
      );
    }


    return data;


  } catch(error) {

    if (
      error?.name ===
      "AbortError"
    ) {

      throw createClientError(

        "Worker request timeout.",

        "REQUEST_TIMEOUT",

        {
          endpoint,
          timeout
        },

        0
      );
    }


    if (
      error?.code
    ) {

      throw error;
    }


    throw createClientError(

      error?.message ||
      error,

      "NETWORK_ERROR",

      {
        endpoint,
        url
      },

      0
    );


  } finally {

    timeoutControl.clear();
  }
}



/* =====================================================
   HEALTH
===================================================== */

async function health() {

  return requestJson(
    ENDPOINTS.health,
    {
      timeout:
        HEALTH_TIMEOUT
    }
  );
}



/* =====================================================
   ANALYZE CONCEPT
===================================================== */

async function analyzeConcept(
  input,
  options = {}
) {

  const value =
    String(
      input ||
      ""
    )
      .trim();


  if (!value) {

    throw createClientError(
      "input is required.",
      "INPUT_REQUIRED"
    );
  }


  return requestJson(
    ENDPOINTS.analyze,
    {
      method:
        "POST",

      timeout:
        AI_TIMEOUT,

      body:{

        input:
          value,

        targetLanguage:
          options.targetLanguage ||
          "en",

        targetLanguageName:
          options.targetLanguageName ||
          "English"
      }
    }
  );
}



/* =====================================================
   NORMALIZE OBJECT
===================================================== */

async function normalizeObject(
  input,
  options = {}
) {

  const value =
    String(
      input ||
      ""
    )
      .trim();


  if (!value) {

    throw createClientError(
      "input is required.",
      "INPUT_REQUIRED"
    );
  }


  return requestJson(
    ENDPOINTS.normalize,
    {
      method:
        "POST",

      timeout:
        AI_TIMEOUT,

      body:{

        input:
          value,

        targetLanguage:
          options.targetLanguage ||
          "en",

        targetLanguageName:
          options.targetLanguageName ||
          "English"
      }
    }
  );
}



/* =====================================================
   TRANSLATE
===================================================== */

async function translateConcept(
  concept,
  options = {}
) {

  if (
    !concept ||
    typeof concept !==
      "object"
  ) {

    throw createClientError(
      "concept object is required.",
      "CONCEPT_REQUIRED"
    );
  }


  const normalizedEnglish =
    String(
      concept
        .normalizedEnglish ||
      ""
    )
      .trim();


  if (
    !normalizedEnglish
  ) {

    throw createClientError(
      "normalizedEnglish is required.",
      "NORMALIZED_ENGLISH_REQUIRED"
    );
  }


  return requestJson(
    ENDPOINTS.translate,
    {
      method:
        "POST",

      timeout:
        AI_TIMEOUT,

      body:{

        normalizedEnglish,

        color:
          String(
            concept.color ||
            ""
          ),

        shape:
          String(
            concept.shape ||
            ""
          ),

        translatedLabel:
          String(
            concept
              .translatedLabel ||
            ""
          ),

        targetLanguage:
          options.targetLanguage ||
          "vi",

        targetLanguageName:
          options.targetLanguageName ||
          "Vietnamese"
      }
    }
  );
}



/* =====================================================
   IMAGE HELPERS
===================================================== */

function blobToDataUri(
  blob
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        !(blob instanceof Blob)
      ) {

        reject(
          createClientError(
            "Image must be a Blob.",
            "INVALID_IMAGE_BLOB"
          )
        );

        return;
      }


      const reader =
        new FileReader();


      reader.onload =
        () => {

          resolve(
            String(
              reader.result ||
              ""
            )
          );
        };


      reader.onerror =
        () => {

          reject(
            createClientError(
              "Không đọc được ảnh.",
              "IMAGE_READ_FAILED"
            )
          );
        };


      reader.readAsDataURL(
        blob
      );
    }
  );
}


function canvasToDataUri(
  canvas,
  quality = .86
) {

  if (
    !canvas ||
    typeof canvas
      .toDataURL !==
      "function"
  ) {

    throw createClientError(
      "Canvas không hợp lệ.",
      "INVALID_CANVAS"
    );
  }


  return canvas.toDataURL(
    "image/jpeg",
    quality
  );
}


function normalizeImageInput(
  image
) {

  if (
    typeof image ===
    "string"
  ) {

    const value =
      image.trim();


    if (!value) {

      throw createClientError(
        "image is required.",
        "IMAGE_REQUIRED"
      );
    }


    return Promise.resolve(
      value
    );
  }


  if (
    image instanceof Blob
  ) {

    return blobToDataUri(
      image
    );
  }


  if (
    image &&
    typeof image
      .toDataURL ===
      "function"
  ) {

    return Promise.resolve(
      canvasToDataUri(
        image
      )
    );
  }


  throw createClientError(
    "Unsupported image input.",
    "INVALID_IMAGE_INPUT"
  );
}



/* =====================================================
   VISION AI
===================================================== */

async function analyzeImage(
  image,
  options = {}
) {

  const imageData =
    await normalizeImageInput(
      image
    );


  const body = {

    image:
      imageData,

    question:
      String(
        options.question ||
        ""
      )
        .trim(),

    targetLanguage:
      options.targetLanguage ||
      "vi",

    targetLanguageName:
      options.targetLanguageName ||
      "Vietnamese"
  };


  return requestJson(
    ENDPOINTS.vision,
    {
      method:
        "POST",

      timeout:
        VISION_TIMEOUT,

      body
    }
  );
}



/* =====================================================
   GENERATE IMAGES
===================================================== */

async function generateImages(
  concept,
  options = {}
) {

  const value =
    String(
      concept ||
      ""
    )
      .trim();


  if (!value) {

    throw createClientError(
      "concept is required.",
      "CONCEPT_REQUIRED"
    );
  }


  let count =
    Number(
      options.count ??
      3
    );


  if (
    !Number.isFinite(
      count
    )
  ) {

    count =
      3;
  }


  count =
    Math.min(
      Math.max(
        Math.round(
          count
        ),
        1
      ),
      3
    );


  return requestJson(
    ENDPOINTS.generate,
    {
      method:
        "POST",

      timeout:
        IMAGE_TIMEOUT,

      body:{

        concept:
          value,

        count,

        targetLanguage:
          options.targetLanguage ||
          "en",

        targetLanguageName:
          options.targetLanguageName ||
          "English"
      }
    }
  );
}



/* =====================================================
   SELF TEST
===================================================== */

async function selfTest() {

  const result = {

    ok:
      false,

    clientVersion:
      CLIENT_VERSION,

    backend:
      getBaseUrl(),

    health:
      null,

    visionReady:
      false
  };


  try {

    result.health =
      await health();


    result.visionReady =
      Array.isArray(
        result.health
          ?.endpoints
      )
      &&
      result.health
        .endpoints
        .includes(
          "/analyze-image"
        );


    result.ok =
      Boolean(
        result.health?.ok
      );


    return result;


  } catch(error) {

    return {

      ...result,

      error:
        formatError(
          error
        )
    };
  }
}



/* =====================================================
   PUBLIC API
===================================================== */

window.RiiWorkerClientV2 = {

  version:
    CLIENT_VERSION,

  endpoints:{
    ...ENDPOINTS
  },

  getBaseUrl,

  setBaseUrl,

  health,

  analyzeConcept,

  normalizeObject,

  translateConcept,

  analyzeImage,

  generateImages,

  blobToDataUri,

  canvasToDataUri,

  formatError,

  selfTest
};


console.log(
  "Rii Worker Client V" +
  CLIENT_VERSION +
  " ready"
);

})();