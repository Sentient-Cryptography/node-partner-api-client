/*jslint node: true */
"use strict";

var request = require('request');
var Q = require('q');

var processRequest = function (partnerId, apiKey, apiURL, method, data) {
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
        'X-Partner-ID': partnerId,
        'Authorization': apiKey
      }
    };

    if (typeof(data) !== 'undefined') {
      options.body = JSON.stringify(data);
    }


    request(apiURL, options, function (error, response, body) {

      if (error) {
        return reject('HTTP Request Failed: ' + error);
      }

      if (response.headers['content-type'] != 'application/json') {
        return reject('HTTP Response Contains Invalid Content-Type: ' + response.headers['content-type']);
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

var walletName = function (id, domainName, name, wallets, externalId) {
  this.id = id;
  this.domainName = domainName;
  this.name = name;
  this.wallets = wallets || {};
  this.externalId = externalId;
};

walletName.prototype.setApiOpts = function (apiURL, apiKey, partnerId) {
  this.apiURL = apiURL;
  this.apiKey = apiKey;
  this.partnerId = partnerId;
};

walletName.prototype.getUsedCurrencies = function () {
  return Object.keys(this.wallets);
};

walletName.prototype.getWalletAddress = function (currency) {
  return this.wallets[currency];
};

walletName.prototype.setCurrencyAddress = function (currency, walletAddress) {
  this.wallets[currency] = walletAddress;
};

walletName.prototype.removeCurrencyAddress = function (currency) {
  if (typeof(this.wallets[currency]) !== 'undefined') {
    delete this.wallets[currency];
  }
};

walletName.prototype.save = function () {
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
    return processRequest(this.partnerId, this.apiKey, this.apiURL + '/v1/partner/walletname', 'PUT', postData);
  } else {
    return processRequest(this.partnerId, this.apiKey, this.apiURL + '/v1/partner/walletname', 'POST', postData)
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

walletName.prototype.delete = function () {
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

  return processRequest(this.partnerId, this.apiKey, this.apiURL + '/v1/partner/walletname', 'DELETE', deleteData);

};

var netkiClient = function (apiKey, partnerID, apiURL) {

  if (!partnerID || !apiKey) {
    throw new TypeError('partnerID and apiKey are required when instantiating netkiClient');
  }

  this.partnerId = partnerID;
  this.apiKey = apiKey;
  this.apiURL = apiURL || 'https://api.netki.com';
};

netkiClient.prototype.getWalletNames = function (domainName, externalId) {

  var args = [],
    url,
    allWalletNames = [],
    that = this;

  if (domainName) {
    args.push('domain_name=' + domainName);
  }

  if (externalId) {
    args.push('external_id=' + encodeURIComponent(externalId));
  }

  url = this.apiURL + '/v1/partner/walletname';
  if (args.length) {
    url = url + '?' + args.join('&');
  }

  return processRequest(this.partnerId, this.apiKey, url, 'GET').then(function (response) {
    if (!response.wallet_name_count) {
      return [];
    }

    response.wallet_names.forEach(function (element) {

      var wn = new walletName();
      wn.id = element.id;
      wn.domainName = element.domain_name;
      wn.name = element.name;
      wn.externalId = element.external_id;

      element.wallets.forEach(function (wallet) {
        wn.setCurrencyAddress(wallet.currency, wallet.wallet_address);
      });

      wn.setApiOpts(that.apiURL, that.apiKey, that.partnerId);

      allWalletNames.push(wn);
    });

    return allWalletNames;
  });
};

netkiClient.prototype.createWalletName = function (domainName, name, currency, walletAddress, externalId) {

  var wn = new walletName();
  wn.domainName = domainName;
  wn.name = name;
  wn.externalId = externalId;
  wn.setCurrencyAddress(currency, walletAddress);
  wn.setApiOpts(this.apiURL, this.apiKey, this.partnerId);

  return wn;
};


module.exports = {

  netkiClient: netkiClient,

  _processRequest: processRequest,
  _walletName: walletName

};