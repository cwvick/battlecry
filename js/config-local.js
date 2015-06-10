 var config = {
   "backendHost": "cwvick.github.io/battlecry/json/", //"gc.digitalriver.com",//"10.224.2.87",
   "backendProtocol": "http:",
   "debug": true,
   "default_dataType": "json",
   "gems_host_api": "http://localhost",
   "auth": "oauth_response.json",
   "meta": "meta_response_iges_20150521.json", //"/rest/store/meta/v1?language=en&country=USA", meta_response_json_v4_id.json
   //"usermeta"          : "oauth_usermeta_uat-1128.json",
   //"usermeta"          : "oauth_usermeta_qa-IBP.json",
   "usermeta": "oauth_usermeta_qa-20150602.json",
   //"usermeta"          : "oauth_usermeta_qanew-1023.json", // with ELV
   "post_payment": "payment_response_sdd_signed.json", //"post_payment_response.json", //"/rest/store/account/v1/me/payment" 

   "offer": "offer_response_hot.json?v=1", //"/rest/services/offers/v2/?language=en&from=0&count=10&orderBy=price&ascending=false&virtual=false"
   //"post_payment"      : offerURL,
   // "offer_v3"             : "offer_response_hot.json?v=1", //"/rest/services/offers/v2/?language=en&from=0&count=10&orderBy=price&ascending=false&virtual=false"
   "offer_v3": "offer_response_bc_v3_20150531.json?v=1",
   "subscription_offer": "offer_response_json_subscription.json", //"/rest/services/offers/v2/?language=en&from=0&count=10&orderBy=price&ascending=false&virtual=false&attributes=subscription"
   "payment_authorize": "post_payment_authorize_response_20150602.json", //"/rest/store/payment/v1/me/authorize",
   "payment_capture": "post_payment_capture_response_paypal.json?v2", //"/rest/store/payment/v1/me/capture",
   "redeemCoupon": "coupon_response.json",
   "upselling": "upselling_json_response_v3_20150518.json"
 };
