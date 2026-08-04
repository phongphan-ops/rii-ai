/*
=========================================================
Rii Worker Client
Version: 2.2.0

Supports:
- Health
- Concept analysis
- Object normalization
- Translation
- Vision AI
- Image generation
- Math AI
=========================================================
*/

(function(){

"use strict";


const CLIENT_VERSION =
  "2.2.0";


const DEFAULT_BACKEND =
  "https://rii-backend.phongphan327272.workers.dev";


const STORAGE_KEY =
  "rii-v2-backend";


const HEALTH_TIMEOUT =
  20000;


const AI_TIMEOUT =
  90000;


const MATH_TIMEOUT =
  90000;


const VISION_TIMEOUT =
  120000;


const IMAGE_TIMEOUT =
  120000;


const ENDPOINTS = {

  health:
    "/health",

  math:
    "/solve-math",

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
   HELPERS
===================================================== */

function cleanBaseUrl(
  value
){

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


function getBaseUrl(){

  const saved =
    localStorage.getItem(
      STORAGE_KEY
    );


  return cleanBaseUrl(
    saved ||
    DEFAULT_BACKEND
  );
}


function setBaseUrl(
  value
){

  const url =
    cleanBaseUrl(
      value
    );


  if(!url){

    localStorage.removeItem(
      STORAGE_KEY
    );


    return getBaseUrl();
  }


  localStorage.setItem(
    STORAGE_KEY,
    url
  );


  return url;
}


function buildUrl(
  endpoint
){

  return (
    getBaseUrl()
    +
    endpoint
  );
}


/* =====================================================
   TIMEOUT
===================================================== */

function timeoutController(
  timeoutMs
){

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => {

        controller.abort();

      },
      timeoutMs
    );


  return {

    controller,

    cancel(){

      clearTimeout(
        timer
      );
    }
  };
}


/* =====================================================
   REQUEST
===================================================== */

async function requestJson(
  endpoint,
  options = {}
){

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


  const timeoutState =
    timeoutController(
      timeout
    );


  try{

    const response =
      await fetch(
        buildUrl(
          endpoint
        ),
        {
          method,

          headers:{

            "Content-Type":
              "application/json",

            ...(
              options.headers ||
              {}
            )
          },

          body:
            body === undefined
              ?
              undefined
              :
              JSON.stringify(
                body
              ),

          signal:
            timeoutState
              .controller
              .signal
        }
      );


    let data =
      null;


    const raw =
      await response.text();


    if(raw){

      try{

        data =
          JSON.parse(
            raw
          );

      }catch{

        data = {

          message:
            raw,

          code:
            "INVALID_JSON_RESPONSE",

          status:
            response.status
        };
      }
    }


    if(
      !response.ok
    ){

      const error =
        new Error(
          data?.message ||
          `HTTP ${response.status}`
        );


      error.code =
        data?.code ||
        "HTTP_ERROR";


      error.status =
        response.status;


      error.details =
        data?.details ||
        {};


      error.workerVersion =
        data?.workerVersion ||
        data?.version ||
        "";


      error.response =
        data;


      throw error;
    }


    return data;


  }catch(error){

    if(
      error?.name ===
      "AbortError"
    ){

      const timeoutError =
        new Error(
          "Request timed out."
        );


      timeoutError.code =
        "REQUEST_TIMEOUT";


      timeoutError.status =
        408;


      throw timeoutError;
    }


    throw error;


  }finally{

    timeoutState.cancel();
  }
}


/* =====================================================
   HEALTH
===================================================== */

async function health(){

  return requestJson(
    ENDPOINTS.health,
    {
      method:
        "GET",

      timeout:
        HEALTH_TIMEOUT
    }
  );
}


/* =====================================================
   MATH
===================================================== */

async function solveMath(
  problem,
  options = {}
){

  const value =
    String(
      problem ||
      ""
    )
      .trim();


  if(!value){

    const error =
      new Error(
        "Math problem is required."
      );


    error.code =
      "MATH_PROBLEM_REQUIRED";


    throw error;
  }


  return requestJson(
    ENDPOINTS.math,
    {
      method:
        "POST",

      timeout:
        MATH_TIMEOUT,

      body:{

        problem:
          value,

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
   CONCEPT ANALYSIS
===================================================== */

async function analyzeConcept(
  input
){

  const value =
    String(
      input ||
      ""
    )
      .trim();


  if(!value){

    const error =
      new Error(
        "Concept input is required."
      );


    error.code =
      "INPUT_REQUIRED";


    throw error;
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
          value
      }
    }
  );
}


/* =====================================================
   NORMALIZE OBJECT
===================================================== */

async function normalizeObject(
  input
){

  const value =
    String(
      input ||
      ""
    )
      .trim();


  if(!value){

    const error =
      new Error(
        "Object input is required."
      );


    error.code =
      "INPUT_REQUIRED";


    throw error;
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
          value
      }
    }
  );
}


/* =====================================================
   TRANSLATION
===================================================== */

async function translateConcept(
  normalizedEnglish,
  options = {}
){

  const value =
    String(
      normalizedEnglish ||
      ""
    )
      .trim();


  if(!value){

    const error =
      new Error(
        "normalizedEnglish is required."
      );


    error.code =
      "NORMALIZED_ENGLISH_REQUIRED";


    throw error;
  }


  return requestJson(
    ENDPOINTS.translate,
    {
      method:
        "POST",

      timeout:
        AI_TIMEOUT,

      body:{

        normalizedEnglish:
          value,

        targetLanguage:
          options.targetLanguage ||
          "vi",

        targetLanguageName:
          options.targetLanguageName ||
          "Vietnamese",

        color:
          options.color ||
          "",

        shape:
          options.shape ||
          ""
      }
    }
  );
}


/* =====================================================
   IMAGE HELPERS
===================================================== */

function blobToDataUri(
  blob
){

  return new Promise(
    (
      resolve,
      reject
    ) => {

      if(
        !(blob instanceof Blob)
      ){

        reject(
          new Error(
            "Expected a Blob."
          )
        );


        return;
      }


      const reader =
        new FileReader();


      reader.onload =
        () => {

          resolve(
            reader.result
          );
        };


      reader.onerror =
        () => {

          reject(
            reader.error ||
            new Error(
              "Could not read image."
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
  quality = .82
){

  if(
    !canvas ||
    typeof canvas.toDataURL !==
    "function"
  ){

    throw new Error(
      "Expected a canvas."
    );
  }


  return canvas.toDataURL(
    "image/jpeg",
    quality
  );
}


async function normalizeImageInput(
  image
){

  if(
    typeof image ===
    "string"
  ){

    const value =
      image.trim();


    if(!value){

      throw new Error(
        "Image is empty."
      );
    }


    return value;
  }


  if(
    image instanceof Blob
  ){

    return blobToDataUri(
      image
    );
  }


  if(
    image &&
    typeof image.toDataURL ===
    "function"
  ){

    return canvasToDataUri(
      image
    );
  }


  throw new Error(
    "Unsupported image input."
  );
}


/* =====================================================
   VISION
===================================================== */

async function analyzeImage(
  image,
  options = {}
){

  const normalizedImage =
    await normalizeImageInput(
      image
    );


  return requestJson(
    ENDPOINTS.vision,
    {
      method:
        "POST",

      timeout:
        VISION_TIMEOUT,

      body:{

        image:
          normalizedImage,

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
      }
    }
  );
}


/* =====================================================
   IMAGE GENERATION
===================================================== */

async function generateImages(
  concept,
  options = {}
){

  const value =
    String(
      concept ||
      ""
    )
      .trim();


  if(!value){

    const error =
      new Error(
        "Concept is required."
      );


    error.code =
      "CONCEPT_REQUIRED";


    throw error;
  }


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

        count:
          Number(
            options.count ||
            3
          )
      }
    }
  );
}


/* =====================================================
   ERROR FORMAT
===================================================== */

function formatError(
  error
){

  const raw =
    error?.response ||
    {};


  return {

    message:
      String(
        error?.message ||
        raw?.message ||
        error ||
        "Unknown error"
      ),

    code:
      error?.code ||
      raw?.code ||
      "CLIENT_ERROR",

    details:
      error?.details ||
      raw?.details ||
      {},

    status:
      Number(
        error?.status ||
        raw?.status ||
        0
      ),

    workerVersion:
      error?.workerVersion ||
      raw?.workerVersion ||
      raw?.version ||
      ""
  };
}


/* =====================================================
   SELF TEST
===================================================== */

async function selfTest(){

  const report = {

    clientVersion:
      CLIENT_VERSION,

    backend:
      getBaseUrl(),

    health:
      null,

    mathLocal:
      null
  };


  try{

    report.health =
      await health();

  }catch(error){

    report.health =
      formatError(
        error
      );
  }


  try{

    /*
      This should work even if
      Workers AI quota is exhausted,
      because Worker V2.2.0 solves
      simple arithmetic locally.
    */

    report.mathLocal =
      await solveMath(
        "8 × 7",
        {
          targetLanguage:
            "vi",

          targetLanguageName:
            "Vietnamese"
        }
      );

  }catch(error){

    report.mathLocal =
      formatError(
        error
      );
  }


  return report;
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

  solveMath,

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
  "Rii Worker Client V"
  +
  CLIENT_VERSION
  +
  " Math ready"
);

})();