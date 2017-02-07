var rewire = require('rewire'),
    crypto = require('../lib/crypto.js'),
    chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    expect = chai.expect,
    nock = require('nock'),
    KJUR = require('jsrsasign');

chai.use(sinonChai);

describe('Netki Crypto Tests', function () {

  var hexKey = '30740201010420c83b470f672a88841814b8c5e7a287d36f1bb87a0de44f329da1bc92f4af5dbca00706052b8104000aa1440342000461f7cc1dd9b565c96bb3ee6343a936e3224414338e1c9dbe58776dd5be351a0cea55952f729659f5e926957472cadf9634dbefa35d37ab7729bed19ccaea7cae';
 
  describe('getECKey', function () {

    it('Loads EC Key from Hex', function () {
      var ec = crypto.getECKey(hexKey);
      expect(ec.type).to.equal('EC');
      expect(ec.curveName).to.equal('secp256k1');
      expect(ec.pubKeyHex).to.equal('0461f7cc1dd9b565c96bb3ee6343a936e3224414338e1c9dbe58776dd5be351a0cea55952f729659f5e926957472cadf9634dbefa35d37ab7729bed19ccaea7cae');
      expect(ec.prvKeyHex).to.equal('c83b470f672a88841814b8c5e7a287d36f1bb87a0de44f329da1bc92f4af5dbc');
    });

  });

  describe('createCsrPem', function () {

    it('creates a CSR PEM from RSAKey and Subject', function () {
      var spy = sinon.spy(KJUR.asn1.csr.CSRUtil, 'newCSRPEM');

      var key = KJUR.KEYUTIL.generateKeypair('RSA', 1024);
      crypto.createCsrPem(key, '/C=US/CN=Test');

      expect(spy.called).to.equal(true);
      expect(spy.calledWithExactly({
        subject: '/C=US/CN=Test',
        ext: [
          { KeyUsage: { bin: '111' } },
          { BasicConstraints: { cA: false } }
        ],
        sbjpubkey: key.pubKeyObj,
        sigalg: 'SHA256withRSA',
        sbjprvkey: key.prvKeyObj
      })).to.equal(true);

      KJUR.asn1.csr.CSRUtil.newCSRPEM.restore();
    });

  });

  describe('getHexPubKey', function () {

    var spy;

    beforeEach(function () {
      spy = sinon.spy(KJUR.asn1.x509, 'SubjectPublicKeyInfo');
    });

    afterEach(function () {
      KJUR.asn1.x509.SubjectPublicKeyInfo.restore();
    });

    it('Gets Hex Public Key from ECDSA Key', function () {
      var ec = crypto.getECKey(hexKey);
      var result = crypto.getHexPubKey(ec);

      expect(result).to.equal('3056301006072a8648ce3d020106052b8104000a0342000461f7cc1dd9b565c96bb3ee6343a936e3224414338e1c9dbe58776dd5be351a0cea55952f729659f5e926957472cadf9634dbefa35d37ab7729bed19ccaea7cae');
      expect(spy.called).to.equal(true);
      expect(spy.calledWithExactly(ec)).to.equal(true);

    });

    it('Gets Hex Public Key from RSA Key', function () {
      var rsaKey = KJUR.KEYUTIL.generateKeypair('RSA', 1024);
      crypto.getHexPubKey(rsaKey);

      expect(spy.called).to.equal(true);
      expect(spy.calledWithExactly(rsaKey.pubKeyObj)).to.equal(true);

    });

  });

  describe('ECDSA Signing', function () {

    var spy;
    var ec = crypto.getECKey(hexKey);

    var sigVerify;

    beforeEach(function () {
      spy = sinon.spy(KJUR.crypto, 'Signature');
      sigVerify = new KJUR.crypto.Signature({alg: 'SHA256withECDSA'});
      sigVerify.init(ec);
    });

    afterEach(function () {
      KJUR.crypto.Signature.restore();
    });

    it('Signs a String', function () {
      var sig = crypto.signString(ec, 'test string');
      sigVerify.updateString('test string');

      var verified = ec.verifyHex(KJUR.crypto.Util.sha256('test string'), sig, ec.pubKeyHex);
      expect(verified).to.equal(true);
    });

    it('Signs a Buffer', function () {
      var toSign = new Buffer('test string');
      var sig = crypto.signBuffer(ec, toSign);

      var verified = ec.verifyHex(KJUR.crypto.Util.sha256('test string'), sig, ec.pubKeyHex);
      expect(verified).to.equal(true);
    });

  });

  describe('Check Key Types', function () {

    var ec = crypto.getECKey(hexKey);
    var rsa = KJUR.KEYUTIL.generateKeypair('RSA', 1024);

    it('isECDSA true for ECDSA Key', function () {
      expect(crypto.isECDSA(ec)).to.equal(true);
    });

    it('isECDSA false for RSA Key', function () {
      expect(crypto.isECDSA(rsa.prvKeyObj)).to.equal(false);
    });

    it('isRSA true for RSA KeyPair', function () {
      expect(crypto.isRSA(rsa)).to.equal(true);
    });

    it('isRSA true for RSA Private Key', function () {
      expect(crypto.isRSA(rsa.prvKeyObj)).to.equal(true);
    });

    it('isRSA true for RSA Public Key', function () {
      expect(crypto.isRSA(rsa.pubKeyObj)).to.equal(true);
    });

    it('isRSA false for ECDSA Key', function () {
      expect(crypto.isRSA(ec)).to.equal(false);
    });

  });
  
});