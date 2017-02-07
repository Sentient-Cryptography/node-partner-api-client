/*jslint node: true */
"use strict";

var crypto = require('./crypto');
var request = require('request');
var version = require('../package').version;
var Q = require('q');

function netkiFormatDate(d) {
  if(typeof d === 'undefined') {
    return null;
  }

  var mm = d.getMonth() + 1;
  var dd = d.getDate();
  return [d.getFullYear(), (mm>9 ?  '' : '0') + mm, (dd>9 ? '' : '0') + dd].join('-');
}

var processRequest = function(client, apiURL, method, data) {
  return Q.Promise(function (resolve, reject) {
    var supportedMethods = ['GET', 'PUT', 'POST', 'DELETE'],
      successCodes = [200, 201, 202, 204],
      responseData;

    if (supportedMethods.indexOf(method) == -1) {
      return reject('Unsupported HTTP method: ' + method);
    }

    var options = {
      method: method,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Netki-NodeJS/' + version
      }
    };

    if (typeof(data) !== 'undefined') {
      options.body = JSON.stringify(data);
    }

    var url = client == null ? apiURL : client.apiURL + apiURL;

    if (client != null) {

      // Setup Authentication
      if(client.apiKeyAuth) {
        options.headers['X-Partner-ID'] = client.partnerId;
        options.headers['Authorization'] = client.apiKey;
      }

      if(client.distributedAuth) {
        options.headers['X-Partner-Key'] = client.partnerKskHex;
        options.headers['X-Partner-KeySig'] = client.partnerKskSigHex;
      }

      if(client.partnerSignedAuth) {
        options.headers['X-Partner-ID'] = client.partnerId;
      }

      if(client.distributedAuth || client.partnerSignedAuth) {
        options.headers['X-Identity'] = crypto.getHexPubKey(client.userKey.pubKeyObj || client.userKey);
        options.headers['X-Signature'] = crypto.signString(client.userKey.prvKeyObj || client.userKey, url + (options.body ? options.body : ''));
      }

    }

    request(url, options, function (error, response, body) {

      if (error) {
        return reject('HTTP Request Failed: ' + error);
      }

      if (method == 'DELETE' && response.statusCode == 204) {
        return resolve({});
      }

      try {
        responseData = JSON.parse(body);
      } catch (err) {
        return reject('Error Parsing JSON Data: ' + err);
      }

      if (responseData.success === false || successCodes.indexOf(response.statusCode) == -1) {
        var errorMessage = responseData.message;

        if (typeof(responseData.failures) !== 'undefined') {

          errorMessage = errorMessage + ' [FAILURES: ';

          var failures = [];
          responseData.failures.forEach(function (failure) {
            failures.push(failure.message);
          });

          errorMessage = errorMessage + failures.join(', ') + ']';
        }

        return reject('Request Failed: ' + errorMessage);
      }

      resolve(responseData);
    });
  });
};

var Certificate = function(customerData, client) {

  this.id = null;
  this.dataToken = null;
  this.orderStatus = 'UNKNOWN';
  this.orderError = null;
  this.bundle = {
    root: null,
    intermediate: [],
    certificate: null
  };

  if(typeof customerData !== 'undefined') {
    this.customerData = customerData;
  }

  if (typeof client !== "undefined") {
    this.client = client;
  }

};

Certificate.prototype.setClient = function(client) {
  this.client = client
};

Certificate.prototype.setCustomerData = function(customerData) {
  this.customerData = customerData;
};

function subjectAdd(subjectArray, key, value) {
  if(typeof value === "undefined" || value === "") {
    throw new TypeError('Value Reqired for X.500 Name Component: '+ key);
  }
  subjectArray.push(key + '=' + value);
}

Certificate.prototype.generateCSR = function (rsaKey) {

  if(!crypto.isRSA(rsaKey)) {
    throw new TypeError('RSAKey Required');
  }

  // Generate Subject
  var subject = [];
  subjectAdd(subject, 'C', this.customerData.country);
  subjectAdd(subject, 'O', this.customerData.organizationName);
  subjectAdd(subject, 'L', this.customerData.city);
  subjectAdd(subject, 'CN', this.customerData.firstName + ' ' + this.customerData.lastName);
  subjectAdd(subject, 'ST', this.customerData.state);
  subjectAdd(subject, 'STREET', this.customerData.streetAddress);
  subjectAdd(subject, 'postalCode', this.customerData.postalCode);

  return crypto.createCsrPem(rsaKey, {str: '/' + subject.join('/')});
};

String.prototype.toSnakeCase = function(){
  return this.replace(/([A-Z])/g, function($1){return "_"+$1.toLowerCase();});
};

