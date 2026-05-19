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
    return crypto
      .createHmac("sha256", key)
      .update(base_string)
      .digest("base64");
  },
});

const token = {
  key: process.env.TOKEN_ID,
  secret: process.env.TOKEN_SECRET,
};

module.exports = async (req, res) => {

  try {

    /*
      RESTLET URL
    */
    const baseUrl =
      "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

    /*
      PARAMS
    */
    const params = {
      script: "5125",
      deploy: "1",
      subsidiary: req.query.subsidiary || "2",
    };

    /*
      OAUTH REQUEST DATA
    */
    const request_data = {
      url: baseUrl,
      method: "GET",
      data: params,
    };

    /*
      GENERATE OAUTH
    */
    const oauthData =
      oauth.authorize(request_data, token);

    /*
      AUTH HEADER
    */
    const authHeader =
      'OAuth ' +
      `realm="${process.env.ACCOUNT_ID}",` +
      `oauth_consumer_key="${oauthData.oauth_consumer_key}",` +
      `oauth_token="${oauthData.oauth_token}",` +
      `oauth_signature_method="${oauthData.oauth_signature_method}",` +
      `oauth_timestamp="${oauthData.oauth_timestamp}",` +
      `oauth_nonce="${oauthData.oauth_nonce}",` +
      `oauth_version="1.0",` +
      `oauth_signature="${encodeURIComponent(
        oauthData.oauth_signature
      )}"`;

    /*
      CALL RESTLET
    */
    const response = await axios.get(baseUrl, {

      params,

      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },

      responseType: "text"
    });

    /*
      NETSUITE RETURNS STRING
    */
    const parsedData =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    /*
      GET DATA
    */
    const restletData =
      parsedData.data || parsedData;

    /*
      FORMAT PERIODS
    */
    const formattedPeriods =
      (restletData.periods || []).map(period => {

        const weekStart =
          Object.keys(period)[0];

        const value =
          period[weekStart];

        return {

          weekStart,

          startDate:
            value.startDate,

          accountsPayable:
            value.accountsPayable,

          purchaseOrders:
            value.purchaseOrders,

          employerTaxes:
            value.employerTaxes,

          isr:
            value.isr,

          laborCosts:
            value.laborCosts,

          otherPayrollPayments:
            value.otherPayrollPayments,

          benefitsMOD:
            value.benefitsMOD,

          salaries:
            value.salaries,

          extraTime:
            value.extraTime,

          totalOutflow:
            value.totalOutflow
        };
      });

    /*
      FINAL RESPONSE
    */
    return res.status(200).json({
      success: true,

      type:
        restletData.type,

      subsidiary:
        restletData.subsidiary,

      periods:
        formattedPeriods
    });

  } catch (err) {

    return res.status(500).json({
      success: false,

      error:
        err.response?.data ||
        err.message,
    });
  }
};