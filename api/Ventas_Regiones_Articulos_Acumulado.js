const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

const oauth = OAuth({
  consumer: {
    key: process.env.CONSUMER_KEY,
    secret: process.env.CONSUMER_SECRET,
  },
  signature_method: "HMAC-SHA256",
  hash_function(base_string, key) {
    return crypto.createHmac("sha256", key).update(base_string).digest("base64");
  },
});

const token = {
  key: process.env.TOKEN_ID,
  secret: process.env.TOKEN_SECRET,
};

const BASE_URL =
  "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

const SCRIPT_ID = "5324"; // el RESTlet paginado
const DEPLOY_ID = "1";
const CHUNK_SIZE = 3900; // debe coincidir con DEFAULT_CHUNK_SIZE del RESTlet, o mándalo explícito abajo

// Límite de seguridad para no quedar en loop infinito si algo sale raro
const MAX_CHUNKS_SAFETY = 200;

/**
 * Firma y ejecuta UNA llamada GET al RESTlet con los params dados.
 * Cada llamada necesita su propia firma OAuth porque los params (chunk) cambian.
 */
const callRestlet = async (extraParams) => {
  const params = {
    script: SCRIPT_ID,
    deploy: DEPLOY_ID,
    chunkSize: CHUNK_SIZE,
    ...extraParams,
  };

  const request_data = {
    url: BASE_URL,
    method: "GET",
    data: params,
  };

  const oauthData = oauth.authorize(request_data, token);

  // 🔥 EXACTAMENTE TU MISMO ESTILO DE AUTH HEADER
  const authHeader =
    'OAuth ' +
    `realm="${process.env.ACCOUNT_ID}",` +
    `oauth_consumer_key="${oauthData.oauth_consumer_key}",` +
    `oauth_token="${oauthData.oauth_token}",` +
    `oauth_signature_method="${oauthData.oauth_signature_method}",` +
    `oauth_timestamp="${oauthData.oauth_timestamp}",` +
    `oauth_nonce="${oauthData.oauth_nonce}",` +
    `oauth_version="1.0",` +
    `oauth_signature="${encodeURIComponent(oauthData.oauth_signature)}"`;

  const response = await axios.get(BASE_URL, {
    params,
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    responseType: "text",
  });

  let raw = response.data;
  let json;

  if (typeof raw === "string") {
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new Error("NetSuite no devolvió JSON válido en chunk " + extraParams.chunk);
    }
  } else {
    json = raw;
  }

  if (json.success === false) {
    throw new Error("RESTlet error en chunk " + extraParams.chunk + ": " + json.error);
  }

  return json;
};

module.exports = async (req, res) => {
  try {
    const files = [];
    let chunk = 1;
    let hasNextChunk = true;
    let totalRecords = 0;
    let totalChunks = 0;

    while (hasNextChunk) {
      if (chunk > MAX_CHUNKS_SAFETY) {
        throw new Error(
          `Se superó el límite de seguridad de ${MAX_CHUNKS_SAFETY} chunks. Revisa el RESTlet.`
        );
      }

      const json = await callRestlet({ chunk });

      totalRecords = json.totalRecords;
      totalChunks = json.totalChunks;
      hasNextChunk = json.hasNextChunk;

      // Cada elemento de "files" = un Excel a generar del lado que consume esta API
      files.push({
        chunk: json.chunk,
        count: json.count,
        data: json.data,
      });

      chunk++;
    }

    return res.status(200).json({
      success: true,
      totalRecords,
      totalChunks,
      filesGenerated: files.length,
      files, // array de bloques, uno por Excel
    });

  } catch (err) {
    return res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
};