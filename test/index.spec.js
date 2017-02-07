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
  Q = require('q'),
  KJUR = require('jsrsasign'),
  version = require('../package').version;

chai.use(sinonChai);

describe('Netki Partner Client Tests', function () {

  var userKey = KJUR.KEYUTIL.generateKeypair('EC', 'secp256k1');

  describe('processRequest', function () {

    var partner_id = 'partner_id',
      api_key = 'api_key',
      uri = '/v1/partner/walletname',
      postData = {key: 'value'},
      responseData = JSON.stringify({data: 'returned data'}),
      headers = {'content-type': 'application/json'},
      client = new netki.NetkiClient({apiKey: api_key, partnerID: partner_id, apiURL: 'http://localhost:5000'});

    after(function (done) {
      nock.cleanAll();
      nock.restore();
      done();
    });

    var setupHTTPMock = function (method, statusCode, responseData, headers) {
      headers = headers || {'content-type': 'application/json'};

      return nock('http://localhost:5000')
        .intercept('/v1/partner/walletname', method)
        .matchHeader('content-type', 'application/json')
        .matchHeader('user-agent', 'Netki-NodeJS/' + version)
        .reply(statusCode, responseData, headers);
    };

    it('Go right: Tests the GET method with statusCode 200 response', function (done) {

      var n = setupHTTPMock('GET', 200, responseData);

      netki.processRequest(client, uri, 'GET')
        .then(function (success) {
          expect(n.isDone()).to.be.true;
          expect(success).to.eql(JSON.parse(responseData));
        }).done(function () {
          done()
        });
    });

    it('Go right: Tests the PUT method with statusCode 201 response', function (done) {

      var n = setupHTTPMock('PUT', 201, responseData);

      netki.processRequest(client, uri, 'PUT', postData)
        .then(
        function (success) {
          expect(n.isDone()).to.be.true;
          expect(success).to.eql(JSON.parse(responseData));
        }).done(function () {
          done()
        });
    });

    it('Go right: Tests the POST method with statusCode 202 response', function (done) {

      var n = setupHTTPMock('POST', 202, responseData);

      netki.processRequest(client, uri, 'POST', postData)
        .then(
        function (success) {
          expect(n.isDone()).to.be.true;
          expect(success).to.eql(JSON.parse(responseData));
        }).done(function () {
          done()
        });
    });

    it('Go right: Tests the DELETE method with statusCode 204 response', function (done) {

      var n = setupHTTPMock('DELETE', 204);

      netki.processRequest(client, uri, 'DELETE')
        .then(
        function (success) {
          expect(n.isDone()).to.be.true;
          expect(success).to.eql({});
        }).done(function () {
          done()
        });
    });

    it('Tests an unsupported HTTP method', function (done) {

      netki.processRequest(client, uri, 'PATCH', postData)
        .fail(function (error) {
          expect(error).to.equal('Unsupported HTTP method: PATCH')
        })
        .done(function () {
          done()
        });
    });

    it('Tests an exception parsing JSON response', function (done) {

      var n = setupHTTPMock('GET', 200, 'not json');

      netki.processRequest(client, uri, 'GET')
        .fail(function (error) {
          expect(n.isDone()).to.be.true;
          expect(error).to.match(/^Error Parsing JSON Data: SyntaxError: Unexpected token o/)
        })
        .done(function () {
          done()
        });
    });

    it('Tests an unsuccessful response status code with error message', function (done) {

      var n = setupHTTPMock('GET', 400, JSON.stringify({message: 'Bad data'}));

      netki.processRequest(client, uri, 'GET')
        .fail(function (error) {
          expect(n.isDone()).to.be.true;
          expect(error).to.equal('Request Failed: Bad data')
        })
        .done(function () {
          done()
        });
    });

    it('Tests a success false response with error message', function (done) {

      var n = setupHTTPMock('GET', 200, JSON.stringify({success: false, message: 'Bad data'}));

      netki.processRequest(client, uri, 'GET')
        .fail(function (error) {
          expect(n.isDone()).to.be.true;
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

      var n = setupHTTPMock('GET', 200, responseData);

      netki.processRequest(client, uri, 'GET')
        .fail(function (error) {
          expect(n.isDone()).to.be.true;
          expect(error).to.equal('Request Failed: Bad data [FAILURES: first error, second error]')
        })
        .done(function () {
          done()
        });
    });

    it('Go Right: Tests distributedAuth headers', function (done) {

      var _client = new netki.NetkiClient({partnerKskHex: 'ffff', partnerKskSigHex: 'ffff', apiURL: 'http://localhost:5000', userKey: userKey});

      var n = setupHTTPMock('POST', 200, responseData)
          .matchHeader('X-Partner-Key', 'ffff')
          .matchHeader('X-Partner-KeySig', 'ffff')
          .matchHeader('X-Identity', /^[0-9a-f]+$/i)
          .matchHeader('X-Signature', /^[0-9a-f]+$/i);

      netki.processRequest(_client, uri, 'POST', {key: 'value'})
          .then(function () {
            expect(n.isDone()).to.be.true;
          }).done(function () {
            done();
          });
    });

    it('Go Right: Tests partnerSignedAuth headers', function (done) {

      var _client = new netki.NetkiClient({partnerID: 'partnerID', apiURL: 'http://localhost:5000', userKey: userKey});

      var n = setupHTTPMock('POST', 200, responseData)
          .matchHeader('X-Partner-ID', 'partnerID')
          .matchHeader('X-Identity', /^[0-9a-f]+$/i)
          .matchHeader('X-Signature', /^[0-9a-f]+$/i);

      netki.processRequest(_client, uri, 'POST', {key: 'value'})
          .then(function () {
            expect(n.isDone()).to.be.true;
          }).done(function () {
            done();
          });
    });

  });

  describe('Certificate', function () {

    var prStub, client;

    beforeEach(function () {
      client = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
      prStub = sinon.stub(netki, 'processRequest');
      netki.__set__('processRequest', prStub);
    });

    afterEach(function () {
      netki.processRequest.restore();
    });

    it('new Certificate()', function (done) {
      var cert = new netki.Certificate({address: '123 Main St.'}, 'client');
      expect(cert.customerData.address).to.equal('123 Main St.');
      expect(cert.client).to.equal('client');
      done();
    });

    it('Certificate.setClient', function (done) {
      var cert = new netki.Certificate();
      cert.setClient('clientObject');
      expect(cert.client).to.equal('clientObject');
      done();
    });

    it('Certificate.setCustomerData', function (done) {
      var cert = new netki.Certificate();
      cert.setCustomerData({
        address: '123 Main St.',
        country: 'US'
      });
      expect(cert.customerData.address).to.equal('123 Main St.');
      expect(cert.customerData.country).to.equal('US');
      done();
    });

    it('Certificate.generateCSR', function () {

      var rsaKey = KJUR.KEYUTIL.generateKeypair('RSA', 1024);

      var cert = new netki.Certificate({
        organizationName: 'partnerName',
        country: 'US',
        city: 'Los Angeles',
        firstName: 'Testy',
        lastName: 'Testerson',
        state: 'CA',
        streetAddress: '123 Main St.',
        postalCode: '90001'
      });

      var csrRet = cert.generateCSR(rsaKey);

      expect(csrRet).to.match(/BEGIN CERTIFICATE REQUEST/);

      var info = KJUR.asn1.csr.CSRUtil.getInfo(csrRet);
      expect(info.subject.name).to.equal('/C=US/O=partnerName/L=Los Angeles/CN=Testy Testerson/ST=CA/STREET=123 Main St./postalCode=90001');
    });

    it('Certificate.submitUserData', function (done) {

      // Setup processRequest Stub
      prStub.returns(
          Q.when({token: 'data_token'})
      );

      var cert = new netki.Certificate({
        organizationName: 'partnerName',
        country: 'US',
        city: 'Los Angeles',
        firstName: 'Testy',
        middleName: 'Veritas',
        lastName: 'Testerson',
        state: 'CA',
        streetAddress: '123 Main St.',
        postalCode: '90001',
        email: 'user@domain.com',
        dob: new Date('1981-01-02'),
        phone: '8181234567',
        ssn: '123456789',
        identity: '1234567890',
        identityType: 'drivers license',
        identityExpiration: new Date('2030-01-02'),
        identityState: 'CA',
        identityGender: 'M'
      }, 'client');
      cert.product = 'product_id';

      var submitData = JSON.parse('{"product":"product_id", "first_name":"Testy","middle_name":"Veritas","last_name":"Testerson","email":"user@domain.com","street_address":"123 Main St.","city":"Los Angeles","state":"CA","postal_code":"90001","country":"US","dob":"1981-01-01","phone":"8181234567","ssn":"123456789","identity":"1234567890","identity_type":"drivers license","identity_expiration":"2030-01-01","identity_state":"CA","identity_gender":"M"}');

      cert.submitUserData().then(function () {
        expect(cert.dataToken).to.equal('data_token');
        expect(prStub.args[0][3]).to.deep.equal(submitData);
        expect(prStub.calledWithExactly('client', '/v1/certificate/token', 'POST', submitData));
        done();
      });
    });

    describe('Certificate.submitOrder', function () {

      it('Submits a Certificate Order with Stripe token', function (done) {

        // Setup processRequest Stub
        prStub.returns(
          Q.when({order_id: 'order_id'})
        );

        var cert = new netki.Certificate({email: 'user@domain.com'}, 'client');
        cert.dataToken = 'data_token';
        cert.product = 'product_id';

        var submitData = {
          certdata_token: 'data_token',
          email: 'user@domain.com',
          product: 'product_id',
          stripe_token: 'stripeToken'
        };

        cert.submitOrder('stripeToken').then(function () {
          expect(cert.id).to.equal('order_id');
          expect(prStub.calledWithExactly('client', '/v1/certificate/token', 'POST', submitData));
          done();
        });
      });

      it('Submits a Certificate Order without Stripe token', function (done) {

        // Setup processRequest Stub
        prStub.returns(
            Q.when({order_id: 'order_id'})
        );

        var cert = new netki.Certificate({email: 'user@domain.com'}, 'client');
        cert.dataToken = 'data_token';
        cert.product = 'product_id';

        var submitData = {
          certdata_token: 'data_token',
          email: 'user@domain.com',
          product: 'product_id'
        };

        cert.submitOrder().then(function () {
          expect(cert.id).to.equal('order_id');
          expect(prStub.calledWithExactly('client', '/v1/certificate/token', 'POST', submitData));
          done();
        });
      });

      it('Cannot Submit Because DataToken is Missing', function () {
        var cert = new netki.Certificate({email: 'user@domain.com', product: 'product_id'}, 'client');
        try {
          cert.submitOrder();
          assert.fail();
        } catch (err) {
          expect(err).to.be.an.instanceof(TypeError);
          expect(err.message).to.equal('Data Submission Not Yet Completed');
        }
      });

      it('Cannot Submit Because Certificate Has Already Been Submitted', function () {
        var cert = new netki.Certificate({email: 'user@domain.com'}, 'client');
        cert.dataToken = 'data_token';
        cert.id = 'orderId';
        cert.product = 'product_id';

        try {
          cert.submitOrder();
          assert.fail();
        } catch (err) {
          expect(err).to.be.an.instanceof(TypeError);
          expect(err.message).to.equal('Certificate Order Has Already Been Submitted');
        }
      });

    });

    describe('Certificate.submitCSR', function () {

      it('Submits a CSR for an Existing Certificate Order', function (done) {

        // Setup processRequest Stub
        prStub.returns(Q.when());

        var cert = new netki.Certificate({}, 'client');
        cert.id = 'orderId';

        var generateCSRStub = sinon.stub(cert, 'generateCSR', function () { return 'CSR' });
        var submitData = {
          signed_csr: 'CSR'
        };

        cert.submitCSR('rsaKey').then(function () {
          expect(generateCSRStub.called).to.be.true;
          expect(prStub.calledWithExactly('client', '/v1/certificate/orderId', 'POST', submitData));
          cert.generateCSR.restore();
          done();
        });
      });

      it('Fails to submit a CSR due to lack of OrderId', function () {

        var cert = new netki.Certificate({}, 'client');
        var generateCSRStub = sinon.stub(cert, 'generateCSR', function () { return 'CSR' });

        try {
          cert.submitCSR('rsaKey');
        } catch(err) {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.equal('Certificate Must Have a Valid Order Number / ID');
        }

        expect(generateCSRStub.called).to.be.false;
        expect(prStub.called).to.be.false;

      });

    });

    describe('Certificate.revoke', function () {

      it('Submits a Certificate revocation request', function (done) {

        // Setup processRequest Stub
        prStub.returns(Q.when());

        var cert = new netki.Certificate({}, 'client');
        cert.id = 'orderId';

        var submitData = {
          revocation_reason: 'reason'
        };

        cert.revoke('reason').then(function () {
          expect(prStub.calledWithExactly('client', '/v1/certificate/orderId', 'DELETE', submitData));
          done();
        });

      });

      it('Fails to submit a Certificate revocation request due to lack of OrderId', function () {

        var cert = new netki.Certificate({}, 'client');

        try {
          cert.revoke('reason');
        } catch(err) {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.equal('Certificate Must Have a Valid Order Number / ID');
        }

        expect(prStub.called).to.be.false;

      });

    });

    describe('Certificate.getStatus', function () {

      it('Retrieves a Certificate Status', function (done) {

        // Setup processRequest Stub
        prStub.returns(
              Q.when({
                  order_status: 'COMPLETE',
                  order_error: 'SOME ERROR',
                  certificate_bundle: {
                    root: 'ROOT_PEM',
                    intermediate: ['INT1_PEM', 'INT2_PEM'],
                    certificate: 'CERT_PEM'
                  }
              })
        );

        var cert = new netki.Certificate({}, 'client');
        cert.id = 'OrderId';

        cert.getStatus().then(function () {

          expect(cert.orderStatus).to.equal('COMPLETE');
          expect(cert.orderError).to.equal('SOME ERROR');
          expect(cert.bundle.root).to.equal('ROOT_PEM');
          expect(cert.bundle.certificate).to.equal('CERT_PEM');
          expect(cert.bundle.intermediate[0]).to.equal('INT1_PEM');
          expect(cert.bundle.intermediate[1]).to.equal('INT2_PEM');

          expect(prStub.called).to.be.true;
          done();
        });

      });

      it('Fails to Retrieve a Certificate status due to lack of OrderId', function () {

        var cert = new netki.Certificate({}, 'client');

        try {
          cert.getStatus();
        } catch(err) {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.equal('Certificate Must Have a Valid Order Number / ID');
        }

        expect(prStub.called).to.be.false;

      });

    });

    it('Certificate.setProduct', function () {
      var cert = new netki.Certificate({}, 'client');
      cert.setProduct({id: 'product_id'});
      expect(cert.product).to.equal('product_id');
    });

    describe('Certificate.isOrderComplete', function () {

      var cert = new netki.Certificate({}, 'client');
      var getStatus;

      beforeEach(function () {
        getStatus = sinon.stub(cert, 'getStatus');
      });

      afterEach(function () {
        cert.getStatus.restore();
      });

      it('Certificate has no orderStatus', function () {
        cert.orderStatus = null;
        expect(cert.isOrderComplete()).to.be.false;
        expect(getStatus.called).to.be.true;
      });

      it('Certificate has non-final orderStatus', function () {
        cert.orderStatus = 'Pending';
        expect(cert.isOrderComplete()).to.be.false;
        expect(getStatus.called).to.be.true;
      });

      it('Certificate has final orderStatus', function () {
        cert.orderStatus = 'Order Finalized';
        expect(cert.isOrderComplete()).to.be.true;
        expect(getStatus.called).to.be.false;
      })

    })

  });

  describe('WalletName', function () {
    var wn;

    beforeEach(function () {
      wn = new netki.WalletName();
      wn.id = 'id';
      wn.domainName = 'testdomain.com';
      wn.name = 'myname';
      wn.wallets = {btc: '1btcaddr', dgc: 'daddr'};
      wn.externalId = 'extid'
    });

    it('tests that WalletName values can be updated', function () {
      expect(wn.id).to.equal('id');
      expect(wn.domainName).to.equal('testdomain.com');
      expect(wn.name).to.equal('myname');
      expect(wn.wallets).to.eql({btc: '1btcaddr', dgc: 'daddr'});
      expect(wn.externalId).to.equal('extid');
    });

    it('tests that WalletName setClient can be set', function () {
      var client = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
      wn.setClient(client);

      expect(wn.client).to.equal(client);
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

  describe('WalletName Save', function () {

    var wn, postData, prStub, client;

    beforeEach(function () {
      wn = new netki.WalletName();
      wn.id = 'id';
      wn.domainName = 'testdomain.com';
      wn.name = 'myname';
      wn.wallets = {btc: '1btcaddr', dgc: 'daddr'};
      wn.externalId = 'extid';

      client = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
      wn.setClient(client);

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

      prStub = sinon.stub(netki, 'processRequest').returns(
        Q.when({wallet_names: [{domain_name: wn.domainName, name: wn.name, id: 'newID'}]})
      );
      netki.__set__('processRequest', prStub);

    });

    afterEach(function () {
      netki.processRequest.restore();
    });

    it('tests saving a Wallet Name: Update go right case', function (done) {

      wn.save().then(function () {
        expect(prStub).to.have.been.calledWithExactly(
          client,
          '/v1/partner/walletname',
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

        expect(prStub).to.have.been.calledWithExactly(
          client,
          '/v1/partner/walletname',
          'POST',
          postData
        );
      }).done(function () {
        done();
      });
    })

  });

  describe('WalletName Delete', function () {

    var wn, postData, prStub, client;

    beforeEach(function () {
      wn = new netki.WalletName();
      wn.id = 'id';
      wn.domainName = 'testdomain.com';
      wn.name = 'myname';
      wn.wallets = {btc: '1btcaddr', dgc: 'daddr'};
      wn.externalId = 'extid';

      client = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
      wn.setClient(client);

      postData = {
        wallet_names: [
          {
            domain_name: wn.domainName,
            id: 'id'
          }
        ]
      };

      prStub = sinon.stub(netki, 'processRequest').returns(
        Q.when({wallet_names: [{domain_name: wn.domainName, name: wn.name, id: 'newID'}]})
      );

      netki.__set__('processRequest', prStub);

    });

    afterEach(function () {
      netki.processRequest.restore();
    });

    it('tests deleting a Wallet Name: Update go right case', function (done) {

      wn.delete().then(function () {
        expect(prStub).to.have.been.calledWithExactly(
          client,
          '/v1/partner/walletname',
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

  describe('NetkiClient', function () {

    var prStub;
    var apiURL = 'myURL', apiKey = 'myApiKey', partnerID = 'myPartnerId';

    beforeEach(function () {
      prStub = sinon.stub(netki, 'processRequest');
      netki.__set__('processRequest', prStub);
    });

    afterEach(function () {
      netki.processRequest.restore();
    });

    it('verifies the initialization values can be specified', function () {

      var nClient = new netki.NetkiClient({apiKey: apiKey, partnerID: partnerID, apiURL: apiURL});

      expect(nClient.apiKey).to.equal(apiKey);
      expect(nClient.partnerId).to.equal(partnerID);
      expect(nClient.apiURL).to.equal(apiURL);
    });

    it('verifies distributedAuth initialization values', function () {

      var nClient = new netki.NetkiClient({partnerKskHex: 'ffff', partnerKskSigHex: 'ffff', userKey: userKey});

      expect(nClient.partnerKskHex).to.equal('ffff');
      expect(nClient.partnerKskSigHex).to.equal('ffff');
      expect(nClient.userKey).to.equal(userKey);

    });

    it('verifies partnerAuth initialization values', function () {

      var nClient = new netki.NetkiClient({partnerID: 'PartnerID', userKey: userKey});

      expect(nClient.partnerId).to.equal('PartnerID');
      expect(nClient.userKey).to.equal(userKey);

    });

    it('verifies the apiURL default value', function () {

      var nClient = new netki.NetkiClient({apiKey: apiKey, partnerID: partnerID});

      expect(nClient.apiKey).to.equal(apiKey);
      expect(nClient.partnerId).to.equal(partnerID);
      expect(nClient.apiURL).to.equal('https://api.netki.com');
    });

    it('verifies that a missing apiKey during client instantiation results in an exception', function () {

      expect(function () {
        new netki.NetkiClient({partnerID: partnerID, apiURL: apiURL});
      }).to.throw(
        TypeError,
        '(partnerID AND apiKey) OR (partnerKskHex AND partnerKskSigNex AND userKey) OR (partnerID AND userKey) are required when instantiating netkiClient'
      );

    });

    it('verifies that a missing partnerID during client instantiation results in an exception', function () {

      expect(function () {
        new netki.NetkiClient({apiKey: apiKey, apiURL: apiURL});
      }).to.throw(
        TypeError,
        '(partnerID AND apiKey) OR (partnerKskHex AND partnerKskSigNex AND userKey) OR (partnerID AND userKey) are required when instantiating netkiClient'
      );

    });

    describe('getWalletName', function () {
      var nClient, walletData = [];

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
        nClient = new netki.NetkiClient({apiKey: apiKey, partnerID: partnerID, apiURL: apiURL});
        prStub.returns(
          Q.when({wallet_name_count: 1, wallet_names: walletData})
        );

      });

      it('tests fetching all Wallet Names (no arguments): Go right 1 result', function (done) {

        nClient.getWalletNames().then(function (retVal) {

          expect(prStub).to.have.been.calledWithExactly(
              nClient,
              '/v1/partner/walletname',
              'GET'
          );

          // Validate created Wallet Name object
          var wnObj = retVal[0];
          expect(wnObj.id).to.equal('myID');
          expect(wnObj.domainName).to.equal('testdomain.com');
          expect(wnObj.name).to.equal('myName');
          expect(wnObj.externalId).to.equal('myExtId');
          expect(wnObj.wallets).to.eql({btc: '1btcaddress'});
          expect(wnObj.client).to.equal(nClient);

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

          expect(prStub).to.have.been.calledWithExactly(
              nClient,
              '/v1/partner/walletname',
              'GET'
          );

          // Validate created Wallet Name object
          var wnObj = retVal[0];
          expect(wnObj.id).to.equal('myID');
          expect(wnObj.domainName).to.equal('testdomain.com');
          expect(wnObj.name).to.equal('myName');
          expect(wnObj.externalId).to.equal('myExtId');
          expect(wnObj.wallets).to.eql({btc: '1btcaddress'});
          expect(wnObj.client).to.equal(nClient);

          var wnObj2 = retVal[1];
          expect(wnObj2.id).to.equal('myID2');
          expect(wnObj2.domainName).to.equal('testdomain2.com');
          expect(wnObj2.name).to.equal('myName2');
          expect(wnObj2.externalId).to.equal('myExtId2');
          expect(wnObj2.wallets).to.eql({dgc: 'Doggyaddy'});
          expect(wnObj2.client).to.equal(nClient);

        }).done(function () {
          done();
        });
      });

      it('tests fetching Wallet Names with the domainName argument: Go right', function (done) {

        nClient.getWalletNames('testdomain.com').then(function () {

          expect(prStub).to.have.been.calledWithExactly(
            nClient,
            '/v1/partner/walletname?domain_name=testdomain.com',
            'GET'
          );

        }).done(function () {
          done();
        });

      });

      it('tests fetching Wallet Names with the externalId argument: Go right', function (done) {

        nClient.getWalletNames(null, 'my+ExtID').then(function () {

          expect(prStub).to.have.been.calledWithExactly(
            nClient,
            '/v1/partner/walletname?external_id=my%2BExtID',
            'GET'
          );

        }).done(function () {
          done();
        });

      });

      it('tests fetching Wallet Names with the domainName and externalId argument: Go right', function (done) {

        nClient.getWalletNames('testdomain.com', 'myExtID').then(function () {

          expect(prStub).to.have.been.calledWithExactly(
            nClient,
            '/v1/partner/walletname?domain_name=testdomain.com&external_id=myExtID',
            'GET'
          );

        }).done(function () {
          done();
        });

      });

      it('tests fetching Wallet Names with no results: Go right', function (done) {

        prStub.returns(
          Q.when({wallet_name_count: 0})
        );

        nClient.getWalletNames().then(function (retVal) {

          expect(prStub).to.have.been.calledWithExactly(
            nClient,
            '/v1/partner/walletname',
            'GET'
          );

          expect(retVal).to.eql([])

        }).done(function () {
          done();
        });

      });

    });

    describe('createWalletName', function () {
      it('creates a new Wallet Name', function () {
        var nClient = new netki.NetkiClient({apiKey: apiKey, partnerID: partnerID, apiURL: apiURL}),
          retVal = nClient.createWalletName('testdomain.com', 'myName', 'btc', '1btcaddy', 'myExtId');

        expect(retVal.domainName).to.equal('testdomain.com');
        expect(retVal.name).to.equal('myName');
        expect(retVal.externalId).to.equal('myExtId');
        expect(retVal.wallets).to.eql({'btc': '1btcaddy'});
        expect(retVal.client).to.equal(nClient);

      });

    });

    describe('lookupWalletName', function () {
      var nClient;

      it('looks up a Wallet Name', function () {
        nClient = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
        prStub.returns(Q.when('apiData'));

        nClient.lookupWalletName('wallet.BruceWayne.rocks', 'btc').then(function(retVal) {
          expect(retVal).to.equal('apiData');
        });

      })
    });
    
    describe('getCertificate', function () {

      it('Retrieves a Certificate', function (done) {
        var nClient = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
        prStub.returns(Q.when({order_status: 'COMPLETE'}));

        nClient.getCertificate('id').then(function (cert) {
          expect(cert.id).to.equal('id');
          expect(cert.orderStatus).to.equal('COMPLETE');
          expect(prStub.called).to.be.true;
          done();
        });
      });

      it('Fails to Retrieve a Certificate Due to Missing ID', function () {
        var nClient = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
        try {
          nClient.getCertificate();
        } catch (err) {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.equal('Certificate ID is Required');
        }
      })

    });

    it('getAvailableProducts', function (done) {

      var nClient = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
      prStub.returns(Q.when({products: ['product1', 'product2']}));

      nClient.getAvailableProducts().then(function (products) {
        expect(prStub.called).to.be.true;
        expect(prStub.calledWithExactly(nClient, '/v1/certificate/products', 'GET'));
        expect(products[0]).to.equal('product1');
        expect(products[1]).to.equal('product2');
        done();
      });
    });

    it('getCACertBundle', function (done) {

      var nClient = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
      prStub.returns(Q.when({cacerts: ['cert1', 'cert2']}));

      nClient.getCACertBundle().then(function (certs) {
        expect(prStub.called).to.be.true;
        expect(prStub.calledWithExactly(nClient, '/v1/certificate/cacert', 'GET'));
        expect(certs[0]).to.equal('cert1');
        expect(certs[1]).to.equal('cert2');
        done();
      });
    });

    it('getAccountBalance', function (done) {

      var nClient = new netki.NetkiClient({apiKey: 'myAPIKey', partnerID: 'partnerID'});
      prStub.returns(Q.when({available_balance: 42}));

      nClient.getAccountBalance().then(function (balance) {
        expect(prStub.called).to.be.true;
        expect(prStub.calledWithExactly(nClient, '/v1/certificate/balance', 'GET'));
        expect(balance).to.equal(42);
        done();
      });
    });

  });

});