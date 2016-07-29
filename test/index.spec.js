/**
 * Created by frank on 7/29/15.
 */

var rewire = require('rewire'),
  netki = rewire('../lib/netki.js'),
  chai = require('chai'),
  sinon = require('sinon'),
  sinonChai = require('sinon-chai'),
  expect = chai.expect,
  nock = require('nock'),
  Q = require('q');

chai.use(sinonChai);

describe('Netki Partner Client Tests', function () {
  describe('processRequest function', function () {
    var partner_id = 'partner_id',
      api_key = 'api_key',
      uri = 'http://localhost:5000/v1/partner/walletname',
      postData = {key: 'value'},
      responseData = JSON.stringify({data: 'returned data'}),
      headers = {'content-type': 'application/json'};

    after(function (done) {
      nock.cleanAll();
      nock.restore();
      done();
    });

    var setupHTTPMock = function (method, statusCode, responseData, headers) {
      headers = headers || {'content-type': 'application/json'};

      nock('http://localhost:5000')
        .intercept('/v1/partner/walletname', method)
        .matchHeader('content-type', 'application/json')
        .reply(statusCode, responseData, headers);
    };

    it('Go right: Tests the GET method with statusCode 200 response', function (done) {

      setupHTTPMock('GET', 200, responseData);

      netki._processRequest(partner_id, api_key, uri, 'GET')
        .then(function (success) {
          expect(success).to.eql(JSON.parse(responseData));
        }).done(function () {
          done()
        });
    });

    it('Go right: Tests the PUT method with statusCode 201 response', function (done) {

      setupHTTPMock('PUT', 201, responseData);

      netki._processRequest(partner_id, api_key, uri, 'PUT', postData)
        .then(
        function (success) {
          expect(success).to.eql(JSON.parse(responseData));
        }).done(function () {
          done()
        });
    });

    it('Go right: Tests the POST method with statusCode 202 response', function (done) {

      setupHTTPMock('POST', 202, responseData);

      netki._processRequest(partner_id, api_key, uri, 'POST', postData)
        .then(
        function (success) {
          //expect(success.data).to.equal(JSON.parse(responseData).data);
          expect(success).to.eql(JSON.parse(responseData));
        }).done(function () {
          done()
        });
    });

    it('Go right: Tests the DELETE method with statusCode 204 response', function (done) {

      setupHTTPMock('DELETE', 204);

      netki._processRequest(partner_id, api_key, uri, 'DELETE')
        .then(
        function (success) {
          expect(success).to.eql({});
        }).done(function () {
          done()
        });
    });

    it('Tests an unsupported HTTP method', function (done) {

      netki._processRequest(partner_id, api_key, uri, 'PATCH', postData)
        .fail(function (error) {
          expect(error).to.equal('Unsupported HTTP method: PATCH')
        })
        .done(function () {
          done()
        });
    });

    it('Tests an exception parsing JSON response', function (done) {

      setupHTTPMock('GET', 200, 'not json');

      netki._processRequest(partner_id, api_key, uri, 'GET')
        .fail(function (error) {
          expect(error).to.equal('Error Parsing JSON Data: SyntaxError: Unexpected token o')
        })
        .done(function () {
          done()
        });
    });

    it('Tests an unsuccessful response status code with error message', function (done) {

      setupHTTPMock('GET', 400, JSON.stringify({message: 'Bad data'}));

      netki._processRequest(partner_id, api_key, uri, 'GET')
        .fail(function (error) {
          expect(error).to.equal('Request Failed: Bad data')
        })
        .done(function () {
          done()
        });
    });

    it('Tests a success false response with error message', function (done) {

      setupHTTPMock('GET', 200, JSON.stringify({success: false, message: 'Bad data'}));

      netki._processRequest(partner_id, api_key, uri, 'GET')
        .fail(function (error) {
          expect(error).to.equal('Request Failed: Bad data')
        })
        .done(function () {
          done()
        });
    });

    it('Tests a success false response with error message and failures', function (done) {
      var responseData = JSON.stringify(
        {
          success: false,
          message: 'Bad data',
          failures: [
            {
              message: 'first error'
            },
            {
              message: 'second error'
            }
          ]
        }
      );

      setupHTTPMock('GET', 200, responseData);

      netki._processRequest(partner_id, api_key, uri, 'GET')
        .fail(function (error) {
          expect(error).to.equal('Request Failed: Bad data [FAILURES: first error, second error]')
        })
        .done(function () {
          done()
        });
    });

  });

  describe('walletName functions and methods', function () {
    var wn;

    beforeEach(function () {
      wn = new netki._walletName();
      wn.id = 'id';
      wn.domainName = 'testdomain.com';
      wn.name = 'myname';
      wn.wallets = {btc: '1btcaddr', dgc: 'daddr'};
      wn.externalId = 'extid'
    });

    it('tests that walletName values can be updated', function () {
      expect(wn.id).to.equal('id');
      expect(wn.domainName).to.equal('testdomain.com');
      expect(wn.name).to.equal('myname');
      expect(wn.wallets).to.eql({btc: '1btcaddr', dgc: 'daddr'});
      expect(wn.externalId).to.equal('extid');
    });

    it('tests that walletName ApiOpts can be set', function () {
      wn.setApiOpts('myURL', 'myAPIKey', 'myPartnerID');

      expect(wn.apiURL).to.equal('myURL');
      expect(wn.apiKey).to.equal('myAPIKey');
      expect(wn.partnerId).to.equal('myPartnerID');
    });

    it('tests getUsedCurrencies returns wallets', function () {
      retVal = wn.getUsedCurrencies();

      expect(retVal).to.eql(['btc', 'dgc']);
    });

    it('tests getWalletAddress returns the wallet address', function () {
      retVal = wn.getWalletAddress('btc');

      expect(retVal).to.equal('1btcaddr');
    });

    it('tests setCurrencyAddress creates/updates a Wallet Name currency', function () {
      wn.setCurrencyAddress('ltc', 'Laddr');

      expect(wn.wallets).to.eql({btc: '1btcaddr', dgc: 'daddr', ltc: 'Laddr'});
    });

    it('tests removeCurrencyAddress deletes a Wallet Name currency', function () {
      wn.removeCurrencyAddress('dgc');

      expect(wn.wallets).to.eql({btc: '1btcaddr'});
    });
  });

  describe('tests Wallet Name save conditions', function () {

    var wn, postData, prSpy;

    beforeEach(function () {
      wn = new netki._walletName();
      wn.id = 'id';
      wn.domainName = 'testdomain.com';
      wn.name = 'myname';
      wn.wallets = {btc: '1btcaddr', dgc: 'daddr'};
      wn.externalId = 'extid';

      wn.setApiOpts('myURL', 'myAPIKey', 'myPartnerID');

      postData = {
        wallet_names: [
          {
            domain_name: wn.domainName,
            name: wn.name,
            id: 'id',
            wallets: [
              {currency: 'btc', wallet_address: '1btcaddr'},
              {currency: 'dgc', wallet_address: 'daddr'}
            ],
            external_id: wn.externalId
          }
        ]
      };

      // TODO: Look into getting this function and spying on it or doing whatever vs. replace.
      var thing = netki.__get__('processRequest');

      prSpy = sinon.stub(netki, '_processRequest').returns(
        Q.Promise(function (resolve) {
          return resolve({wallet_names: [{domain_name: wn.domainName, name: wn.name, id: 'newID'}]})
        })
      );

      netki.__set__('processRequest', prSpy);

    });

    afterEach(function () {
      netki._processRequest.restore();
    });

    it('tests saving a Wallet Name: Update go right case', function (done) {

      wn.save().then(function () {
        expect(prSpy).to.have.been.calledWithExactly(
          wn.partnerId,
          wn.apiKey,
          wn.apiURL + '/v1/partner/walletname',
          'PUT',
          postData
        );
      }).done(function () {
        done();
      });
    });

    it('tests saving a Wallet Name: Create go right case', function (done) {

      wn.id = null;
      delete postData['wallet_names'][0]['id'];

      wn.save().then(function () {
        expect(wn.id).to.equal('newID');

        expect(prSpy).to.have.been.calledWithExactly(
          wn.partnerId,
          wn.apiKey,
          wn.apiURL + '/v1/partner/walletname',
          'POST',
          postData
        );
      }).done(function () {
        done();
      });
    })

  });

  describe('tests Wallet Name delete conditions', function () {

    var wn, postData, prSpy;

    beforeEach(function () {
      wn = new netki._walletName();
      wn.id = 'id';
      wn.domainName = 'testdomain.com';
      wn.name = 'myname';
      wn.wallets = {btc: '1btcaddr', dgc: 'daddr'};
      wn.externalId = 'extid';

      wn.setApiOpts('myURL', 'myAPIKey', 'myPartnerID');

      postData = {
        wallet_names: [
          {
            domain_name: wn.domainName,
            id: 'id'
          }
        ]
      };

      // TODO: Look into getting this function and spying on it or doing whatever vs. replace.
      var thing = netki.__get__('processRequest');

      prSpy = sinon.stub(netki, '_processRequest').returns(
        Q.Promise(function (resolve) {
          return resolve({wallet_names: [{domain_name: wn.domainName, name: wn.name, id: 'newID'}]})
        })
      );

      netki.__set__('processRequest', prSpy);

    });

    afterEach(function () {
      netki._processRequest.restore();
    });

    it('tests deleting a Wallet Name: Update go right case', function (done) {

      wn.delete().then(function () {
        expect(prSpy).to.have.been.calledWithExactly(
          wn.partnerId,
          wn.apiKey,
          wn.apiURL + '/v1/partner/walletname',
          'DELETE',
          postData
        );
      }).done(function () {
        done();
      });
    });

    it('tests deleting a Wallet Name without an id', function (done) {

      wn.id = null;

      wn.delete().fail(function (error) {
        expect(error).to.equal('Unable to Delete Object that Does Not Exist Remotely')
      }).done(function () {
        done();
      });

    })

  });

  describe('netkiClient functions and methods', function () {
    var apiURL = 'myURL',
      apiKey = 'myApiKey',
      partnerID = 'myPartnerId';

    it('verifies the initialization values can be specified', function () {

      var nClient = new netki.netkiClient(apiKey, partnerID, apiURL);

      expect(nClient.apiKey).to.equal(apiKey);
      expect(nClient.partnerId).to.equal(partnerID);
      expect(nClient.apiURL).to.equal(apiURL);
    });

    it('verifies the apiURL default value', function () {

      var nClient = new netki.netkiClient(apiKey, partnerID);

      expect(nClient.apiKey).to.equal(apiKey);
      expect(nClient.partnerId).to.equal(partnerID);
      expect(nClient.apiURL).to.equal('https://api.netki.com');
    });

    it('verifies that a missing apiKey during client instantiation results in an exception', function () {

      expect(function () {
        new netki.netkiClient('', partnerID, apiURL)
      }).to.throw(
        TypeError,
        /partnerID and apiKey are required when instantiating netkiClient/
      );

    });

    it('verifies that a missing partnerID during client instantiation results in an exception', function () {

      expect(function () {
        new netki.netkiClient(apiKey, '', apiURL)
      }).to.throw(
        TypeError,
        /partnerID and apiKey are required when instantiating netkiClient/
      );

    });

    describe('netkiClient getWalletName tests', function () {
      var nClient,
        prSpy,
        walletData = [];

      walletData.push(
        {
          id: 'myID',
          domain_name: 'testdomain.com',
          name: 'myName',
          external_id: 'myExtId',
          wallets: [
            {
              currency: 'btc',
              wallet_address: '1btcaddress'
            }
          ]
        }
      );

      beforeEach(function () {
        nClient = new netki.netkiClient(apiKey, partnerID, apiURL);

        // TODO: Look into getting this function and spying on it or doing whatever vs. replace.
        var thing = netki.__get__('processRequest');

        prSpy = sinon.stub(netki, '_processRequest').returns(
          Q.Promise(function (resolve) {
            return resolve({wallet_name_count: 1, wallet_names: walletData})
          })
        );

        netki.__set__('processRequest', prSpy);

      });

      afterEach(function () {
        netki._processRequest.restore();
      });

      it('tests fetching all Wallet Names (no arguments): Go right 1 result', function (done) {

        nClient.getWalletNames().then(function (retVal) {

          expect(prSpy).to.have.been.calledWithExactly(
            partnerID,
            apiKey,
            apiURL + '/v1/partner/walletname',
            'GET'
          );

          // Validate created Wallet Name object
          var wnObj = retVal[0];
          expect(wnObj.id).to.equal('myID');
          expect(wnObj.domainName).to.equal('testdomain.com');
          expect(wnObj.name).to.equal('myName');
          expect(wnObj.externalId).to.equal('myExtId');
          expect(wnObj.wallets).to.eql({btc: '1btcaddress'});
          expect(wnObj.apiURL).to.equal(apiURL);
          expect(wnObj.apiKey).to.equal(apiKey);
          expect(wnObj.partnerId).to.equal(partnerID);

        }).done(function () {
          done();
        });

      });

      it('tests fetching all Wallet Names (no arguments): Go right 2 results', function (done) {

        walletData.push(
          {
            id: 'myID2',
            domain_name: 'testdomain2.com',
            name: 'myName2',
            external_id: 'myExtId2',
            wallets: [
              {
                currency: 'dgc',
                wallet_address: 'Doggyaddy'
              }
            ]
          }
        );

        nClient.getWalletNames().then(function (retVal) {

          expect(prSpy).to.have.been.calledWithExactly(
            partnerID,
            apiKey,
            apiURL + '/v1/partner/walletname',
            'GET'
          );

          // Validate created Wallet Name object
          var wnObj = retVal[0];
          expect(wnObj.id).to.equal('myID');
          expect(wnObj.domainName).to.equal('testdomain.com');
          expect(wnObj.name).to.equal('myName');
          expect(wnObj.externalId).to.equal('myExtId');
          expect(wnObj.wallets).to.eql({btc: '1btcaddress'});
          expect(wnObj.apiURL).to.equal(apiURL);
          expect(wnObj.apiKey).to.equal(apiKey);
          expect(wnObj.partnerId).to.equal(partnerID);

          var wnObj2 = retVal[1];
          expect(wnObj2.id).to.equal('myID2');
          expect(wnObj2.domainName).to.equal('testdomain2.com');
          expect(wnObj2.name).to.equal('myName2');
          expect(wnObj2.externalId).to.equal('myExtId2');
          expect(wnObj2.wallets).to.eql({dgc: 'Doggyaddy'});
          expect(wnObj2.apiURL).to.equal(apiURL);
          expect(wnObj2.apiKey).to.equal(apiKey);
          expect(wnObj2.partnerId).to.equal(partnerID);

        }).done(function () {
          done();
        });
      });

      it('tests fetching Wallet Names with the domainName argument: Go right', function (done) {

        nClient.getWalletNames('testdomain.com').then(function (retVal) {

          expect(prSpy).to.have.been.calledWithExactly(
            partnerID,
            apiKey,
            apiURL + '/v1/partner/walletname?domain_name=testdomain.com',
            'GET'
          );

        }).done(function () {
          done();
        });

      });

      it('tests fetching Wallet Names with the externalId argument: Go right', function (done) {

        nClient.getWalletNames(null, 'my+ExtID').then(function (retVal) {

          expect(prSpy).to.have.been.calledWithExactly(
            partnerID,
            apiKey,
            apiURL + '/v1/partner/walletname?external_id=my%2BExtID',
            'GET'
          );

        }).done(function () {
          done();
        });

      });

      it('tests fetching Wallet Names with the domainName and externalId argument: Go right', function (done) {

        nClient.getWalletNames('testdomain.com', 'myExtID').then(function (retVal) {

          expect(prSpy).to.have.been.calledWithExactly(
            partnerID,
            apiKey,
            apiURL + '/v1/partner/walletname?domain_name=testdomain.com&external_id=myExtID',
            'GET'
          );

        }).done(function () {
          done();
        });

      });

      it('tests fetching Wallet Names with no results: Go right', function (done) {

        netki._processRequest.restore();
        prSpy = sinon.stub(netki, '_processRequest').returns(
          Q.Promise(function (resolve) {
            return resolve({wallet_name_count: 0})
          })
        );

        netki.__set__('processRequest', prSpy);

        nClient.getWalletNames().then(function (retVal) {

          expect(prSpy).to.have.been.calledWithExactly(
            partnerID,
            apiKey,
            apiURL + '/v1/partner/walletname',
            'GET'
          );

          expect(retVal).to.eql([])

        }).done(function () {
          done();
        });

      });

    });

    describe('netkiClient createWalletName tests', function () {
      it('creates a new Wallet Name', function () {
        var nClient = new netki.netkiClient(apiKey, partnerID, apiURL),
          retVal = nClient.createWalletName('testdomain.com', 'myName', 'btc', '1btcaddy', 'myExtId');

        expect(retVal.domainName).to.equal('testdomain.com');
        expect(retVal.name).to.equal('myName');
        expect(retVal.externalId).to.equal('myExtId');
        expect(retVal.wallets).to.eql({'btc': '1btcaddy'});
        expect(retVal.apiURL).to.equal(apiURL);
        expect(retVal.apiKey).to.equal(apiKey);
        expect(retVal.partnerId).to.equal(partnerID);

      });

    });

    describe('netkiClient lookupWalletName tests', function () {
      var nClient,
        prSpy;

      beforeEach(function () {
        nClient = new netki.netkiClient(apiKey, partnerID, apiURL);

        // TODO: Look into getting this function and spying on it or doing whatever vs. replace.
        var thing = netki.__get__('processRequest');

        prSpy = sinon.stub(netki, '_processRequest').returns(
          Q.Promise(function (resolve) {
            return resolve('apiData')
          })
        );

        netki.__set__('processRequest', prSpy);

      });

      afterEach(function () {
        netki._processRequest.restore();
      });

      it('looks up a Wallet Name', function () {
        nClient.lookupWalletName('wallet.BruceWayne.rocks', 'btc').then(function(retVal) {
          expect(retVal).to.equal('apiData');
        });

      })
    })

  });

});