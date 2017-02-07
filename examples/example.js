/**
 * Created by frank on 7/28/15.
 */
var Q = require('q');
var KJUR = require('jsrsasign');
var NetkiClient = require('../lib/netki.js').NetkiClient;
var crypto = require('../lib/crypto.js');

var apiKey = "netki_3dea550e0f2f40928e99d06dc340c7cf";
var partnerID = "57b76023540eaffc89240727";

var ecdsaPrivKey = "30740201010420f01486bf3f962b71090bb8e0178f617e346904f37b170b8d1a3ee7d57ac41620a00706052b8104000aa14403420004fcd5e002a2edaf16c37c83234f493ecba0293792d076182ff841c6f3b399c6395a9377a6c58adb9909dc9ed8502eda83228e17632f8aca915d832e78b5b5e917";
var partnerKsk = "3056301006072a8648ce3d020106052b8104000a034200048e2ea4cb5039a0c83019f4238683da7f70a326a61ed75682268afa7e9398994af71814163d4a29914f71cc50108029d3c17cdd96ba8034bc264cbedda8a0676a";
var partnerKskSig = "3045022100c54e6a19b600df836a02302e206d01ac8ebd56dff7c967d59ee6c725fd35fa98022064a411261aea7a9c17b4bfe0ffc8cf5275fa158657becfca76cac5a374e40432";

// Instantiate Netki Partner API Client using API Key Authentication
var client = new NetkiClient({
  apiKey: apiKey,
  partnerID: partnerID,
  apiURL: 'http://localhost:5000'
});

// Load EC Key from Private Key Hex
var userKey = crypto.getECKey(ecdsaPrivKey);

/**
 * Instantiate a Netki Partner API Client using Distributed API Authentication
 *
 * Distributed API Authentication allows distributed access to WalletName CRUD
 * operations using a partner-generated signature over the remote accessor's
 * public key. Further information is available at http://docs.netki.apiary.io/#
 */

var distributedAPIAuthClient = new NetkiClient({
  partnerKskHex: partnerKsk,
  partnerKskSigHex: partnerKskSig,
  userKey: userKey,
  apiURL: 'http://localhost:5000'
});

/**
 * Instantiate a Netki Partner API Client using Signed Request Authentication
 *
 * Signed Request Authentication is Required for Certificate-related operations
 * with the NetkiClient.
 */
var signedAuthClient = new NetkiClient({
  partnerID: partnerID,
  userKey: userKey,
  apiURL: 'http://localhost:5000'
});

/**
 * Lookup a Wallet Name
 *
 * This call is useful on a SEND screen where your customer might be looking up ANY
 * Wallet Name. This includes Wallet Names that you do not manage. e.g. wallet.yourcompany.name
 * user sending to wallet.anothercompany.name user. This will lookup Wallet Names that
 * you manage as well, which is why it is perfect for the SEND screen.
 *
 * This call will return JSON that contains either a wallet address or bip21/72 URI.
 */
client.lookupWalletName(
  'wallet.BruceWayne.rocks', // Fully qualified Wallet Name
  'btc' // Currency short code - Detailed codes here: http://docs.netki.apiary.io/#reference/partner-api/wallet-name-management
).then(function (response) {
  console.log(response);
}).fail(function (err) {
  console.log('Error Looking Up Wallet Name: ' + err);
});

/**
 * Retrieve all Netki Wallet Names for your account.
 *
 * This call is useful if you need to make a mass update to your Wallet Names. It is preferred that
 * you provide specific parameters as covered in the next example below if you need to retrieve a
 * single Wallet Name. As your Wallet Name count grows, this data set will become large.
 *
 * It is also preferred that you do not use this call to check if a Wallet Name already exists. Either
 * attempt to fetch specifically by passing the appropriate externalId or simply try to create the Wallet
 * Name. The server will provide the appropriate messaging.
 */

client.getWalletNames().then(function (response) {

  console.log('Wallet Name Count: ' + response.length);

  // All Wallet Name Objects
  console.log(response);

  // First Returned Wallet Name's ID and Name
  console.log(response[0].id);
  console.log(response[0].name);

}).fail(function (err) {
  console.log('Error Looking Up Wallet Names ' + err);
});

/**
 * Retrieve specific Netki Wallet Name by externalId
 *
 * Retrieve a specific Netki Wallet Name based on the unique externalId that you
 * provided during creation. This is the preferred method of retrieving a Wallet Name
 * for the purposes of updating it or if necessary to check if the Wallet Name has already been created.
 */
client.getWalletNames(null, 'externalId').then(function (response) {

  // All Wallet Name Objects With Specified externalId
  console.log(response);

  // First Returned Wallet Name's ID and Name
  console.log(response[0].id);
  console.log(response[0].name);

}).fail(function (err) {
  console.log('Error Looking Up Wallet Names ' + err);
});

