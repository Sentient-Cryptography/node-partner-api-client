/*jslint node: true */
"use strict";

var KJUR = require('jsrsasign');

var getECKey = function(hexKey) {
  var key = KJUR.ASN1HEX.getVbyList(hexKey, 0, [1], '04');
  var curveNameOidHex = KJUR.ASN1HEX.getVbyList(hexKey, 0, [2,0], '06');
  var pubKey = KJUR.ASN1HEX.getVbyList(hexKey, 0, [3, 0], '03').substr(2);
  var curveName = KJUR.crypto.OID.oidhex2name[curveNameOidHex];

  var ec = new KJUR.crypto.ECDSA({curve: curveName});
  ec.setPublicKeyHex(pubKey);
  ec.setPrivateKeyHex(key);
  ec.isPublic = false;
  return ec;
};

var createCsrPem = function (key, subject) {
  return KJUR.asn1.csr.CSRUtil.newCSRPEM({
    subject: subject,
    ext: [
      { KeyUsage: { bin: '111' } },
      { BasicConstraints: { cA: false } }
    ],
    sbjpubkey: key.pubKeyObj,
    sigalg: 'SHA256withRSA',
    sbjprvkey: key.prvKeyObj
  });
};

var getHexPubKey = function (key) {
  if (key.hasOwnProperty('pubKeyObj') && key.pubKeyObj instanceof KJUR.RSAKey) {
    return new KJUR.asn1.x509.SubjectPublicKeyInfo(key.pubKeyObj).getEncodedHex();
  }
  return new KJUR.asn1.x509.SubjectPublicKeyInfo(key).getEncodedHex();
};

var signString = function(key, str) {
  var signer = new KJUR.crypto.Signature({alg: 'SHA256withECDSA'});
  signer.init(key);
  signer.updateString(str);
  return signer.sign();
};

var signBuffer = function(key, buffer) {
  var signer = new KJUR.crypto.Signature({alg: 'SHA256withECDSA'});
  signer.init(key);
  signer.updateHex(buffer.toString('hex'));
  return signer.sign();
};

var isECDSA = function(key) {
  if (key instanceof KJUR.crypto.ECDSA) {
    return true;
  } else if(key.hasOwnProperty('prvKeyObj') && key.prvKeyObj instanceof KJUR.crypto.ECDSA) {
    return true;
  } else if(key.hasOwnProperty('pubKeyObj') && key.pubKeyObj instanceof KJUR.crypto.ECDSA) {
    return true;
  }
  return false;
};

var isRSA = function(key) {
  if (key instanceof KJUR.RSAKey) {
    return true;
  } else if(key.hasOwnProperty('prvKeyObj') && key.prvKeyObj instanceof KJUR.RSAKey) {
    return true;
  } else if(key.hasOwnProperty('pubKeyObj') && key.pubKeyObj instanceof KJUR.RSAKey) {
    return true;
  }
  return false;
};

module.exports = {
  createCsrPem: createCsrPem,
  getECKey: getECKey,
  getHexPubKey: getHexPubKey,
  signString: signString,
  signBuffer: signBuffer,
  isECDSA: isECDSA,
  isRSA: isRSA
};