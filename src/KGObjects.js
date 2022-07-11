/*

    KGObjects.js

    prerequisites:
    --------------


    toc
    ---
    the following list shows the order in which all constructors are
    defined. Use this list to locate code in this document:

        Endpoint


    credits
    -------
    Vincenzo Offertucci

*/

/*jshint esversion: 6*/

// Global stuff ////////////////////////////////////////////////////////

modules.KGObjects = '2022-July-10';

// Declarations

var SnapVersion = '7.4.0-dev';

var Endpoint;
var WikiDataEndpoint;

// Endpoint ///////////////////////////////////////////////////////////

// Represents the generic endpoint for making SPARQL query requests

Endpoint.prototype.constructor = Endpoint;

function Endpoint(baseUrl, language){
    this.init(baseUrl, language);
}

Endpoint.prototype.init = function(baseUrl, language){
    this.baseUrl = baseUrl;
    this.language = language;
}

Endpoint.prototype.searchEntity = function(search){
    return search;
}


// WikiDataEndpoint

WikiDataEndpoint.prototype = new Endpoint();
WikiDataEndpoint.prototype.constructor = WikiDataEndpoint;
WikiDataEndpoint.uber = Endpoint.prototype;

function WikiDataEndpoint(language, morph){
    this.init(language, morph);
}

WikiDataEndpoint.prototype.init = function(language, morph){
    this.baseUrl = 'https://query.wikidata.org/sparql';
    this.language = language;
    this.morph = morph;
}

WikiDataEndpoint.prototype.searchEntity = function(search, type){
    requestUrl = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&language=' + this.language +'&uselang=' + this.language + '&type=' + type + '&format=json&origin=*&search=' + search;
    console.log(requestUrl);
    result = new XMLHttpRequest();
    result.open('GET', requestUrl, true);
    result.send(null);
    result.onreadystatechange = () => {
        json = JSON.parse(result.response);
        console.log(json);
        if(json.search.length == 0)
            return null;
        temp = json.search[0];
        searchResult = {
            id: temp.id,
            label: temp.display.label.value,
            description: temp.display.description.value,
            concepturi: temp.concepturi
        };
        this.morph.createResultVar('searchResult', searchResult);
        this.morph.showSearchResults('searchResult');
    }
}