/**
 * Retrieve all Netki Wallet Names associated with a specific domainName
 *
 * If you have multiple domain names with which you use to create Wallet Names this call is
 * useful if you need to preform a mass update of all Wallet Names specifically associated with a domain name.
 */
client.getWalletNames('yourwalletnamedomain.com').then(function (response) {
  // All Wallet Name Objects With Specified domainName
  console.log(response);
}).fail(function (err) {
  console.log('Error Looking Up Wallet Names ' + err);
});


/**
 * Create a new Netki Wallet Name by first creating the Wallet Name object
 *
 *  The below example will yield the Wallet Name username.yourwalletnamedomain.com
 *
 * A real example of a Wallet Name is batman.tip.me. To setup this Wallet Name
 * 'username' would become 'batman' and 'yourwalletnamedomain.com' would become 'tip.me'
 */
var wnObj = client.createWalletName(
  'yourwalletnamedomain.com', // Domain you use for customer Wallet Names
  'username', // Your Users Wallet Name.
  'btc', // Currency for associated wallet address.
  '1CpLXM15vjULK3ZPGUTDMUcGATGR9xGitv', // Your users wallet address or endpoint to retrieve an address (HD Wallets)
  'externalID' // Unique identifier you use to identify this user in your system
);

// The above method will return a Wallet Name object. Call save() to commit the Wallet Name to the Netki API.
wnObj.save().then(function(){
  // great success

}).fail(function(err){
  console.log('Error Saving Wallet Name ' + err);
});

// Delete an existing Netki Wallet Name by first fetching the Wallet Name object
client.getWalletNames(null, 'externalId').then(function (response) {

  var wn = response[0];

  // Now call delete
  wn.delete()

}).fail(function (err) {
  console.log('Error Deleting Wallet Name ' + err);
});

/****************************************************
 * Distributed API Authentication Wallet Name CRUD
 ****************************************************/
var distWalletName = distributedAPIAuthClient.createWalletName('partnerdomain.com', 'wallet', 'btc', '1CpLXM15vjULK3ZPGUTDMUcGATGR9xGitv', 'externalId');
distWalletName.save().then(function () {
  distributedAPIAuthClient.getWalletNames().then(function () {
    distWalletName.delete();
  }).fail(function (err) {
    console.log('Error Retrieving Distributed API Access Wallet Names ' + err);
  });
}).fail(function (err) {
  console.log('Error Saving Distributed API Access Wallet Name ' + err);
});


/**************************
 * Certificate Operations
 **************************/

// Create Proposed Cert with Appropriate User Validation Data
var certKey = KJUR.KEYUTIL.generateKeypair('RSA', 2048);
var cert = signedAuthClient.createCertificate();

// Add / Update Additional User Information
cert.setCustomerData({
  organizationName: 'Partner Name',
  country: 'AU',
  city: 'Brisbane',
  firstName: 'Testy',
  middleName: 'Veritas',
  lastName: 'Testerson',
  state: 'QLD',
  streetAddress: '123 Main St.',
  postalCode: '4120',
  email: 'user6@domain.com',
  dob: new Date('1981-01-02'),
  phone: '+61 1300 975 707',
  identity: '1234567890',
  identityType: 'drivers license',
  identityExpiration: new Date('2030-01-02'),
  identityState: 'QLD',
  identityGender: 'F'
});

var pollCertComplete = function(cert, cb) {
  var certInterval = setInterval(function () {
    cert.getStatus().then(function () {
      if(cert.isOrderComplete()) {
        clearInterval(certInterval);
        cb(cert);
      }
    });
  }, 5000);
};

/**
 * Certificate Order Processing:
 *
 * 1. Determine Certificate Product to Use
 * 2. Submit User Data
 * 3. Submit Certificate Order
 * 4. Submit CSR
 * 5. Refresh Certificate Status
 */
signedAuthClient.getAvailableProducts()
    .then(function (products) {

      for (var p in products) {
        if (products.hasOwnProperty(p)) {
          if (products[p].product_name === 'Certificate - Basic') {
            return Q.when(products[p]);
          }
        }
      }
    })
    .then(function (product) {
      cert.setProduct(product);
      return Q.when();
    })
    .then(function () {
      return cert.submitUserData();
    })
    .then(function () {
      return cert.submitOrder();
    })
    .then(function () {
      return cert.submitCSR(certKey);
    })
    .then(function () {
      pollCertComplete(cert, function (cert) {
        console.log('Cert Complete! ' + cert.id)
      });
    }).catch(function (err) {
      console.log('ERROR: ' + err);
    });

// Retrieve Existing Certificate
signedAuthClient.getCertificate('certId').then(function (returnedCert) {
  doSomething(returnedCert);
});