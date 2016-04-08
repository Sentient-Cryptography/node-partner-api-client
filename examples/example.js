/**
 * Created by frank on 7/28/15.
 */

netki = require('../lib/netki.js');

// Instantiate Netki Partner API Client
var client = new netki.netkiClient(
  'yourApiKey',
  'yourPartnerID'
);

// Lookup a Wallet Name. This call is useful on a SEND screen where your customer
// might be looking up ANY Wallet Name. This includes Wallet Names that you do not
// manage. e.g. wallet.yourcompany.name user sending to wallet.anothercompany.name user.
// This will lookup Wallet Names that you manage as well, which is why it is perfect
// for the SEND screen.
// This call will return JSON that contains either a wallet address or bip21/72 URI.
client.lookupWalletName(
  'wallet.BruceWayne.rocks', // Fully qualified Wallet Name
  'btc' // Currency short code - Detailed codes here: http://docs.netki.apiary.io/#reference/partner-api/wallet-name-management
).then(function (response) {
  console.log(response);
}).fail(function (err) {
  console.log('Error Looking Up Wallet Name: ' + err);
});


// Retrieve all Netki Wallet Names for your account. This call is useful if you
// need to make a mass update to your Wallet Names. It is preferred that you provide
// specific parameters as covered in the next example below if you need to retrieve a single
// Wallet Name. As your Wallet Name count grows, this data set will become large.
// It is also preferred that you do not use this call to check if a Wallet Name already
// exists. Either attempt to fetch specifically by passing the appropriate externalId
// or simply try to create the Wallet Name. The server will provide the appropriate
// messaging.
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


// Retrieve a specific Netki Wallet Name based on the unique externalId that you
// provided during creation. This is the preferred method of retrieving a
// Wallet Name for the purposes of updating it or if necessary to check if the
// Wallet Name has already been created.
client.getWalletNames(null, 'externalId').then(function (response) {

  // All Wallet Name Objects With Specified externalId
  console.log(response);

  // First Returned Wallet Name's ID and Name
  console.log(response[0].id);
  console.log(response[0].name);

}).fail(function (err) {
  console.log('Error Looking Up Wallet Names ' + err);
});


// Retrieve all Netki Wallet Names associated with a specific domainName. If
// you have multiple domain names with which you use to create Wallet Names
// this call is useful if you need to preform a mass update of all Wallet Names
// specifically associated with a domain name.
client.getWalletNames('yourwalletnamedomain.com').then(function (response) {
  // All Wallet Name Objects With Specified domainName
  console.log(response);
}).fail(function (err) {
  console.log('Error Looking Up Wallet Names ' + err);
});


// Create a new Netki Wallet Name by first creating the Wallet Name object
var wnObj = client.createWalletName(
  'yourwalletnamedomain.com', // Domain you use for customer Wallet Names
  'username', // Your Users Wallet Name.
  'btc', // Currency for associated wallet address.
  '1CpLXM15vjULK3ZPGUTDMUcGATGR9xGitv', // Your users wallet address or endpoint to retrieve an address (HD Wallets)
  'externalID' // Unique identifier you use to identify this user in your system
);
// The above example will yield the users Wallet Name of username.yourwalletnamedomain.com
// A real example is batman.tip.me
// Substitute:
// username == batman
// yourwalletnamedomain.com == tip.me

// The above method will return a Wallet Name object. Call save() to commit
// the Wallet Name to the Netki API.
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