Certificate.prototype.submitUserData = function() {

  var postData = {};
  for(var fieldName in this.customerData) {
    if(this.customerData.hasOwnProperty(fieldName)) {

      // Skip Organization Name
      if(fieldName === 'organizationName') continue;

      if(this.customerData[fieldName] instanceof Date) {
        postData[fieldName.toSnakeCase()] = netkiFormatDate(this.customerData[fieldName]);
      } else {
        postData[fieldName.toSnakeCase()] = this.customerData[fieldName];
      }
    }
  }

  postData.product = this.product;

  var self = this;
  return processRequest(this.client, '/v1/certificate/token', 'POST', postData).then(function (response) {
    if(response.token) {
      self.dataToken = response.token;
    }
  });
};

Certificate.prototype.submitOrder = function(stripeToken) {

  if(!this.dataToken) {
    throw new TypeError('Data Submission Not Yet Completed');
  }

  if(this.id) {
    throw new TypeError('Certificate Order Has Already Been Submitted');
  }

  var postData = {
    certdata_token: this.dataToken,
    email: this.customerData.email,
    product: this.product
  };

  if(typeof stripeToken !== "undefined") {
    postData['stripe_token'] = stripeToken;
  }

  var self = this;
  return processRequest(this.client, '/v1/certificate', 'POST', postData).then(function (response) {
    if(response.order_id) {
      self.id = response.order_id;
    }
  });

};

Certificate.prototype.submitCSR = function (rsaKey) {

  if(!this.id) {
    throw new Error('Certificate Must Have a Valid Order Number / ID');
  }

  var postData = {
    signed_csr: this.generateCSR(rsaKey)
  };

  return processRequest(this.client, '/v1/certificate/' + this.id + '/csr', 'POST', postData);
};

Certificate.prototype.revoke = function (reason) {

  if(!this.id) {
    throw new Error('Certificate Must Have a Valid Order Number / ID');
  }

  var submitData = {
    revocation_reason: reason
  };

  return processRequest(this.client, '/v1/certificate/' + this.id, 'DELETE',  submitData);
};

Certificate.prototype.getStatus = function () {

  if(!this.id) {
    throw new Error('Certificate Must Have a Valid Order Number / ID');
  }

  var self = this;
  return processRequest(this.client, '/v1/certificate/' + this.id, 'GET').then(function (response) {
    self.orderStatus = response.order_status;
    self.orderError = response.order_error;

    if(typeof response.certificate_bundle !== 'undefined' && response.certificate_bundle !== null) {
      self.bundle.root = response.certificate_bundle.root;
      self.bundle.certificate = response.certificate_bundle.certificate;
      self.bundle.intermediate = response.certificate_bundle.intermediate;
    }

    return Q.when();
  });
};

Certificate.prototype.setProduct = function (product) {
  this.product = product.id;
};

Certificate.prototype.isOrderComplete = function () {
  if(this.orderStatus !== null && this.orderStatus == 'Order Finalized') {
    return true;
  }
  this.getStatus();
  return false;
};

var WalletName = function (id, domainName, name, wallets, externalId) {
  this.id = id;
  this.domainName = domainName;
  this.name = name;
  this.wallets = wallets || {};
  this.externalId = externalId;
};

WalletName.prototype.setClient = function (client) {
  if(client.partnerSignedAuth) {
    throw new TypeError('');
  }
  this.client = client;
};

WalletName.prototype.getUsedCurrencies = function () {
  return Object.keys(this.wallets);
};

WalletName.prototype.getWalletAddress = function (currency) {
  return this.wallets[currency];
};

WalletName.prototype.setCurrencyAddress = function (currency, walletAddress) {
  this.wallets[currency] = walletAddress;
};

WalletName.prototype.removeCurrencyAddress = function (currency) {
  if (typeof(this.wallets[currency]) !== 'undefined') {
    delete this.wallets[currency];
  }
};

WalletName.prototype.save = function () {
  var walletData = [],
    postData,
    that = this;

  for (var currency in this.wallets) {
    if (this.wallets.hasOwnProperty(currency)) {
      walletData.push({
        currency: currency,
        wallet_address: this.wallets[currency]
      });
    }
  }

  postData = {
    wallet_names: [
      {
        domain_name: this.domainName,
        name: this.name,
        wallets: walletData,
        external_id: this.externalId
      }
    ]
  };

  if (this.id) {
    postData.wallet_names[0].id = this.id;
    return processRequest(this.client, '/v1/partner/walletname', 'PUT', postData);
  } else {
    return processRequest(this.client, '/v1/partner/walletname', 'POST', postData)
      .then(function (response) {
        response.wallet_names.forEach(function (walletName) {
          if (walletName.domain_name == that.domainName && walletName.name == that.name) {
            that.id = walletName.id;
          }
        });
      }
    );
  }
};

