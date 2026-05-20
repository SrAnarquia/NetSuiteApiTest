const axios = require("axios");

axios.post(
  "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=5127&deploy=1",
  payload,
  {
    headers: {
      Authorization: "OAuth ....",
      "Content-Type": "application/json"
    }
  }
)
.then(r => console.log(r.data))
.catch(console.error);