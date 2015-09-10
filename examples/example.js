/**
 * Created by frank on 7/28/15.
 */

netki = require('../lib/netki.js');

// Instantiate Netki Partner API Client
var client = new netki.netkiClient(
  'yourApiKey',
  'yourPartnerID'
);

// GET all Netki Wallet Names for your Partner ID
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

// GET a specific Netki Wallet Name based on the unique externalId that you provided during creation
client.getWalletNames(null, 'extid').then(function (response) {

  // All Wallet Name Objects With Specified externalId
  console.log(response);

  // First Returned Wallet Name's ID and Name
  console.log(response[0].id);
  console.log(response[0].name);

}).fail(function (err) {
  console.log('Error Looking Up Wallet Names ' + err);
});

// GET all Netki Wallet Name's associated with a specific domainName
client.getWalletNames('createdomaintest.com').then(function (response) {

  // All Wallet Name Objects With Specified domainName
  console.log(response);

}).fail(function (err) {
  console.log('Error Looking Up Wallet Names ' + err);
});

// Create a new Netki Wallet Name by first creating the Wallet Name object
var wnObj = client.createWalletName('createdomaintest.com', 'myname8', 'LTC', 'Lcoinaddy', 'myextidya');

// Then call save() to commit to the Netki API
wnObj.save().then(function(){
  // great success

}).fail(function(fail){
  console.log('Error Saving Wallet Name ' + fail);
});

// Delete an existing Netki Wallet Name by first fetching the Wallet Name object
client.getWalletNames(null, 'extid').then(function (response) {

  var wn = response[0];

  // Now call delete
  wn.delete()

}).fail(function (err) {
  console.log('Error Deleting Wallet Name ' + err);
});