WalletName.prototype.delete = function () {
  if (!this.id) {
    return Q.Promise.reject('Unable to Delete Object that Does Not Exist Remotely');
  }

  var deleteData = {
    wallet_names: [
      {
        domain_name: this.domainName,
        id: this.id
      }
    ]
  };

  return processRequest(this.client, '/v1/partner/walletname', 'DELETE', deleteData);

};

var NetkiClient = function (opts) {

  this.apiKeyAuth = opts.apiKey && opts.partnerID;
  this.distributedAuth = opts.partnerKskHex && opts.partnerKskSigHex && opts.userKey;
  this.partnerSignedAuth = opts.userKey && opts.partnerID;

  if (!this.apiKeyAuth && !this.distributedAuth && !this.partnerSignedAuth) {
    throw new TypeError('(partnerID AND apiKey) OR (partnerKskHex AND partnerKskSigNex AND userKey) OR (partnerID AND userKey) are required when instantiating netkiClient');
  }

  this.partnerId = opts.partnerID;
  this.apiKey = opts.apiKey;
  this.apiURL = opts.apiURL || 'https://api.netki.com';
  this.walletLookupURL = opts.walletLookupURL || 'https://pubapi.netki.com/api/wallet_lookup/';

  this.partnerKskHex = opts.partnerKskHex;
  this.partnerKskSigHex = opts.partnerKskSigHex;

  if(opts.userKey && !crypto.isECDSA(opts.userKey)) {
    throw new TypeError('userKey MUST be a ECDSA Private Key');
  }
  this.userKey = opts.userKey;
};

NetkiClient.prototype.getWalletNames = function (domainName, externalId) {

  var args = [],
    url,
    allWalletNames = [];

  if (domainName) {
    args.push('domain_name=' + domainName);
  }

  if (externalId) {
    args.push('external_id=' + encodeURIComponent(externalId));
  }

  url = '/v1/partner/walletname';
  if (args.length) {
    url = url + '?' + args.join('&');
  }

  var self = this;
  return processRequest(self, url, 'GET').then(function (response) {
    if (!response.wallet_name_count) {
      return [];
    }

    response.wallet_names.forEach(function (element) {

      var wn = new WalletName();
      wn.id = element.id;
      wn.domainName = element.domain_name;
      wn.name = element.name;
      wn.externalId = element.external_id;

      element.wallets.forEach(function (wallet) {
        wn.setCurrencyAddress(wallet.currency, wallet.wallet_address);
      });

      wn.setClient(self);

      allWalletNames.push(wn);
    });

    return allWalletNames;
  });
};

NetkiClient.prototype.createWalletName = function (domainName, name, currency, walletAddress, externalId) {

  var wn = new WalletName();
  wn.domainName = domainName;
  wn.name = name;
  wn.externalId = externalId;
  wn.setCurrencyAddress(currency, walletAddress);
  wn.setClient(this);

  return wn;
};

NetkiClient.prototype.lookupWalletName = function(walletName, currency) {
  return processRequest(null, this.walletLookupURL + walletName + '/' + currency, 'GET');
};

NetkiClient.prototype.createCertificate = function () {
  return new Certificate({}, this);
};

NetkiClient.prototype.getCertificate = function (id) {

  if(typeof id === 'undefined') {
    throw new TypeError('Certificate ID is Required');
  }

  var deferred = Q.defer();
  var cert = this.createCertificate();
  cert.id = id;
  cert.getStatus().then(function () {
    deferred.resolve(cert);
  });
  return deferred.promise;
};

NetkiClient.prototype.getAvailableProducts = function () {
  return processRequest(this, '/v1/certificate/products', 'GET').then(function (response) {
    return response.products;
  });
};

NetkiClient.prototype.getCACertBundle = function () {
  return processRequest(this, '/v1/certificate/cacert', 'GET').then(function (response) {
    return response.cacerts;
  });
};

NetkiClient.prototype.getAccountBalance = function () {
  return processRequest(this, '/v1/certificate/balance', 'GET').then(function (response) {
    return response.available_balance;
  });
};

module.exports = {

  netkiClient: NetkiClient, // For compatability reasons
  NetkiClient: NetkiClient,
  WalletName: WalletName,
  Certificate: Certificate,

  // Internal for Testing
  processRequest: processRequest,
  _crypto: crypto

};